import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin/auth"

// PATCH /api/admin/korean/phrases/[id] — image_url null 로 삭제
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await context.params
  const body = await request.json() as { image_url?: string | null }
  if (!("image_url" in body)) {
    return NextResponse.json({ error: "image_url field required" }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase
    .from("korean_phrases")
    .update({ image_url: body.image_url ?? null })
    .eq("id", id)

  if (error) {
    console.error("[admin/korean/phrases PATCH] 업데이트 실패:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
