import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// /api/food/restaurants — KfoodKit "Find it in Korea" 섹션 데이터
//
// tour_spots(content_type_id=39, 음식점) 에서 food_name 키워드 검색.
// title (식당명) + overview_ko (메뉴·소개) ILIKE OR 매칭 — 한국어 음식명 그대로.
// area_code 옵션 필터 (광역시도 단위).
//
// 공개 API — Pro 게이팅은 UI 측 Google Maps 링크에만.

export const dynamic = "force-dynamic"

const RESTAURANT_CONTENT_TYPE_ID = 39

const QuerySchema = z.object({
  food_name: z.string().trim().min(1).max(80),
  area_code: z.coerce.number().int().min(1).max(39).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(3),
})

export interface RestaurantItem {
  id: string
  title: string
  eng_title: string | null
  addr1: string | null
  image_url: string | null
  overview_en: string | null
  latitude: number | null
  longitude: number | null
  homepage: string | null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_query", issues: parsed.error.issues },
      { status: 400 }
    )
  }
  const { food_name, area_code, limit } = parsed.data

  const supabase = await createSupabaseServerClient()
  // ILIKE pattern — % 와 _ 는 와일드카드라 사용자 입력에서 제거 (escape 대신 strip).
  const pattern = `%${food_name.replace(/[%_]/g, "")}%`

  let query = supabase
    .from("tour_spots")
    .select(
      "id, title, eng_title, addr1, image_url, overview_en, latitude, longitude, homepage",
      { count: "exact" }
    )
    .eq("content_type_id", RESTAURANT_CONTENT_TYPE_ID)
    .or(`title.ilike.${pattern},overview_ko.ilike.${pattern}`)
    .order("image_url", { ascending: false, nullsFirst: false })   // 이미지 있는 곳 우선
    .limit(limit)

  if (area_code !== undefined) {
    query = query.eq("area_code", area_code)
  }

  const { data, error, count } = await query
  if (error) {
    console.error("[/api/food/restaurants] 조회 실패:", error)
    return NextResponse.json(
      { error: "query_failed", message: error.message, code: error.code },
      { status: 500 }
    )
  }

  type Row = {
    id: string
    title: string
    eng_title: string | null
    addr1: string | null
    image_url: string | null
    overview_en: string | null
    latitude: number | string | null
    longitude: number | string | null
    homepage: string | null
  }
  // numeric(10,7) 컬럼은 PostgREST 가 문자열로 반환 — Number 변환 + NaN 가드.
  const items: RestaurantItem[] = ((data ?? []) as Row[]).map((r) => {
    const lat = r.latitude === null ? null : Number(r.latitude)
    const lng = r.longitude === null ? null : Number(r.longitude)
    return {
      id: r.id,
      title: r.title,
      eng_title: r.eng_title,
      addr1: r.addr1,
      image_url: r.image_url,
      overview_en: r.overview_en,
      latitude: lat !== null && Number.isFinite(lat) ? lat : null,
      longitude: lng !== null && Number.isFinite(lng) ? lng : null,
      homepage: r.homepage,
    }
  })

  return NextResponse.json({ items, total: count ?? items.length })
}
