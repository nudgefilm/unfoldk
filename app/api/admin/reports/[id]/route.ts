import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// PATCH /api/admin/reports/[id] — 신고 status 변경 (관리자 전용)
//   - reviewed: 처리 완료 (어드민이 콘텐츠 수정/삭제 후)
//   - dismissed: 기각 (문제 없다고 판단)

const PatchSchema = z.object({
  status: z.enum(["reviewed", "dismissed"]),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.reason },
      { status: auth.reason === "unauthenticated" ? 401 : 403 }
    )
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("content_reports")
    .update({
      status: parsed.data.status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.userId,
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ report: data })
}
