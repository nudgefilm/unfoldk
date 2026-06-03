import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// /api/curation-k/nearby-spots — 특정 지점 주변 tour_spots 거리 기반 매칭
//
// Phase 1 K-Travel Planner — "여기 가면 근처에 뭐가 있나" 한 컷에 보여주기.
//
// 쿼리 (둘 중 하나 필수):
//   ?filming_spot_id=<uuid>           filming_spots GPS 를 원점으로 사용 (하위 호환).
//   ?lat=<number>&lng=<number>        GPS 직접 지정 — 모든 탭 공통.
//
// 선택 파라미터:
//   ?exclude_type=<content_type_id>   해당 버킷 결과 제외.
//     (예: Food 탭 모달 ?exclude_type=39 → food 버킷 미노출)
//
// 동적 반경 확장:
//   1km → 버킷 합계 5건 미만이면 3km → 5건 미만이면 10km.
//
// 분류 (content_type_id → 버킷):
//   12 → attractions / 14 → culture / 32 → stays / 39 → food
//   15 (축제·행사) 는 제외 — 시간 제약 콘텐츠라 별도 모듈에서 처리.
//
// 거리 계산: Haversine + bounding box 1차 가지치기.

export const revalidate = 600

const QuerySchema = z.object({
  filming_spot_id: z.string().uuid().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  exclude_type: z.coerce.number().int().optional(),
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
  const R = 6371
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
    lat: url.searchParams.get("lat") ?? undefined,
    lng: url.searchParams.get("lng") ?? undefined,
    exclude_type: url.searchParams.get("exclude_type") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { filming_spot_id, lat: latParam, lng: lngParam, exclude_type } = parsed.data

  // filming_spot_id 또는 lat+lng 중 하나 필수
  if (!filming_spot_id && (latParam === undefined || lngParam === undefined)) {
    return NextResponse.json(
      { error: "filming_spot_id 또는 lat+lng 쌍이 필요합니다" },
      { status: 400 }
    )
  }

  const supabase = await createSupabaseServerClient()

  let lat0: number
  let lng0: number

  if (filming_spot_id) {
    // filming_spots GPS 조회 — RLS 가 status='confirmed' 만 통과
    const { data: filming, error: filmingError } = await supabase
      .from("filming_spots")
      .select("latitude, longitude")
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

    const fLat = filming.latitude == null ? null : Number(filming.latitude)
    const fLng = filming.longitude == null ? null : Number(filming.longitude)
    if (fLat === null || fLng === null || Number.isNaN(fLat) || Number.isNaN(fLng)) {
      return NextResponse.json(
        { nearby: EMPTY_BUCKETS, radius_used: null } satisfies NearbyResponse,
        { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } }
      )
    }
    lat0 = fLat
    lng0 = fLng
  } else {
    lat0 = latParam!
    lng0 = lngParam!
    if (Number.isNaN(lat0) || Number.isNaN(lng0)) {
      return NextResponse.json({ error: "invalid lat/lng" }, { status: 400 })
    }
  }

  // ─── 반경 확장 루프 ──────────────────────────────────────────────
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

      // 제목 표기 정규화: eng_title 우선, 비어 있으면 null 취급 (빈 bold 표시 버그 방지).
      const titleKo = r.title.trim()
      const engTrimmed = r.eng_title?.trim() ?? ""
      const engValid = engTrimmed.length > 0 ? engTrimmed : null
      const displayTitle = engValid ?? titleKo
      const koreanSubtitle = engValid && engValid !== titleKo ? titleKo : null

      filtered.push({
        id: r.id,
        content_id: r.content_id,
        content_type_id: r.content_type_id,
        title: displayTitle,
        korean_title: koreanSubtitle,
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

  // ─── 버킷별 그룹핑 + 거리 순 정렬 + cap ──────────────────────────
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

  // exclude_type — 현재 탭 카테고리를 Nearby 에서 제외 (자기 탭 스팟과 중복 방지)
  if (exclude_type !== undefined) {
    const excludeBucket = CONTENT_TYPE_TO_BUCKET[exclude_type]
    if (excludeBucket) nearby[excludeBucket] = []
  }

  const body: NearbyResponse = { nearby, radius_used: radiusUsed }
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" },
  })
}

// POST { lat, lng, radius_km? } — stop 카드 주변 정보 박스용 (코스 생성 결과)
const COURSE_TYPE_LABEL: Record<number, string> = {
  12: "Attraction",
  14: "Culture",
  32: "Stay",
  38: "Shopping",
  39: "Food",
}
const COURSE_TYPE_IDS = [12, 14, 32, 38, 39] as const

export async function POST(request: Request) {
  let lat: number, lng: number, radius_km: number
  try {
    const body = await request.json()
    lat = Number(body.lat)
    lng = Number(body.lng)
    radius_km = Number(body.radius_km ?? 2)
    if (Number.isNaN(lat) || Number.isNaN(lng)) throw new Error()
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()

  // bounding box 1차 가지치기 (2km 기준)
  const dLat = radius_km / 111
  const dLng = radius_km / (111 * Math.cos((lat * Math.PI) / 180))

  const { data, error } = await supabase
    .from("tour_spots")
    .select("eng_title, title, addr1, latitude, longitude, content_type_id")
    .in("content_type_id", COURSE_TYPE_IDS as unknown as number[])
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .gte("latitude", lat - dLat)
    .lte("latitude", lat + dLat)
    .gte("longitude", lng - dLng)
    .lte("longitude", lng + dLng)
    .limit(200)

  if (error) return NextResponse.json({ spots: [] })

  type Row = { eng_title: string | null; title: string; addr1: string | null; latitude: number; longitude: number; content_type_id: number }

  const spots = ((data ?? []) as Row[])
    .map((r) => {
      const tLat = Number(r.latitude)
      const tLng = Number(r.longitude)
      if (Number.isNaN(tLat) || Number.isNaN(tLng)) return null
      const distKm = haversineKm(lat, lng, tLat, tLng)
      if (distKm > radius_km) return null
      return {
        name: (r.eng_title?.trim() || r.title).trim(),
        address: r.addr1 ?? "",
        distance_m: Math.round(distKm * 1000),
        type: COURSE_TYPE_LABEL[r.content_type_id] ?? "Spot",
      }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => a.distance_m - b.distance_m)
    .slice(0, 10)

  return NextResponse.json({ spots })
}
