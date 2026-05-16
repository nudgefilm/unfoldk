import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// /api/curation-k/filming-spots — 촬영지 카드 그리드
//
// 쿼리:
//   ?drama=<title 부분일치>  (선택, drama_title ilike)
//   ?region=<지역>           (선택)
//   ?limit=20                (기본 20, max 100)
//   ?offset=0
//
// RLS: status='confirmed' 만 자동 노출. 더미 row(__no_spots_found__) 제외.

export const revalidate = 600

const QuerySchema = z.object({
  drama: z.string().trim().max(120).optional(),
  region: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(2000).default(0),
})

export async function GET(request: Request) {
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    drama: url.searchParams.get("drama") ?? undefined,
    region: url.searchParams.get("region") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { drama, region, limit, offset } = parsed.data

  const supabase = await createSupabaseServerClient()
  let query = supabase
    .from("filming_spots")
    .select(
      "id, drama_id, drama_title, spot_name, region, address, latitude, longitude, image_url, confidence",
      { count: "exact" }
    )
    .neq("spot_name", "__no_spots_found__")
    .order("confidence", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (drama) {
    const safeQ = drama.replace(/[%_,()*]/g, "")
    query = query.ilike("drama_title", `%${safeQ}%`)
  }
  if (region) query = query.eq("region", region)

  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) {
    console.error("[curation-k/filming-spots] 조회 실패:", error.message)
    return NextResponse.json({ error: "query_failed" }, { status: 500 })
  }

  return NextResponse.json(
    { items: data ?? [], total: count ?? null, limit, offset },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } }
  )
}
