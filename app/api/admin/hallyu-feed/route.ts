import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// GET /api/admin/hallyu-feed?category=&limit=50&offset=0
// 어드민 전용 — service_role 키로 RLS 우회
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category  = searchParams.get("category")
  const limit     = Math.min(Number(searchParams.get("limit") ?? "50"), 100)
  const offset    = Number(searchParams.get("offset") ?? "0")
  const countOnly = searchParams.get("count_only") === "true"

  const admin = createSupabaseAdminClient()

  let query = admin
    .from("hallyu_news")
    .select(
      "id, source, title, url, thumbnail_url, image_url, published_at, category, summary, sources, related_artist, content_type",
      { count: countOnly ? "exact" : undefined, head: countOnly },
    )
    .order("published_at", { ascending: false })

  if (category) query = query.eq("category", category)

  if (countOnly) {
    const { count, error } = await query
    if (error) return NextResponse.json({ count: 0 })
    return NextResponse.json({ count: count ?? 0 })
  }

  const { data, error } = await query.range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ news: data ?? [], limit, offset })
}

// PATCH /api/admin/hallyu-feed — hallyu_news.image_url 업데이트
export async function PATCH(req: NextRequest) {
  const admin = createSupabaseAdminClient()
  const body = await req.json() as { id?: string; image_url?: string }
  if (!body.id || !body.image_url) return NextResponse.json({ error: "missing_fields" }, { status: 400 })
  const { error } = await admin.from("hallyu_news").update({ image_url: body.image_url }).eq("id", body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
