import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// GET /api/admin/drama-items — 전체 drama_items 목록 (drama 제목 포함, 어드민 전용)
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "unauthenticated" ? 401 : 403 })
  }

  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from("drama_items")
    .select("id, drama_id, name, name_ko, category, brand, description, description_ko, purchase_url, is_approved, created_at, dramas(title, title_ko)")
    .order("is_approved", { ascending: true })
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const items = (data ?? []).map((row) => ({
    id: row.id,
    drama_id: row.drama_id,
    drama_title: (row.dramas as { title: string; title_ko: string | null } | null)?.title ?? "—",
    drama_title_ko: (row.dramas as { title: string; title_ko: string | null } | null)?.title_ko ?? null,
    name: row.name,
    name_ko: row.name_ko ?? null,
    category: row.category,
    brand: row.brand,
    description: row.description,
    description_ko: row.description_ko ?? null,
    purchase_url: row.purchase_url,
    is_approved: row.is_approved,
    created_at: row.created_at,
  }))

  return NextResponse.json({ items })
}
