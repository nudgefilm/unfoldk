import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// /api/curation-k/nearby-spots — filming_spot 주변 tour_spots 거리 기반 매칭
//
// Phase 1 K-Travel Planner — "촬영지 가면 근처에 뭐가 있나" 한 컷에 보여주기.
//
// 쿼리:
//   ?filming_spot_id=<uuid>   필수. filming_spots 의 GPS 가 검색 원점.
//
// 동적 반경 확장:
//   1) 1km → 매칭 5건 미만이면 3km
//   2) 3km → 5건 미만이면 10km
//   각 단계 sum (4개 버킷 합계) 기준. radius_used 는 실제로 멈춘 반경.
//
// 분류 (content_type_id → 버킷):
//   12 → attractions / 14 → culture / 32 → stays / 39 → food
//   15 (축제·행사) 는 제외 — "주변 즐길거리" 가 아니라 시간 제약 콘텐츠라 별도 모듈에서 처리.
//
// 거리 계산: Haversine (PostGIS 없이 순수 JS). bounding box 로 1차 가지치기 후 정확 거리 계산.
// 보안: filming_spots RLS 가 status='confirmed' 만 노출 → pending/dummy 는 자동 404.

export const revalidate = 600

const QuerySchema = z.object({
  filming_spot_id: z.string().uuid(),
})

const RADIUS_STEPS_KM = [1, 3, 10] as const
const MIN_RESULTS_BEFORE_EXPAND = 5
// 버킷별 최대 노출 — 한 카테고리가 결과를 독식하지 않게 cap. 4*5=20 카드가 모달 최대.
const PER_BUCKET_LIMIT = 5
// bounding box 안의 1차 후보 cap — 10km 박스에서도 200개면 충분.
const BBOX_CANDIDATE_LIMIT = 200

type Bucket = "attractions" | "culture" | "stays" | "food"
const CONTENT_TYPE_TO_BUCKET: Record<number, Bucket> = {
  12: "attractions",
  14: "culture",
  32: "stays",
  39: "food",
}
const CONTENT_TYPE_IDS: readonly number[] = [12, 14, 32, 39] as const

// Haversine — 두 GPS 사이 거리 (km)
function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // 지구 반경 km
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

interface NearbyItem {
  id: string
  content_id: string
  content_type_id: number
  title: string                 // eng_title 우선, 없으면 한글 title
  korean_title: string | null
  address: string | null
  image_url: string | null
  latitude: number
  longitude: number
  distance_km: number           // 소수 2자리
  maps_url: string              // Google Maps deep link
}

interface NearbyResponse {
  filming_spot: {
    id: string
    spot_name: string
    drama_title: string
    latitude: number | null
    longitude: number | null
  }
  nearby: Record<Bucket, NearbyItem[]>
  radius_used: 1 | 3 | 10 | null
}

