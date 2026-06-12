import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin/auth"

export const dynamic = "force-dynamic"

// PATCH /api/admin/community-feeds/[id] — { action: 'restore' | 'delete' }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: "unauthorized" }, { status: auth.reason === "unauthenticated" ? 401 : 403 })

  const { id } = await params
  let action: string
  try {
    const body = await req.json()
    action = body?.action
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()

  if (action === "restore") {
    const { error } = await admin
      .from("community_feeds")
      .update({ status: "published", report_count: 0, updated_at: new Date().toISOString() })
      .eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === "delete") {
    const { error } = await admin
      .from("community_feeds")
      .delete()
      .eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 })
}
