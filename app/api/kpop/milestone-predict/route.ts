import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { hasProAccess } from "@/lib/auth/plan"
import Anthropic from "@anthropic-ai/sdk"

export const dynamic = "force-dynamic"
export const maxDuration = 30

// POST /api/kpop/milestone-predict — Pro 전용 차트 마일스톤 예측
// body: { artistId: uuid }
// 흐름:
//   1. Pro 인증
//   2. kpop_milestone_cache 6h 캐시 확인
//   3. kpop_stats_daily에서 최근 데이터 조회 → 순위·격차 계산
//   4. Claude Haiku 호출 → 예측 텍스트
//   5. 결과 캐시 저장 후 반환

const BodySchema = z.object({
  artistId: z.string().uuid(),
})

const claude = new Anthropic()

const SYSTEM_PROMPT = `You are a K-pop chart analyst for UnfoldK. Respond in 2-3 sentences only. Be specific with numbers. Use fan-friendly, urgent tone. Never mention "Last.fm" — say "global listeners" instead.`

export async function POST(request: Request) {
  // 1. 인증 + Pro 가드
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

  // 2. 입력 검증
  let raw: unknown
  try { raw = await request.json() } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }) }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { artistId } = parsed.data
  const admin = createSupabaseAdminClient()

  // 3. 캐시 확인 (6시간 TTL)
  const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000).toISOString()
  const { data: cached } = await admin
    .from("kpop_milestone_cache")
    .select("prediction_text")
    .eq("artist_id", artistId)
    .gte("created_at", sixHoursAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (cached?.prediction_text) {
    return NextResponse.json({ prediction: cached.prediction_text as string, cached: true })
  }

  // 4. 아티스트 정보
  const { data: artistData } = await admin
    .from("kpop_artists")
    .select("name")
    .eq("id", artistId)
    .maybeSingle()
  if (!artistData) return NextResponse.json({ error: "artist_not_found" }, { status: 404 })
  const artistName = (artistData as { name: string }).name

  // 5. 최근 30일 stats 조회 — 해당 아티스트 + 전체 아티스트 최신값
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30)
  const sinceDate = thirtyDaysAgo.toISOString().slice(0, 10)

  const [{ data: myStats }, { data: allStats }] = await Promise.all([
    admin
      .from("kpop_stats_daily")
      .select("date, lastfm_listeners")
      .eq("artist_id", artistId)
      .gte("date", sinceDate)
      .order("date", { ascending: false })
      .limit(8),
    admin
      .from("kpop_stats_daily")
      .select("artist_id, lastfm_listeners")
      .gte("date", sinceDate)
      .order("date", { ascending: false }),
  ])

  // 아티스트별 최신 리스너 수 집계
  const latestMap = new Map<string, number>()
  for (const s of (allStats ?? []) as Array<{ artist_id: string; lastfm_listeners: number | null }>) {
    if (!latestMap.has(s.artist_id) && s.lastfm_listeners !== null) {
      latestMap.set(s.artist_id, s.lastfm_listeners)
    }
  }

  const myListeners = latestMap.get(artistId) ?? 0
  const sortedListeners = [...latestMap.values()].sort((a, b) => b - a)
  const rank = sortedListeners.findIndex(l => l <= myListeners) + 1
  const top1Listeners = sortedListeners[0] ?? 0
  const gapFromFirst = Math.max(0, top1Listeners - myListeners)

  // 7일 리스너 증감 계산
  const statsArr = (myStats ?? []) as Array<{ date: string; lastfm_listeners: number | null }>
  let sevenDayChange: number | null = null
  if (statsArr.length >= 2) {
    const latestVal = statsArr[0].lastfm_listeners
    const olderRow = statsArr.find((s, i) => {
      if (i === 0) return false
      const diff = (new Date(statsArr[0].date).getTime() - new Date(s.date).getTime()) / 86400000
      return diff >= 6
    })
    if (latestVal !== null && olderRow?.lastfm_listeners !== null && olderRow?.lastfm_listeners !== undefined) {
      sevenDayChange = latestVal! - olderRow.lastfm_listeners
    }
  }

  // 6. Claude Haiku 호출
  const userMessage = [
    `Artist: ${artistName}`,
    `Current global K-pop rank: #${rank}`,
    `Monthly listeners: ${myListeners.toLocaleString()}`,
    sevenDayChange !== null
      ? `7-day listener change: ${sevenDayChange >= 0 ? "+" : ""}${sevenDayChange.toLocaleString()}`
      : null,
    `Gap from #1 K-pop artist: ${gapFromFirst.toLocaleString()} listeners`,
    "Give a milestone prediction with specific listener targets needed and probability percentage.",
  ].filter(Boolean).join("\n")

  let prediction: string
  try {
    const response = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage }],
    })
    const textBlock = response.content.find(b => b.type === "text")
    prediction = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "Prediction unavailable."
  } catch (err) {
    console.error("[milestone-predict] Claude 호출 실패:", err)
    return NextResponse.json({ error: "ai_error" }, { status: 502 })
  }

  // 7. 캐시 저장 (실패해도 응답은 정상 반환)
  try {
    await admin
      .from("kpop_milestone_cache")
      .insert({ artist_id: artistId, prediction_text: prediction })
  } catch (e) {
    console.error("[milestone-predict] 캐시 저장 실패:", e)
  }

  return NextResponse.json({ prediction, cached: false })
}
