import { NextResponse } from "next/server"
import { z } from "zod"
import Anthropic from "@anthropic-ai/sdk"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// /api/curation-k/travel-course — 드라마별 1일 여행 코스 자동 생성 (Plan Your Trip)
//
//   GET ?drama_title={title}
//
// 동작:
//   1. filming_spots 에서 해당 드라마 GPS 보유 스팟 최대 8개 조회
//   2. 전체 스팟 bbox + 5km 버퍼로 tour_spots(food/stays) 일괄 조회
//   3. 각 스팟별 가장 가까운 맛집/숙소 1건 Haversine 매칭
//   4. Claude Haiku tool_use 로 방문 순서 + 이동 시간 + 방문 팁 생성
//   5. 병합 응답 + Google Maps 경로 URL 반환
//
// 비로그인 포함 전체 공개 (viewing free, saving Pro).
// 캐시: 1시간 CDN (AI 응답 비용 절감).

export const dynamic = "force-dynamic"
export const maxDuration = 45

const QuerySchema = z.object({
  drama_title: z.string().trim().min(1).max(160),
})

// Haversine 거리 (km)
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

export interface TravelCourseNearby {
  title: string
  address: string | null
  distance_km: number
  maps_url: string
  image_url: string | null
}

export interface TravelCourseStop {
  order: number
  spot_id: string
  spot_name: string
  spot_description: string | null
  latitude: number
  longitude: number
  address: string | null
  image_url: string | null
  duration_min: number
  visit_tip: string
  nearby_food: TravelCourseNearby | null
  nearby_stay: TravelCourseNearby | null
}

export interface TravelCourseResponse {
  course_title: string
  description: string
  drama_title: string
  stops: TravelCourseStop[]
  gmaps_url: string
}

const COURSE_TOOL: Anthropic.Tool = {
  name: "report_travel_course",
  description:
    "Return an ordered 1-day travel course for K-drama filming locations.",
  input_schema: {
    type: "object",
    properties: {
      course_title: {
        type: "string",
        description: "Short catchy title for the tour (e.g. 'Crash Landing on You Trail').",
      },
      description: {
        type: "string",
        description: "2–3 sentence fan-friendly overview of what this tour experience offers.",
      },
      stops: {
        type: "array",
        items: {
          type: "object",
          properties: {
            spot_id: {
              type: "string",
              description: "Exact spot_id from the provided list — do not modify.",
            },
            order: {
              type: "number",
              description: "Visit order (1-indexed). Cluster geographically to minimize transit.",
            },
            duration_min: {
              type: "number",
              description:
                "Estimated travel time in minutes from the previous stop. 0 for the first stop. Typical Seoul transit: 15–40 min. Inter-city: 60–180 min.",
            },
            visit_tip: {
              type: "string",
              description:
                "1–2 sentence fan tip for this stop. Drama connection welcome. No marketing fluff.",
            },
          },
          required: ["spot_id", "order", "duration_min", "visit_tip"],
        },
      },
    },
    required: ["course_title", "description", "stops"],
  },
}

const SYSTEM_PROMPT = `You are UnfoldK's Hallyu travel curator. Order a list of K-drama filming spots into a practical 1-day visit route for international fans visiting Korea.

Rules:
- Include ALL provided spots in the output (one entry per spot_id).
- Sort stops to minimize travel time — cluster nearby spots together.
- duration_min is travel time FROM the previous stop. First stop is always 0.
- visit_tip: concise and fan-friendly, max 2 sentences. Mention the drama scene if relevant.
- Output ONLY the tool call. No prose outside the tool.`

const anthropic = new Anthropic()

