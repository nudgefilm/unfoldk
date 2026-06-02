import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { hasProAccess } from "@/lib/auth/plan"
import Anthropic from "@anthropic-ai/sdk"

export const dynamic = "force-dynamic"
export const maxDuration = 30

// POST /api/kpop/chart-attack/share — 바이럴 트윗 문구 생성
// Free: 프론트에서 프리셋 문구 직접 사용 (이 API 불필요)
// Pro: Claude Haiku 로 팬덤 맞춤 바이럴 문구 생성
//
// 출력: tweet_text (280자 이내 영문)

const BodySchema = z.object({
  artist_name: z.string().min(1).max(100),
  current_rank: z.number().int().min(1).max(50),
  rank_change: z.number().int().nullable(),
  listener_change_pct: z.number().nullable(),
})

const client = new Anthropic()

const SYSTEM_PROMPT = `You are a viral K-pop social media copywriter for UnfoldK. Write a hype tweet that fans will want to share to boost their favorite artist's listener count.

Rules:
- Max 240 characters (leave room for hashtags)
- Use K-pop fan culture language (streaming, stanning, fandom energy)
- Be specific with the rank number
- Include 2-3 relevant hashtags (artist name, KpopAttack, UnfoldK)
- Reference "global listeners" or "global ranking" — never mention the data source app
- End with a call-to-action to stream more
- Emoji allowed (1-3 max)`

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("plan_type, is_admin, trial_ends_at")
    .eq("id", user.id)
    .maybeSingle()
  const row = profile as { plan_type?: string; is_admin?: boolean; trial_ends_at?: string | null } | null
  if (!hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin, trialEndsAt: row?.trial_ends_at })) {
    return NextResponse.json({ error: "pro_required" }, { status: 403 })
  }

  let raw: unknown
  try { raw = await request.json() } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }) }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { artist_name, current_rank, rank_change, listener_change_pct } = parsed.data
  const changeText = rank_change !== null
    ? (rank_change > 0 ? `UP ${rank_change} positions` : rank_change < 0 ? `DOWN ${Math.abs(rank_change)} positions` : "HOLDING steady")
    : "NEW ENTRY"
  const listenerText = listener_change_pct !== null
    ? `Listener change: ${listener_change_pct > 0 ? "+" : ""}${listener_change_pct}% this week`
    : ""

  const userMessage = [
    `Artist: ${artist_name}`,
    `Global K-pop listener rank: #${current_rank} (${changeText})`,
    listenerText,
    "Write a viral fan tweet to hype streaming and boost the global listener rank.",
  ].filter(Boolean).join("\n")

  let tweetText: string
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage }],
    })
    const textBlock = response.content.find(b => b.type === "text")
    tweetText = textBlock && textBlock.type === "text"
      ? textBlock.text.trim().slice(0, 280)
      : `🔥 ${artist_name} is #${current_rank} globally! Let's stream and break into TOP 10! #${artist_name.replace(/\s/g, "")} #KpopAttack #UnfoldK`
  } catch (err) {
    console.error("[chart-attack/share]", err)
    return NextResponse.json({ error: "ai_error" }, { status: 502 })
  }

  return NextResponse.json({ tweet_text: tweetText })
}
