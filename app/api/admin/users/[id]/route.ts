import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// 유저 plan_type / is_admin 변경 — 관리자 전용
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

  // RLS는 admin 정책이 통과시키지만, service_role로 처리해 정책 평가 비용 절감 + 명확성
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("users")
    .update(parsed.data)
    .eq("id", id)
    .select("id, email, plan_type, is_admin")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ user: data })
}
