import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// /api/mypage/stats — 대시보드 4개 stat 카운트
//
// 응답: { artistsTracking, eventsUpcoming, streakDays, savedRecipes, masteredPhrases }
// 모두 로그인 사용자 본인 데이터. RLS 가 본인 행만 노출.
//
// eventsUpcoming: 구독 이벤트 중 오늘 이후 (UTC) 건수.
//   이전 "eventsThisMonth" 는 track API 가 미래 이벤트만 구독 (>= now) 하기 때문에
//   당월 필터 시 항상 0이 나오는 구조적 문제 → 전체 upcoming 으로 변경.
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

  // 1+2. Artists Tracking + Upcoming Events
  const subsP = supabase
    .from("user_calendar_subscriptions")
    .select("event_id")
    .eq("user_id", user.id)

  // 3. Streak (Continue Learning progress bar 용)
  const streakP = supabase
    .from("user_streaks")
    .select("streak_days")
    .eq("user_id", user.id)
    .maybeSingle()

  // 4. Saved Recipes
  const recipesP = supabase
    .from("user_food_collections")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)

  // 5. Mastered Phrases (Korean Lessons 카드)
  const phrasesP = supabase
    .from("user_learning_progress")
    .select("phrase_id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "mastered")

  const [subsRes, streakRes, recipesRes, phrasesRes] = await Promise.all([
    subsP,
    streakP,
    recipesP,
    phrasesP,
  ])

  if (subsRes.error)    console.warn("[/api/mypage/stats] subs select 실패:", subsRes.error.message)
  if (streakRes.error)  console.warn("[/api/mypage/stats] streak select 실패:", streakRes.error.message)
  if (recipesRes.error) console.warn("[/api/mypage/stats] recipes count 실패:", recipesRes.error.message)
  if (phrasesRes.error) console.warn("[/api/mypage/stats] phrases count 실패:", phrasesRes.error.message)

  let artistsTracking = 0
  let eventsUpcoming = 0
  type SubsRow = { event_id: string }
  const eventIds = ((subsRes.data ?? []) as SubsRow[])
    .map((s) => s.event_id)
    .filter((id) => typeof id === "string")

  if (eventIds.length > 0) {
    const nowIso = new Date().toISOString()
    const eventsRes = await supabase
      .from("hallyu_calendar_events")
      .select("id, artist_or_drama, event_date")
      .in("id", eventIds)
      .gte("event_date", nowIso)   // upcoming 만 카운트 (DB 레벨 필터)
    if (eventsRes.error) {
      console.warn("[/api/mypage/stats] events select 실패:", eventsRes.error.message)
    } else {
      type EventRow = { id: string; artist_or_drama: string | null; event_date: string }
      const rows = (eventsRes.data ?? []) as EventRow[]

      const artistSet = new Set<string>()
      for (const r of rows) {
        const name = r.artist_or_drama?.trim()
        if (name) artistSet.add(name)
      }
      artistsTracking = artistSet.size
      eventsUpcoming = rows.length
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
