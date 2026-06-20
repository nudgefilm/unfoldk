import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { hasProAccess } from "@/lib/auth/plan"

export const dynamic = "force-dynamic"

// 서비스별 액션 풀 (day·service·action·link 구조)
const ACTION_POOL: Record<string, { action: string; link: string }[]> = {
  kpop: [
    { action: "Check this week's K-pop chart", link: "/kpop" },
    { action: "Explore a rising K-pop artist", link: "/kpop" },
    { action: "See who's gaining listeners this week", link: "/kpop" },
    { action: "Listen to a track from the Top 10", link: "/kpop" },
  ],
  kdrama: [
    { action: "Watch an episode of your current drama", link: "/drama" },
    { action: "Discover a new K-drama to watch", link: "/drama" },
    { action: "Check what's airing this week", link: "/drama" },
    { action: "Browse the top-rated dramas right now", link: "/drama" },
  ],
  korean: [
    { action: "Learn 3 new Korean expressions", link: "/korean" },
    { action: "Practice today's Korean phrase", link: "/korean" },
    { action: "Review grammar from a K-drama scene", link: "/korean" },
    { action: "Try using a new phrase in context", link: "/korean" },
  ],
  kfood: [
    { action: "Explore a new K-food recipe", link: "/food" },
    { action: "Find local substitutes for K-food ingredients", link: "/food" },
    { action: "Browse this week's Korean food picks", link: "/food" },
    { action: "Try cooking a simple Korean dish", link: "/food" },
  ],
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

interface RoutineItem {
  day: string
  service: string
  action: string
  link: string
}

// daily_minutes → 하루 항목 수
function itemsPerDay(minutes: number): number {
  if (minutes <= 5) return 1
  if (minutes <= 15) return 2
  return 3
}

function generateRoutineItems(interests: string[], dailyMinutes: number): RoutineItem[] {
  const perDay = itemsPerDay(dailyMinutes)
  const active = interests.filter((i) => ACTION_POOL[i])
  if (active.length === 0) return []

  const actionIdx: Record<string, number> = {}
  const items: RoutineItem[] = []
  let interestCursor = 0

  for (const day of DAYS) {
    for (let slot = 0; slot < perDay; slot++) {
      const svc = active[interestCursor % active.length]
      const pool = ACTION_POOL[svc]
      const idx = (actionIdx[svc] ?? 0) % pool.length
      items.push({ day, service: svc, action: pool[idx].action, link: pool[idx].link })
      actionIdx[svc] = idx + 1
      interestCursor++
    }
  }

  return items
}

// 이번 주 월요일 날짜 반환 (UTC)
function getWeekStart(): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

// POST: preferences 저장(선택) + 이번 주 루틴 생성
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("plan_type, trial_ends_at, is_admin")
    .eq("id", user.id)
    .single()

  const p = profile as { plan_type?: string; trial_ends_at?: string; is_admin?: boolean } | null
  if (!hasProAccess({ planType: p?.plan_type, trialEndsAt: p?.trial_ends_at, isAdmin: p?.is_admin })) {
    return NextResponse.json({ error: "Pro access required" }, { status: 403 })
  }

  // body 파싱 (온보딩 제출 시 interests+daily_minutes 포함, 자동 갱신 시 빈 body)
  let body: { interests?: string[]; daily_minutes?: number } = {}
  try {
    body = await request.json()
  } catch {
    /* empty body — 기존 preferences 사용 */
  }

  const admin = createSupabaseAdminClient()
  const weekStart = getWeekStart()

  // 1. preferences 저장 (온보딩 데이터 제공 시)
  if (body.interests?.length && body.daily_minutes) {
    await admin.from("hallyu_routine_preferences").upsert(
      {
        user_id: user.id,
        interests: body.interests,
        daily_minutes: body.daily_minutes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
  }

  // 2. preferences 확정 (body 우선 → DB fallback)
  let interests = body.interests
  let dailyMinutes = body.daily_minutes

  if (!interests?.length || !dailyMinutes) {
    const { data: prefs } = await admin
      .from("hallyu_routine_preferences")
      .select("interests, daily_minutes")
      .eq("user_id", user.id)
      .maybeSingle()
    const pp = prefs as { interests?: string[]; daily_minutes?: number } | null
    interests = pp?.interests ?? ["kpop"]
    dailyMinutes = pp?.daily_minutes ?? 15
  }

  // 3. 멱등성 — 이번 주 루틴 이미 있으면 반환
  const { data: existing } = await admin
    .from("hallyu_routines")
    .select("id, routine_items, completed_items, streak_count, week_start")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true, routine: existing })
  }

  // 4. 루틴 생성 + 저장
  const routineItems = generateRoutineItems(interests, dailyMinutes)
  const { data: newRoutine, error } = await admin
    .from("hallyu_routines")
    .insert({
      user_id: user.id,
      week_start: weekStart,
      routine_items: routineItems,
      completed_items: {},
      streak_count: 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, routine: newRoutine })
}
