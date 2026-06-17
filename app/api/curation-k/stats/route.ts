import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// /api/curation-k/stats — Curation K 지도 통계 오버레이용
//
// 전역 카운트 (head:true count, 행 fetch 없음) + 지역별 (area_code) breakdown.
// byRegion 은 6 카테고리 전체 분리 — 17 광역시도 hover 툴팁에서 사용.
//
// ⚠️ PostgREST 기본 limit=1000 이라 `.select(...)` 만 쓰면 row 가 잘림 (Food=0 버그
//    원인). 본 라우트는 (a) 전역 카운트는 head:true 로 받고 (b) byRegion 은 1000건씩
//    페이지네이션. 캡: 50,000 row.
//
// 응답:
//   { total, filming, attractions, culture, festivals, stays, food,
//     byRegion: { [area_code]: { filming, attractions, culture, festivals, stays, food } } }

export const dynamic = "force-dynamic"

type CategoryKey = "filming" | "attractions" | "culture" | "festivals" | "stays" | "food" | "shopping"

const TOUR_TYPE_TO_KEY: Record<number, CategoryKey> = {
  12: "attractions",
  14: "culture",
  15: "festivals",
  32: "stays",
  38: "shopping",
  39: "food",
}

interface RegionBreakdown {
  filming: number
  attractions: number
  culture: number
  festivals: number
  stays: number
  food: number
  shopping: number
}

function emptyBreakdown(): RegionBreakdown {
  return { filming: 0, attractions: 0, culture: 0, festivals: 0, stays: 0, food: 0, shopping: 0 }
}

// filming_spots.region 텍스트 → area_code 매핑 (필요한 area_code 만 등록)
const REGION_LABEL_TO_AREA: Record<string, number> = {
  Seoul: 1,
  Incheon: 2,
  Daejeon: 3,
  Daegu: 4,
  Gwangju: 5,
  Busan: 6,
  Ulsan: 7,
  Sejong: 8,
  Gyeonggi: 31,
  Gangwon: 32,
  Chungbuk: 33,
  Chungcheongbuk: 33,
  Chungnam: 34,
  Chungcheongnam: 34,
  Chungcheong: 34,
  Gyeongbuk: 35,
  Gyeongsangbuk: 35,
  Gyeongnam: 36,
  Gyeongsangnam: 36,
  Gyeongsang: 36,
  Jeonbuk: 37,
  Jeollabuk: 37,
  Jeonnam: 38,
  Jeollanam: 38,
  Jeolla: 38,
  Jeju: 39,
}

const PAGE = 1000
const MAX_PAGES = 50 // 50,000 row cap

export async function GET() {
  const supabase = await createSupabaseServerClient()

  // ─── 1) 전역 카운트 (head:true — 행 페이로드 없음) ─────────
  const counts: Record<CategoryKey, number> = {
    filming: 0,
    attractions: 0,
    culture: 0,
    festivals: 0,
    stays: 0,
    food: 0,
    shopping: 0,
  }
  const errors: string[] = []

  const filmingCountPromise = supabase
    .from("filming_spots")
    .select("id", { count: "exact", head: true })
    .neq("spot_name", "__no_spots_found__")

  const tourCountPromises = (Object.entries(TOUR_TYPE_TO_KEY) as Array<[
    string,
    CategoryKey,
  ]>).map(async ([typeIdStr, key]) => {
    const typeId = Number(typeIdStr)
    const { count, error } = await supabase
      .from("tour_spots")
      .select("id", { count: "exact", head: true })
      .eq("content_type_id", typeId)
    if (error) errors.push(`tour count ${key}: ${error.message}`)
    return [key, count ?? 0] as const
  })

  const [{ count: filmCount, error: filmCountErr }, ...tourCountResults] =
    await Promise.all([filmingCountPromise, ...tourCountPromises])

  if (filmCountErr) errors.push(`filming count: ${filmCountErr.message}`)
  counts.filming = filmCount ?? 0
  for (const result of tourCountResults) {
    if (Array.isArray(result)) {
      const [key, c] = result
      counts[key] = c
    }
  }

  // ─── 2) byRegion — tour_spots 페이지네이션 ─────────────────
  const byRegion: Record<string, RegionBreakdown> = {}

  type TourRegionRow = { content_type_id: number; area_code: number | null }
  for (let pageNo = 0; pageNo < MAX_PAGES; pageNo++) {
    const from = pageNo * PAGE
    const to = from + PAGE - 1
    const { data, error } = await supabase
      .from("tour_spots")
      .select("content_type_id, area_code")
      .not("area_code", "is", null)
      .range(from, to)
    if (error) {
      errors.push(`tour byRegion p${pageNo}: ${error.message}`)
      break
    }
    const rows = (data ?? []) as TourRegionRow[]
    for (const row of rows) {
      const key = TOUR_TYPE_TO_KEY[row.content_type_id]
      if (!key) continue
      if (row.area_code === null) continue
      const ar = String(row.area_code)
      if (!byRegion[ar]) byRegion[ar] = emptyBreakdown()
      byRegion[ar][key]++
    }
    if (rows.length < PAGE) break
  }

  // ─── 3) byRegion — filming_spots 페이지네이션 (region 텍스트 매핑) ──
  type FilmingRegionRow = { region: string | null }
  for (let pageNo = 0; pageNo < MAX_PAGES; pageNo++) {
    const from = pageNo * PAGE
    const to = from + PAGE - 1
    const { data, error } = await supabase
      .from("filming_spots")
      .select("region")
      .neq("spot_name", "__no_spots_found__")
      .range(from, to)
    if (error) {
      errors.push(`filming byRegion p${pageNo}: ${error.message}`)
      break
    }
    const rows = (data ?? []) as FilmingRegionRow[]
    for (const row of rows) {
      const label = row.region?.trim()
      if (!label) continue
      const code = REGION_LABEL_TO_AREA[label]
      if (code === undefined) continue
      const ar = String(code)
      if (!byRegion[ar]) byRegion[ar] = emptyBreakdown()
      byRegion[ar].filming++
    }
    if (rows.length < PAGE) break
  }

  const total =
    counts.filming +
    counts.attractions +
    counts.culture +
    counts.festivals +
    counts.stays +
    counts.food +
    counts.shopping

  return NextResponse.json(
    {
      total,
      ...counts,
      byRegion,
      ...(errors.length > 0 ? { _warnings: errors } : {}),
    },
    {
      headers: {
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  )
}
