import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { hasProAccess } from "@/lib/auth/plan"
import Anthropic from "@anthropic-ai/sdk"

export const dynamic = "force-dynamic"
export const maxDuration = 30

// POST /api/kpop/chart-attack/milestone — Pro 전용 AI 진입률 예측
// 입력: 아티스트명, 현재 Billboard 순위, 이전 주 순위, 1위와의 격차
// 출력: "진입률 78%, 앞으로 4,500 스트리밍 추가 시 TOP 10 확정" 형태 자연어 인사이트

const BodySchema = z.object({
  artist_name: z.string().min(1).max(100),
  current_rank: z.number().int().min(1).max(50),
  rank_change: z.number().int().nullable(),
  listeners: z.number().int().min(0),
  listener_change_pct: z.number().nullable(),  // 7일 대비 청취자 증감률 (%)
  gap_from_first: z.number().int().min(0),     // 1위와의 청취자 격차 (절대값)
})

const client = new Anthropic()

const SYSTEM_PROMPT = `You are a K-pop chart analyst for UnfoldK. Given a K-pop artist's Last.fm global listener ranking data, generate a short, exciting prediction insight for fans.

Rules:
- Write in English, 1-2 sentences max
- Be specific with numbers (listener growth needed, probability %)
- Sound exciting and fan-friendly
- Format: "X% chance of reaching TOP Y — needs ~Z more monthly listeners to break through!"
- If already #1, say something about total global dominance
- Reference "monthly listeners" not "streams". Never mention Last.fm by name.`

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

  const { artist_name, current_rank, rank_change, listeners, listener_change_pct, gap_from_first } = parsed.data
  const rankChangeText = rank_change !== null
    ? (rank_change > 0 ? `up ${rank_change}` : rank_change < 0 ? `down ${Math.abs(rank_change)}` : "stable")
    : "new entry"
  const listenerTrend = listener_change_pct !== null
    ? (listener_change_pct > 0 ? `+${listener_change_pct}%` : `${listener_change_pct}%`) + " this week"
    : "trend unknown"

  const userMessage = [
    `Artist: ${artist_name}`,
    `Global K-pop listener rank: #${current_rank} (${rankChangeText} from last week)`,
    `Monthly listeners: ${listeners.toLocaleString()} (${listenerTrend})`,
    `Gap from #1 K-pop artist: ${gap_from_first.toLocaleString()} listeners`,
    `Generate a fan-facing prediction insight about their listener growth trajectory.`,
  ].join("\n")

  let insight: string
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage }],
    })
    const textBlock = response.content.find(b => b.type === "text")
    insight = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "Chart analysis unavailable."
  } catch (err) {
    console.error("[chart-attack/milestone]", err)
    return NextResponse.json({ error: "ai_error" }, { status: 502 })
  }

  return NextResponse.json({ insight })
}