export async function GET(request: Request) {
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    drama_title: url.searchParams.get("drama_title") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { drama_title } = parsed.data
  const safeDrama = drama_title.replace(/[%_]/g, "")

  const supabase = await createSupabaseServerClient()

  // 1. filming_spots — GPS 있는 confirmed 스팟, confidence 높은 순, 최대 8개
  const { data: filmingRows, error: filmingErr } = await supabase
    .from("filming_spots")
    .select(
      "id, spot_name, spot_description, address, image_url, latitude, longitude, region"
    )
    .ilike("drama_title", `%${safeDrama}%`)
    .neq("spot_name", "__no_spots_found__")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("confidence", { ascending: false, nullsFirst: false })
    .limit(8)

  if (filmingErr) {
    console.error("[travel-course] filming_spots 조회 실패:", filmingErr.message)
    return NextResponse.json({ error: "query_failed" }, { status: 500 })
  }

  type FilmingRow = {
    id: string
    spot_name: string
    spot_description: string | null
    address: string | null
    image_url: string | null
    latitude: number | string
    longitude: number | string
    region: string | null
  }

  interface FilmingSpot {
    id: string
    spot_name: string
    spot_description: string | null
    address: string | null
    image_url: string | null
    latitude: number
    longitude: number
    region: string | null
  }

  const spots: FilmingSpot[] = ((filmingRows ?? []) as FilmingRow[])
    .map((r) => ({
      id: r.id,
      spot_name: r.spot_name,
      spot_description: r.spot_description,
      address: r.address,
      image_url: r.image_url,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      region: r.region,
    }))
    .filter((s) => !isNaN(s.latitude) && !isNaN(s.longitude))

  if (spots.length === 0) {
    return NextResponse.json(
      { error: "no_spots", detail: "No filming spots with GPS found for this drama." },
      { status: 404 }
    )
  }

  // 2. 전체 스팟 bbox + 5km 버퍼로 tour_spots(food + stays) 일괄 조회
  const NEARBY_RADIUS_KM = 5
  const latMin = Math.min(...spots.map((s) => s.latitude))
  const latMax = Math.max(...spots.map((s) => s.latitude))
  const lngMin = Math.min(...spots.map((s) => s.longitude))
  const lngMax = Math.max(...spots.map((s) => s.longitude))
  const midLat = (latMin + latMax) / 2
  const dLat = NEARBY_RADIUS_KM / 111
  const dLng = NEARBY_RADIUS_KM / (111 * Math.cos((midLat * Math.PI) / 180))

  const { data: tourRows } = await supabase
    .from("tour_spots")
    .select(
      "id, content_type_id, title, eng_title, addr1, latitude, longitude, image_url"
    )
    .in("content_type_id", [32, 39]) // 32=stays, 39=food
    .gte("latitude", latMin - dLat)
    .lte("latitude", latMax + dLat)
    .gte("longitude", lngMin - dLng)
    .lte("longitude", lngMax + dLng)
    .limit(400)

  type TourRow = {
    id: string
    content_type_id: number
    title: string
    eng_title: string | null
    addr1: string | null
    latitude: number | string | null
    longitude: number | string | null
    image_url: string | null
  }

  const tourSpots: Array<TourRow & { lat: number; lng: number }> = []
  for (const r of (tourRows ?? []) as TourRow[]) {
    const lat = r.latitude == null ? NaN : Number(r.latitude)
    const lng = r.longitude == null ? NaN : Number(r.longitude)
    if (isNaN(lat) || isNaN(lng)) continue
    tourSpots.push({ ...r, lat, lng })
  }

  // 3. 각 filming spot 별 가장 가까운 food / stay 매칭
  const nearbyBySpot = new Map<
    string,
    { food: TravelCourseNearby | null; stay: TravelCourseNearby | null }
  >()

  for (const spot of spots) {
    let bestFood: { t: (typeof tourSpots)[0]; dist: number } | null = null
    let bestStay: { t: (typeof tourSpots)[0]; dist: number } | null = null

    for (const t of tourSpots) {
      const dist = haversineKm(spot.latitude, spot.longitude, t.lat, t.lng)
      if (dist > NEARBY_RADIUS_KM) continue
      if (t.content_type_id === 39 && (!bestFood || dist < bestFood.dist)) {
        bestFood = { t, dist }
      }
      if (t.content_type_id === 32 && (!bestStay || dist < bestStay.dist)) {
        bestStay = { t, dist }
      }
    }

    const toNearby = (
      entry: { t: (typeof tourSpots)[0]; dist: number } | null
    ): TravelCourseNearby | null => {
      if (!entry) return null
      const { t, dist } = entry
      const engTrimmed = t.eng_title?.trim() ?? ""
      const title = engTrimmed.length > 0 ? engTrimmed : t.title
      return {
        title,
        address: t.addr1 ?? null,
        distance_km: Math.round(dist * 100) / 100,
        maps_url: `https://www.google.com/maps?q=${t.lat},${t.lng}`,
        image_url: t.image_url,
      }
    }

    nearbyBySpot.set(spot.id, {
      food: toNearby(bestFood),
      stay: toNearby(bestStay),
    })
  }

  // 4. Claude Haiku — 방문 순서 최적화 + visit_tip 생성
  const spotList = spots.map((s) => ({
    spot_id: s.id,
    name: s.spot_name,
    location: s.address ?? s.region ?? "Korea",
    lat: s.latitude.toFixed(4),
    lng: s.longitude.toFixed(4),
    scene: s.spot_description ?? null,
  }))

  const userPrompt = `Drama: "${drama_title}"

Filming locations to include in the course (ALL must appear in stops):
${spotList
  .map(
    (s) =>
      `- spot_id="${s.spot_id}" | ${s.name} | ${s.location} (${s.lat}, ${s.lng})${
        s.scene ? ` | scene: "${s.scene}"` : ""
      }`
  )
  .join("\n")}

Build the travel course now.`

  let response: Anthropic.Message
  try {
    response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [COURSE_TOOL],
      tool_choice: { type: "tool", name: COURSE_TOOL.name },
      messages: [{ role: "user", content: userPrompt }],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[travel-course] Haiku 호출 실패:", msg)
    return NextResponse.json({ error: "generation_failed", detail: msg }, { status: 500 })
  }

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock =>
      b.type === "tool_use" && b.name === COURSE_TOOL.name
  )
  if (!toolBlock) {
    return NextResponse.json({ error: "no_tool_output" }, { status: 500 })
  }

  const output = toolBlock.input as {
    course_title?: string
    description?: string
    stops?: Array<{
      spot_id?: string
      order?: number
      duration_min?: number
      visit_tip?: string
    }>
  }

  if (!output.stops || output.stops.length === 0) {
    return NextResponse.json({ error: "empty_course" }, { status: 500 })
  }

  // 5. Claude 결과 + nearby 데이터 병합
  const spotById = new Map(spots.map((s) => [s.id, s]))
  const orderedStops: TravelCourseStop[] = []
  const usedIds = new Set<string>()

  for (const stop of output.stops) {
    if (!stop.spot_id) continue
    const spot = spotById.get(stop.spot_id)
    if (!spot || usedIds.has(spot.id)) continue
    usedIds.add(spot.id)

    const nearby = nearbyBySpot.get(spot.id) ?? { food: null, stay: null }
    orderedStops.push({
      order: stop.order ?? orderedStops.length + 1,
      spot_id: spot.id,
      spot_name: spot.spot_name,
      spot_description: spot.spot_description,
      latitude: spot.latitude,
      longitude: spot.longitude,
      address: spot.address,
      image_url: spot.image_url,
      duration_min: stop.duration_min ?? 0,
      visit_tip: stop.visit_tip ?? "",
      nearby_food: nearby.food,
      nearby_stay: nearby.stay,
    })
  }

  // Claude 가 빠뜨린 스팟은 마지막에 추가 (안전장치)
  for (const spot of spots) {
    if (usedIds.has(spot.id)) continue
    const nearby = nearbyBySpot.get(spot.id) ?? { food: null, stay: null }
    orderedStops.push({
      order: orderedStops.length + 1,
      spot_id: spot.id,
      spot_name: spot.spot_name,
      spot_description: spot.spot_description,
      latitude: spot.latitude,
      longitude: spot.longitude,
      address: spot.address,
      image_url: spot.image_url,
      duration_min: 0,
      visit_tip: "",
      nearby_food: nearby.food,
      nearby_stay: nearby.stay,
    })
  }

  // order 기준 정렬
  orderedStops.sort((a, b) => a.order - b.order)

  // 6. Google Maps 경로 URL — 최대 10 waypoints (구글 맵스 URL 한계)
  const waypointStops = orderedStops.slice(0, 10)
  const gmaps_url =
    waypointStops.length > 0
      ? `https://www.google.com/maps/dir/${waypointStops
          .map((s) => `${s.latitude},${s.longitude}`)
          .join("/")}`
      : ""

  const result: TravelCourseResponse = {
    course_title: output.course_title ?? `${drama_title} Film Trail`,
    description: output.description ?? "",
    drama_title,
    stops: orderedStops,
    gmaps_url,
  }

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
