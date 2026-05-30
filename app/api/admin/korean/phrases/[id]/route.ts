import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin/auth"

// PATCH /api/admin/korean/phrases/[id] — image_url / scene_description 업데이트
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await context.params
  const body = await request.json() as { image_url?: string | null; scene_description?: string | null }

  const update: Record<string, string | null> = {}
  if ("image_url" in body) update.image_url = body.image_url ?? null
  if ("scene_description" in body) update.scene_description = body.scene_description ?? null

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "업데이트할 필드 없음" }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase
    .from("korean_phrases")
    .update(update)
    .eq("id", id)

  if (error) {
    console.error("[admin/korean/phrases PATCH] 업데이트 실패:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
