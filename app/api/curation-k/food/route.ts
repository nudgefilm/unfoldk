import { NextResponse } from "next/server"
import { z } from "zod"
import { getRestaurants, AREA_CODE, normalizeSpot } from "@/lib/api/tourapi"

// /api/curation-k/food — TourAPI contentTypeId=39 (음식점) 라이브 호출
// 광역시도 필터. 응답은 정규화된 spot 형태로 통일.

export const revalidate = 21600 // 6h (TourAPI 음식점 데이터 거의 안 바뀜)

const QuerySchema = z.object({
  area: z.enum([
    "seoul", "busan", "incheon", "daegu", "daejeon", "gwangju", "ulsan",
    "gyeonggi", "gangwon", "chungcheongbuk", "chungcheongnam",
    "gyeongsangbuk", "gyeongsangnam", "jeollabuk", "jeollanam", "jeju",
    "sejong",
  ]).default("seoul"),
  limit: z.coerce.number().int().min(1).max(30).default(12),
})

const AREA_MAP: Record<string, number> = {
  seoul: AREA_CODE.SEOUL,
  busan: AREA_CODE.BUSAN,
  incheon: AREA_CODE.INCHEON,
  daegu: AREA_CODE.DAEGU,
  daejeon: AREA_CODE.DAEJEON,
  gwangju: AREA_CODE.GWANGJU,
  ulsan: AREA_CODE.ULSAN,
  sejong: AREA_CODE.SEJONG,
  gyeonggi: AREA_CODE.GYEONGGI,
  gangwon: AREA_CODE.GANGWON,
  chungcheongbuk: AREA_CODE.CHUNGCHEONGBUK,
  chungcheongnam: AREA_CODE.CHUNGCHEONGNAM,
  gyeongsangbuk: AREA_CODE.GYEONGSANGBUK,
  gyeongsangnam: AREA_CODE.GYEONGSANGNAM,
  jeollabuk: AREA_CODE.JEOLLABUK,
  jeollanam: AREA_CODE.JEOLLANAM,
  jeju: AREA_CODE.JEJU,
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    area: url.searchParams.get("area") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { area, limit } = parsed.data

  try {
    const { items, totalCount } = await getRestaurants({
      areaCode: AREA_MAP[area],
      numOfRows: limit,
    })
    return NextResponse.json(
      {
        area,
        total: totalCount,
        items: items.map(normalizeSpot),
      },
      { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=43200" } }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[curation-k/food] TourAPI 호출 실패:", msg)
    // 외부 API 실패 시 빈 배열 + 200 (CLAUDE.md §6 #4 fallback)
    return NextResponse.json(
      { area, total: 0, items: [], error: msg },
      { status: 200 }
    )
  }
}
