import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { verifyCronAuth } from "@/lib/cron/auth"

export const dynamic = "force-dynamic"
export const maxDuration = 300

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
  let cursor = 0

  for (const day of DAYS) {
    for (let slot = 0; slot < perDay; slot++) {
      const svc = active[cursor % active.length]
      const pool = ACTION_POOL[svc]
      const idx = (actionIdx[svc] ?? 0) % pool.length
      items.push({ day, service: svc, action: pool[idx].action, link: pool[idx].link })
      actionIdx[svc] = idx + 1
      cursor++
    }
  }

  return items
}

// 다음 주 월요일 날짜 (매주 일요일 23:00 UTC 에 실행 → +1일 = 다음 월요일)
function getNextWeekStart(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = d.getUTCDay()
  const diff = day === 0 ? 1 : 8 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

// 이번 주 월요일 날짜 (일요일 기준 → -6일)
function getThisWeekStart(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

// 이번 주 루틴 완전 완료 여부 (completedCount >= totalCount)
function isCompleted(
  completedItems: Record<string, boolean> | null,
  routineItems: RoutineItem[]
): boolean {
  if (!completedItems) return false
  const count = Object.values(completedItems).filter(Boolean).length
  return count >= routineItems.length
}

export async function POST(request: Request) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const admin = createSupabaseAdminClient()
  const now = new Date()
  const thisWeekStart = getThisWeekStart(now)
  const nextWeekStart = getNextWeekStart(now)

  // preferences 있는 사용자 전체 조회
  const { data: prefsList, error: prefsErr } = await admin
    .from("hallyu_routine_preferences")
    .select("user_id, interests, daily_minutes")

  if (prefsErr) {
    return NextResponse.json({ error: prefsErr.message }, { status: 500 })
  }

  let generated = 0
  let skipped = 0

  for (const prefs of prefsList ?? []) {
    const p = prefs as {
      user_id: string
      interests: string[]
      daily_minutes: number
    }

    // 1. 이번 주 완료 여부로 스트릭 계산
    const { data: thisWeekRow } = await admin
      .from("hallyu_routines")
      .select("completed_items, routine_items, streak_count")
      .eq("user_id", p.user_id)
      .eq("week_start", thisWeekStart)
      .maybeSingle()

    const prevStreak = (thisWeekRow as { streak_count?: number } | null)?.streak_count ?? 0
    const completed = isCompleted(
      (thisWeekRow as { completed_items?: Record<string, boolean> } | null)?.completed_items ?? null,
      (thisWeekRow as { routine_items?: RoutineItem[] } | null)?.routine_items ?? []
    )
    const newStreak = completed ? prevStreak + 1 : 0

    // 2. 다음 주 루틴 멱등성 체크
    const { data: nextExisting } = await admin
      .from("hallyu_routines")
      .select("id")
      .eq("user_id", p.user_id)
      .eq("week_start", nextWeekStart)
      .maybeSingle()

    if (nextExisting) {
      skipped++
      continue
    }

    // 3. 다음 주 루틴 생성
    const routineItems = generateRoutineItems(p.interests, p.daily_minutes)
    await admin.from("hallyu_routines").insert({
      user_id: p.user_id,
      week_start: nextWeekStart,
      routine_items: routineItems,
      completed_items: {},
      streak_count: newStreak,
    })
    generated++
  }

  return NextResponse.json({
    ok: true,
    nextWeekStart,
    generated,
    skipped,
    total: (prefsList ?? []).length,
  })
}
