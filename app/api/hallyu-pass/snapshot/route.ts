import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { hasProAccess } from "@/lib/auth/plan"

export const dynamic = "force-dynamic"

// 이번 주 월요일 ~ 다음 주 월요일 ISO 문자열 반환 (UTC)
function getWeekBounds(): { weekStart: string; weekEnd: string } {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day))
  const weekStart = d.toISOString()
  const weekEnd = new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
  return { weekStart, weekEnd }
}

// GET: 위클리 스냅샷 통계 일괄 반환
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
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

  const admin = createSupabaseAdminClient()
  const { weekStart, weekEnd } = getWeekBounds()

  const [eventsRes, streakRes, recipesRes, countriesRes] = await Promise.all([
    // 이번 주 캘린더 이벤트 수 (전체, RLS 우회)
    admin
      .from("hallyu_calendar_events")
      .select("id", { count: "exact", head: true })
      .gte("event_date", weekStart)
      .lt("event_date", weekEnd),
    // 학습 연속일
    supabase
      .from("user_streaks")
      .select("streak_days")
      .eq("user_id", user.id)
      .maybeSingle(),
    // 저장 레시피 수
    supabase
      .from("user_food_collections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    // 팬 국가 집계 (글로벌)
    admin
      .from("users")
      .select("country")
      .not("country", "is", null),
  ])

  // 국가 집계 → 상위 4 + Others
  const counts = new Map<string, number>()
  for (const row of ((countriesRes.data ?? []) as Array<{ country: string | null }>)) {
    const c = row.country?.toUpperCase()
    if (!c || c.length !== 2) continue
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  const top4 = sorted.slice(0, 4).map(([country, count]) => ({ country, count }))
  const othersCount = sorted.slice(4).reduce((s, [, c]) => s + c, 0)
  const fanCountries = othersCount > 0
    ? [...top4, { country: "Others", count: othersCount }]
    : top4

  return NextResponse.json({
    this_week_events: eventsRes.count ?? 0,
    learning_streak: (streakRes.data as { streak_days: number } | null)?.streak_days ?? 0,
    saved_recipes: recipesRes.count ?? 0,
    fan_countries: fanCountries,
    total_countries: counts.size,
  })
}
