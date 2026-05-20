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

  // 1. Artists Tracking — user_calendar_subscriptions row count (본인 트래킹 이벤트 수)
  const artistsP = supabase
    .from("user_calendar_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)

  // 2. Events This Month 1단계 — 본인 구독 event_id 목록.
  //    PostgREST 가 inner join 카운트를 한 쿼리로 못 줘서 2단계.
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

  const [artistsRes, subsRes, streakRes, recipesRes] = await Promise.all([
    artistsP,
    subsP,
    streakP,
    recipesP,
  ])

  // 개별 stat 실패는 0 으로 폴백 — 한 stat 오류로 대시보드 전체 무너지지 않게.
  // 단 다음 분기마다 console.warn 으로 흔적 남김.
  if (artistsRes.error) {
    console.warn("[/api/mypage/stats] artists count 실패:", artistsRes.error.message)
  }
  if (subsRes.error) {
    console.warn("[/api/mypage/stats] subs select 실패:", subsRes.error.message)
  }
  if (streakRes.error) {
    console.warn("[/api/mypage/stats] streak select 실패:", streakRes.error.message)
  }
  if (recipesRes.error) {
    console.warn("[/api/mypage/stats] recipes count 실패:", recipesRes.error.message)
  }

  // Events This Month — 위 subs 결과로 2단계
  // hallyu_calendar_events.event_date 가 이번 달 UTC 범위에 들어가는 것만.
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
      .select("id", { count: "exact", head: true })
      .in("id", eventIds)
      .gte("event_date", start)
      .lt("event_date", end)
    if (eventsRes.error) {
      console.warn("[/api/mypage/stats] events this-month count 실패:", eventsRes.error.message)
    } else {
      eventsThisMonth = eventsRes.count ?? 0
    }
  }

  const streakRow = streakRes.data as { streak_days?: number } | null
  const stats: MyStats = {
    artistsTracking: artistsRes.count ?? 0,
    eventsThisMonth,
    streakDays: streakRow?.streak_days ?? 0,
    savedRecipes: recipesRes.count ?? 0,
  }
  return NextResponse.json(stats)
}
