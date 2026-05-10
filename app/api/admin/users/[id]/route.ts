import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// 유저 plan_type / is_admin 변경 — 관리자 전용.
//
// ⚠️ plan_type 변경 시 subscription_status 도 자동 동기화해야 RLS 정책이 정상 통과됨.
//    캘린더 events_select_premium_paid 정책이 (plan_type IN ('monthly','annual')
//    AND subscription_status='active') 조건이라, plan_type 만 바꾸고 status 가
//    'pending'/'canceled'/null 로 남으면 어드민이 수동 부여한 Pro 유저가 premium
//    이벤트를 못 봄 (2026-05-10 인시던트).
//
// 자동 동기화 규칙:
//   plan_type='monthly' | 'annual' → subscription_status='active'
//   plan_type='free'               → subscription_status='canceled'
const PatchSchema = z.object({
  plan_type: z.enum(["free", "monthly", "annual"]).optional(),
  is_admin: z.boolean().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "unauthenticated" ? 401 : 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // 변경할 필드가 하나도 없으면 400
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "변경 필드가 없습니다." }, { status: 400 })
  }

  // plan_type 동반 변경 시 subscription_status 자동 동기화 — RLS 일관성 보장
  const update: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.plan_type === "monthly" || parsed.data.plan_type === "annual") {
    update.subscription_status = "active"
  } else if (parsed.data.plan_type === "free") {
    update.subscription_status = "canceled"
  }

  // RLS는 admin 정책이 통과시키지만, service_role로 처리해 정책 평가 비용 절감 + 명확성
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("users")
    .update(update)
    .eq("id", id)
    .select("id, email, plan_type, subscription_status, is_admin")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ user: data })
}
