import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { hasProAccess } from "@/lib/auth/plan"

export const dynamic = "force-dynamic"

// 이번 주 월요일 날짜 반환 (UTC)
function getWeekStart(): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

// GET: 루틴 환경설정 존재 여부 + 이번 주 루틴 반환
export async function GET() {
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

  const admin = createSupabaseAdminClient()
  const weekStart = getWeekStart()

  const [prefsResult, routineResult] = await Promise.all([
    admin
      .from("hallyu_routine_preferences")
      .select("id, interests, daily_minutes")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("hallyu_routines")
      .select("id, routine_items, completed_items, streak_count, week_start")
      .eq("user_id", user.id)
      .eq("week_start", weekStart)
      .maybeSingle(),
  ])

  return NextResponse.json({
    hasPrefs: !!prefsResult.data,
    routine: routineResult.data ?? null,
  })
}

// PATCH: 특정 아이템 완료 토글
export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json()) as {
    routine_id: string
    item_index: number
    completed: boolean
  }

  const admin = createSupabaseAdminClient()

  const { data: row } = await admin
    .from("hallyu_routines")
    .select("completed_items")
    .eq("id", body.routine_id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!row) return NextResponse.json({ error: "Routine not found" }, { status: 404 })

  const existing = (row as { completed_items?: Record<string, boolean> }).completed_items ?? {}
  const updated = { ...existing }
  if (body.completed) {
    updated[String(body.item_index)] = true
  } else {
    delete updated[String(body.item_index)]
  }

  await admin
    .from("hallyu_routines")
    .update({ completed_items: updated })
    .eq("id", body.routine_id)

  return NextResponse.json({ ok: true, completed_items: updated })
}
