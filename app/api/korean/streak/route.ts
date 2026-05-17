import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { diffSeoulDays, getSeoulDateString } from "@/lib/korean/day-helpers"

// /api/korean/streak — 학습 연속일
//
// GET:  현재 유저의 streak_days + last_studied_date 반환 (비로그인은 0)
// POST: 오늘 학습 완료 시 streak 업데이트 (Asia/Seoul 기준)
//   규칙:
//     - last_studied_date 없음           → streak_days = 1
//     - last_studied_date == 오늘        → 변경 없음 (이미 오늘 학습)
//     - last_studied_date == 어제 (+1)   → streak_days + 1
//     - 그 외 (이틀+ 공백 또는 미래 날짜) → streak_days = 1 (리셋)
//   모든 경우 last_studied_date = 오늘 으로 갱신.

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ streakDays: 0, lastStudiedDate: null })
  }

  const { data, error } = await supabase
    .from("user_streaks")
    .select("streak_days, last_studied_date")
    .eq("user_id", user.id)
    .maybeSingle()
  if (error) {
    return NextResponse.json(
      { error: "query_failed", message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    streakDays: data?.streak_days ?? 0,
    lastStudiedDate: data?.last_studied_date ?? null,
  })
}

export async function POST() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  const today = getSeoulDateString()

  // 1. 현재 row 조회 (없으면 새로 생성)
  const { data: existing, error: selErr } = await supabase
    .from("user_streaks")
    .select("streak_days, last_studied_date")
    .eq("user_id", user.id)
    .maybeSingle()
  if (selErr) {
    return NextResponse.json(
      { error: "query_failed", message: selErr.message },
      { status: 500 }
    )
  }

  let nextStreakDays = 1
  if (existing) {
    const last = (existing as { last_studied_date: string | null }).last_studied_date
    const current = (existing as { streak_days: number }).streak_days ?? 0
    if (last === today) {
      // 오늘 이미 학습 — 변경 없음
      return NextResponse.json({
        streakDays: current,
        lastStudiedDate: today,
        unchanged: true,
      })
    }
    if (last) {
      const diff = diffSeoulDays(last, today) // last 가 today 보다 과거 → 양수
      if (diff === 1) nextStreakDays = current + 1
      else nextStreakDays = 1 // 이틀+ 공백 또는 미래(시계 오류)
    } else {
      nextStreakDays = 1
    }
  }

  // 2. upsert — user_id unique 라 ON CONFLICT 안전
  const { error: upErr } = await supabase
    .from("user_streaks")
    .upsert(
      {
        user_id: user.id,
        streak_days: nextStreakDays,
        last_studied_date: today,
      },
      { onConflict: "user_id" }
    )
  if (upErr) {
    console.error("[/api/korean/streak POST] upsert 실패:", upErr)
    return NextResponse.json(
      { error: "upsert_failed", message: upErr.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    streakDays: nextStreakDays,
    lastStudiedDate: today,
    unchanged: false,
  })
}
