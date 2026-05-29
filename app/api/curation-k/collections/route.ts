import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// /api/curation-k/collections — Curation K 저장 장소 CRUD
//
// GET    → 저장 목록 (filming_spots / tour_spots 조인)
// POST   → 저장 { item_type: 'filming'|'tour', item_id: uuid }
// DELETE → 삭제 ?item_type=...&item_id=...
//
// DB: user_curation_collections (0049 migration)
// RLS: user_curation_collections_all_own (본인 행만)

export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f-]{36}$/i

const PostSchema = z.object({
  item_type: z.enum(["filming", "tour"]),
  item_id: z.string().uuid(),
})

const CONTENT_TYPE_LABEL: Record<number, string> = {
  12: "Attraction",
  14: "Culture",
  15: "Festival",
  32: "Stay",
  39: "Restaurant",
  85: "Shopping",
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  const { data: rows, error } = await supabase
    .from("user_curation_collections")
    .select("id, item_type, item_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.warn("[curation-k/collections GET] 실패:", error.message)
    return NextResponse.json({ items: [] })
  }
  if (!rows?.length) return NextResponse.json({ items: [] })

  type CollRow = { id: string; item_type: string; item_id: string; created_at: string }
  const allRows = rows as CollRow[]

  const filmingIds = allRows.filter(r => r.item_type === "filming").map(r => r.item_id)
  const tourIds    = allRows.filter(r => r.item_type === "tour").map(r => r.item_id)

  const [filmingRes, tourRes] = await Promise.all([
    filmingIds.length > 0
      ? supabase.from("filming_spots").select("id, spot_name, image_url, drama_title, address, region").in("id", filmingIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    tourIds.length > 0
      ? supabase.from("tour_spots").select("id, eng_title, title, image_url, addr1, content_type_id").in("id", tourIds)
      : Promise.resolve({ data: [] as unknown[], error: null }),
  ])

  type FilmRow = { id: string; spot_name: string; image_url: string | null; drama_title: string | null; address: string | null; region: string | null }
  type TourRow  = { id: string; eng_title: string | null; title: string; image_url: string | null; addr1: string | null; content_type_id: number | null }

  const filmMap = new Map<string, FilmRow>((filmingRes.data as FilmRow[]).map(s => [s.id, s]))
  const tourMap = new Map<string, TourRow>((tourRes.data as TourRow[]).map(s => [s.id, s]))

  const items = allRows.map(row => {
    if (row.item_type === "filming") {
      const s = filmMap.get(row.item_id)
      return {
        collection_id: row.id,
        item_type: row.item_type,
        item_id: row.item_id,
        created_at: row.created_at,
        title: s?.spot_name ?? "Filming spot",
        image_url: s?.image_url ?? null,
        badge: s?.drama_title ?? null,
        address: s?.address ?? null,
        region: s?.region ?? null,
      }
    }
    const s = tourMap.get(row.item_id)
    const ctid = s?.content_type_id ?? null
    return {
      collection_id: row.id,
      item_type: row.item_type,
      item_id: row.item_id,
      created_at: row.created_at,
      title: s?.eng_title ?? s?.title ?? "Place",
      image_url: s?.image_url ?? null,
      badge: ctid !== null ? (CONTENT_TYPE_LABEL[ctid] ?? null) : null,
      address: s?.addr1 ?? null,
      region: null,
    }
  })

  return NextResponse.json({ items })
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }) }

  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  const { item_type, item_id } = parsed.data

  const { data, error } = await supabase
    .from("user_curation_collections")
    .upsert(
      { user_id: user.id, item_type, item_id },
      { onConflict: "user_id,item_type,item_id" }
    )
    .select("id, item_type, item_id, created_at")
    .single()

  if (error) {
    console.warn("[curation-k/collections POST] 실패:", error.message)
    return NextResponse.json({ error: "insert_failed" }, { status: 500 })
  }
  return NextResponse.json({ ok: true, item: data })
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  const url = new URL(request.url)
  const itemType = url.searchParams.get("item_type")
  const itemId   = url.searchParams.get("item_id")
  if (!itemType || !itemId || !UUID_RE.test(itemId)) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 })
  }

  const { error } = await supabase
    .from("user_curation_collections")
    .delete()
    .eq("user_id", user.id)
    .eq("item_type", itemType)
    .eq("item_id", itemId)

  if (error) {
    console.warn("[curation-k/collections DELETE] 실패:", error.message)
    return NextResponse.json({ error: "delete_failed" }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
