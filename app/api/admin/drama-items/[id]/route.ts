import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// PATCH /api/admin/drama-items/[id]
// body: { is_approved?, purchase_url? }

const PatchSchema = z.object({
  is_approved: z.boolean().optional(),
  purchase_url: z.string().trim().url().max(2000).nullable().optional(),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "unauthenticated" ? 401 : 403 })
  }

  const { id } = await context.params
  if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }

  let raw: unknown
  try { raw = await request.json() } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 })
  }

  const payload: Record<string, unknown> = {}
  if (parsed.data.is_approved !== undefined) payload.is_approved = parsed.data.is_approved
  if (parsed.data.purchase_url !== undefined) payload.purchase_url = parsed.data.purchase_url

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const { error } = await admin.from("drama_items").update(payload).eq("id", id)
  if (error) {
    console.error("[admin/drama-items/[id]] update 실패:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/drama-items/[id]
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "unauthenticated" ? 401 : 403 })
  }

  const { id } = await context.params
  if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const { error } = await admin.from("drama_items").delete().eq("id", id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
