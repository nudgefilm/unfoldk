import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// /api/mypage/stats — 대시보드 4개 stat 카운트
//
// 응답: { artistsTracking, eventsUpcoming, streakDays, savedRecipes, masteredPhrases }
// 모두 로그인 사용자 본인 데이터. RLS 가 본인 행만 노출.
//
// artistsTracking: /api/mypage/artists 와 동일한 소스 (kpop_artists 매칭 카운트).
//   ALL 구독 → ALL 이벤트 → distinct artist_or_drama → kpop_artists 매칭 → 건수.
//   페이지와 동일 로직 유지: 두 곳이 항상 일치.
//
// eventsUpcoming: notification_enabled=true 구독 → 미래 이벤트 (>= now) 건수.
//   /api/mypage/events 와 동일 필터.
//
// masteredPhrases: user_learning_progress status='mastered' 건수.
//   Korean Lessons 카드 표시. streakDays 는 Continue Learning Progress Bar 용으로 유지.

export const dynamic = "force-dynamic"

interface MyStats {
  artistsTracking: number
  eventsUpcoming: number
  streakDays: number
  savedRecipes: number
  masteredPhrases: number
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  // 구독 전체 (notification_enabled 포함해서 가져옴)
  const subsRes = await supabase
    .from("user_calendar_subscriptions")
    .select("event_id, notification_enabled")
    .eq("user_id", user.id)

  if (subsRes.error) console.warn("[/api/mypage/stats] subs select 실패:", subsRes.error.message)

  type SubsRow = { event_id: string; notification_enabled: boolean }
  const allSubs = (subsRes.data ?? []) as SubsRow[]
  const allEventIds = allSubs.map((s) => s.event_id)
  // notification_enabled=true 인 구독만 → eventsUpcoming 집계용
  const notifEventIds = allSubs.filter((s) => s.notification_enabled).map((s) => s.event_id)

  // Streak, Recipes, Phrases — 병렬 실행
  const [streakRes, recipesRes, phrasesRes] = await Promise.all([
    supabase.from("user_streaks").select("streak_days").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_food_collections").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("user_learning_progress").select("phrase_id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "mastered"),
  ])

  if (streakRes.error)  console.warn("[/api/mypage/stats] streak select 실패:", streakRes.error.message)
  if (recipesRes.error) console.warn("[/api/mypage/stats] recipes count 실패:", recipesRes.error.message)
  if (phrasesRes.error) console.warn("[/api/mypage/stats] phrases count 실패:", phrasesRes.error.message)

  // eventsUpcoming — notification_enabled=true + 미래 이벤트
  let eventsUpcoming = 0
  if (notifEventIds.length > 0) {
    const nowIso = new Date().toISOString()
    const { count, error } = await supabase
      .from("hallyu_calendar_events")
      .select("id", { count: "exact", head: true })
      .in("id", notifEventIds)
      .gte("event_date", nowIso)
    if (error) console.warn("[/api/mypage/stats] eventsUpcoming count 실패:", error.message)
    else eventsUpcoming = count ?? 0
  }

  // artistsTracking — ALL 구독 이벤트의 distinct non-null artist_or_drama 건수
  // /api/mypage/artists 반환 카드 수와 항상 일치 (kpop 매칭 불필요, 직접 집계)
  let artistsTracking = 0
  if (allEventIds.length > 0) {
    const eventsRes = await supabase
      .from("hallyu_calendar_events")
      .select("artist_or_drama")
      .in("id", allEventIds)
    if (eventsRes.error) {
      console.warn("[/api/mypage/stats] artistsTracking events 실패:", eventsRes.error.message)
    } else {
      type EventRow = { artist_or_drama: string | null }
      const nameSet = new Set<string>()
      for (const r of (eventsRes.data ?? []) as EventRow[]) {
        const n = r.artist_or_drama?.trim()
        if (n) nameSet.add(n)
      }
      artistsTracking = nameSet.size
    }
  }

  const streakRow = streakRes.data as { streak_days?: number } | null
  const stats: MyStats = {
    artistsTracking,
    eventsUpcoming,
    streakDays: streakRow?.streak_days ?? 0,
    savedRecipes: recipesRes.count ?? 0,
    masteredPhrases: phrasesRes.count ?? 0,
  }
  return NextResponse.json(stats)
}
