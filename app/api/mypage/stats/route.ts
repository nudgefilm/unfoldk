import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// /api/mypage/stats — 대시보드 4개 stat 카운트
//
// 응답: { artistsTracking, eventsThisMonth, streakDays, savedRecipes }
// 모두 로그인 사용자 본인 데이터. RLS 가 본인 행만 노출.
//
// 한 번의 round-trip 으로 4개 stat 가져오는 게 mypage/page.tsx 의 stat 격자 flicker 최소화.

export const dynamic = "force-dynamic"

interface MyStats {
  artistsTracking: number
  eventsThisMonth: number
  streakDays: number
  savedRecipes: number
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  // 1+2. Artists Tracking + Events This Month — 본인 구독 event_id 목록 →
  //      hallyu_calendar_events 에서 artist_or_drama distinct count + 이번 달 event_date 필터
  //      (user_calendar_subscriptions 가 이벤트 단위라 distinct artist 로 의미 보정)
  const subsP = supabase
    .from("user_calendar_subscriptions")
    .select("event_id")
    .eq("user_id", user.id)

  // 3. Korean Lessons — user_streaks.streak_days
  const streakP = supabase
    .from("user_streaks")
    .select("streak_days")
    .eq("user_id", user.id)
    .maybeSingle()

  // 4. Saved Recipes — user_food_collections row count
  const recipesP = supabase
    .from("user_food_collections")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)

  const [subsRes, streakRes, recipesRes] = await Promise.all([
    subsP,
    streakP,
    recipesP,
  ])

  // 개별 stat 실패는 0 으로 폴백 — 한 stat 오류로 대시보드 전체 무너지지 않게.
  if (subsRes.error) {
    console.warn("[/api/mypage/stats] subs select 실패:", subsRes.error.message)
  }
  if (streakRes.error) {
    console.warn("[/api/mypage/stats] streak select 실패:", streakRes.error.message)
  }
  if (recipesRes.error) {
    console.warn("[/api/mypage/stats] recipes count 실패:", recipesRes.error.message)
  }

  // subs.event_id → events 조회 → distinct artist + 이번 달 필터.
  // 한 사용자의 구독 행 수는 보통 수십 이내라 메모리 처리 OK.
  let artistsTracking = 0
  let eventsThisMonth = 0
  type SubsRow = { event_id: string }
  const eventIds = ((subsRes.data ?? []) as SubsRow[])
    .map((s) => s.event_id)
    .filter((id) => typeof id === "string")
  if (eventIds.length > 0) {
    const now = new Date()
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    ).toISOString()
    const eventsRes = await supabase
      .from("hallyu_calendar_events")
      .select("id, artist_or_drama, event_date")
      .in("id", eventIds)
    if (eventsRes.error) {
      console.warn("[/api/mypage/stats] events select 실패:", eventsRes.error.message)
    } else {
      type EventRow = { id: string; artist_or_drama: string | null; event_date: string }
      const rows = (eventsRes.data ?? []) as EventRow[]
      // distinct artist_or_drama — null/빈 문자열은 카운트 제외 ("Unknown" 같은 비명시 이벤트 미반영)
      const artistSet = new Set<string>()
      for (const r of rows) {
        const name = r.artist_or_drama?.trim()
        if (name) artistSet.add(name)
      }
      artistsTracking = artistSet.size
      // 이번 달 (UTC) event_date 필터
      eventsThisMonth = rows.filter(
        (r) => r.event_date >= start && r.event_date < end
      ).length
    }
  }

  const streakRow = streakRes.data as { streak_days?: number } | null
  const stats: MyStats = {
    artistsTracking,
    eventsThisMonth,
    streakDays: streakRow?.streak_days ?? 0,
    savedRecipes: recipesRes.count ?? 0,
  }
  return NextResponse.json(stats)
}
