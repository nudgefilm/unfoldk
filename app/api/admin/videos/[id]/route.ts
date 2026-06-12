import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// PATCH /api/admin/videos/[id] — status 변경 (어드민 전용)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "unauthenticated" ? 401 : 403 })
  }

  const { id } = await params

  let body: { status?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 })
  }

  const { status } = body
  if (!status || !["published", "rejected", "pending"].includes(status)) {
    return NextResponse.json({ error: "status 는 published | rejected | pending 중 하나" }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const { error } = await admin
    .from("youtube_videos")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/videos/[id] — 완전 삭제 (어드민 전용)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "unauthenticated" ? 401 : 403 })
  }

  const { id } = await params
  const admin = createSupabaseAdminClient()
  const { error } = await admin.from("youtube_videos").delete().eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
