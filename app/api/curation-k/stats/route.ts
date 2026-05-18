import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// /api/curation-k/stats — Curation K 지도 통계 오버레이용
//
// 전역 카운트 + 지역별 (area_code) breakdown 한 번에 반환.
// 1시간 캐싱 — 데이터 갱신은 cron 일 1회 (`ingest-curation-k`) 보다 빠르지 않음.
//
// 응답:
//   { total, filming, attractions, culture, festivals, stays, food,
//     byRegion: { [area_code]: { filming, attractions, food } } }

export const revalidate = 3600

type CategoryKey = "filming" | "attractions" | "culture" | "festivals" | "stays" | "food"

const TOUR_TYPE_TO_KEY: Record<number, CategoryKey> = {
  12: "attractions",
  14: "culture",
  15: "festivals",
  32: "stays",
  39: "food",
}

interface RegionBreakdown {
  filming: number
  attractions: number
  food: number
}

export async function GET() {
  const supabase = await createSupabaseServerClient()

  // 1) tour_spots — content_type_id + area_code 양쪽 집계
  const { data: tourData, error: tourErr } = await supabase
    .from("tour_spots")
    .select("content_type_id, area_code")

  if (tourErr) {
    console.error("[curation-k/stats] tour_spots 조회 실패:", tourErr.message)
    return NextResponse.json({ error: "query_failed" }, { status: 500 })
  }

  // 2) filming_spots — 더미 row 제외, region 만 별도 집계는 area_code 매핑 어려워 skip.
  //    글로벌 카운트 + byRegion 의 filming 키는 비워두는 게 정직. (Step 5 spec 은 byRegion
  //    의 filming 도 요구 — 추후 filming_spots.region 텍스트 → area_code 매핑 헬퍼 추가.)
  const { data: filmingData, error: filmingErr } = await supabase
    .from("filming_spots")
    .select("region")
    .neq("spot_name", "__no_spots_found__")

  if (filmingErr) {
    console.error("[curation-k/stats] filming_spots 조회 실패:", filmingErr.message)
    return NextResponse.json({ error: "query_failed" }, { status: 500 })
  }

  // 카테고리 글로벌 카운트
  const counts: Record<CategoryKey, number> = {
    filming: 0,
    attractions: 0,
    culture: 0,
    festivals: 0,
    stays: 0,
    food: 0,
  }
  const byRegion: Record<string, RegionBreakdown> = {}

  type TourRow = { content_type_id: number; area_code: number | null }
  for (const row of (tourData ?? []) as TourRow[]) {
    const key = TOUR_TYPE_TO_KEY[row.content_type_id]
    if (!key) continue
    counts[key]++

    if (row.area_code !== null) {
      const ar = String(row.area_code)
      if (!byRegion[ar]) byRegion[ar] = { filming: 0, attractions: 0, food: 0 }
      if (key === "attractions") byRegion[ar].attractions++
      else if (key === "food") byRegion[ar].food++
      // culture/festivals/stays 는 byRegion 의 spec 키에 없음 — 글로벌 카운트만
    }
  }

  // filming_spots.region 텍스트 → area_code 매핑 (1차 — 광역시도 영문 이름 기준)
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

  type FilmingRow = { region: string | null }
  let filmingTotal = 0
  for (const row of (filmingData ?? []) as FilmingRow[]) {
    filmingTotal++
    const label = row.region?.trim()
    if (!label) continue
    const code = REGION_LABEL_TO_AREA[label]
    if (code === undefined) continue
    const ar = String(code)
    if (!byRegion[ar]) byRegion[ar] = { filming: 0, attractions: 0, food: 0 }
    byRegion[ar].filming++
  }
  counts.filming = filmingTotal

  const total =
    counts.filming +
    counts.attractions +
    counts.culture +
    counts.festivals +
    counts.stays +
    counts.food

  return NextResponse.json(
    {
      total,
      ...counts,
      byRegion,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    }
  )
}