const EMPTY_BUCKETS: Record<Bucket, NearbyItem[]> = {
  attractions: [],
  culture: [],
  stays: [],
  food: [],
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    filming_spot_id: url.searchParams.get("filming_spot_id") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { filming_spot_id } = parsed.data

  const supabase = await createSupabaseServerClient()

  // ─── 1. filming_spot 조회 — RLS 가 confirmed 만 통과 ────────
  const { data: filming, error: filmingError } = await supabase
    .from("filming_spots")
    .select("id, spot_name, drama_title, latitude, longitude")
    .eq("id", filming_spot_id)
    .neq("spot_name", "__no_spots_found__")
    .maybeSingle()

  if (filmingError) {
    console.error("[curation-k/nearby-spots] filming 조회 실패:", filmingError.message)
    return NextResponse.json({ error: "query_failed" }, { status: 500 })
  }
  if (!filming) {
    return NextResponse.json({ error: "filming_spot_not_found" }, { status: 404 })
  }

  const lat0 = filming.latitude == null ? null : Number(filming.latitude)
  const lng0 = filming.longitude == null ? null : Number(filming.longitude)

  // ─── 2. GPS 없으면 빈 버킷 graceful 응답 ────────────────────
  if (lat0 === null || lng0 === null || Number.isNaN(lat0) || Number.isNaN(lng0)) {
    const body: NearbyResponse = {
      filming_spot: {
        id: filming.id,
        spot_name: filming.spot_name,
        drama_title: filming.drama_title,
        latitude: null,
        longitude: null,
      },
      nearby: EMPTY_BUCKETS,
      radius_used: null,
    }
    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" },
    })
  }

  // ─── 3. 반경 확장 루프 ─────────────────────────────────────
  type Candidate = NearbyItem
  let candidates: Candidate[] = []
  let radiusUsed: 1 | 3 | 10 = RADIUS_STEPS_KM[RADIUS_STEPS_KM.length - 1] as 10

  for (const radius of RADIUS_STEPS_KM) {
    // 위도 1° ≈ 111km, 경도 1° ≈ 111km * cos(위도). Korea 위도대(33~39°)에서 cos 0.78~0.84.
    const dLat = radius / 111
    const dLng = radius / (111 * Math.cos((lat0 * Math.PI) / 180))

    const { data: tours, error: tourError } = await supabase
      .from("tour_spots")
      .select(
        "id, content_id, content_type_id, title, eng_title, addr1, latitude, longitude, image_url"
      )
      .in("content_type_id", CONTENT_TYPE_IDS as number[])
      .gte("latitude", lat0 - dLat)
      .lte("latitude", lat0 + dLat)
      .gte("longitude", lng0 - dLng)
      .lte("longitude", lng0 + dLng)
      .limit(BBOX_CANDIDATE_LIMIT)

    if (tourError) {
      console.error(
        `[curation-k/nearby-spots] tour_spots ${radius}km 조회 실패:`,
        tourError.message
      )
      return NextResponse.json({ error: "query_failed" }, { status: 500 })
    }

    type TourRow = {
      id: string
      content_id: string
      content_type_id: number
      title: string
      eng_title: string | null
      addr1: string | null
      latitude: number | string | null
      longitude: number | string | null
      image_url: string | null
    }

    const filtered: Candidate[] = []
    for (const r of (tours ?? []) as TourRow[]) {
      const tLat = r.latitude == null ? NaN : Number(r.latitude)
      const tLng = r.longitude == null ? NaN : Number(r.longitude)
      if (Number.isNaN(tLat) || Number.isNaN(tLng)) continue

      const dist = haversineKm(lat0, lng0, tLat, tLng)
      if (dist > radius) continue // bounding box 통과했어도 실제 원형 반경 밖이면 제외

      filtered.push({
        id: r.id,
        content_id: r.content_id,
        content_type_id: r.content_type_id,
        title: (r.eng_title ?? r.title).trim(),
        korean_title: r.eng_title ? r.title : null,
        address: r.addr1 ?? null,
        image_url: r.image_url,
        latitude: tLat,
        longitude: tLng,
        distance_km: Math.round(dist * 100) / 100,
        maps_url: `https://www.google.com/maps?q=${tLat},${tLng}`,
      })
    }

    candidates = filtered
    radiusUsed = radius

    if (filtered.length >= MIN_RESULTS_BEFORE_EXPAND) break
  }

  // ─── 4. 버킷별 그룹핑 + 거리 순 정렬 + cap ──────────────────
  candidates.sort((a, b) => a.distance_km - b.distance_km)

  const nearby: Record<Bucket, NearbyItem[]> = {
    attractions: [],
    culture: [],
    stays: [],
    food: [],
  }
  for (const item of candidates) {
    const bucket = CONTENT_TYPE_TO_BUCKET[item.content_type_id]
    if (!bucket) continue
    if (nearby[bucket].length >= PER_BUCKET_LIMIT) continue
    nearby[bucket].push(item)
  }

  const body: NearbyResponse = {
    filming_spot: {
      id: filming.id,
      spot_name: filming.spot_name,
      drama_title: filming.drama_title,
      latitude: lat0,
      longitude: lng0,
    },
    nearby,
    radius_used: radiusUsed,
  }

  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" },
  })
}
