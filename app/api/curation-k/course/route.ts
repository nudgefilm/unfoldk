import { NextResponse } from "next/server"
import { z } from "zod"
import Anthropic from "@anthropic-ai/sdk"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { hasProAccess } from "@/lib/auth/plan"

// /api/curation-k/course
//
//   POST  → 코스 생성 (저장 안 함). { itinerary }
//   GET   → 본인 저장 코스 목록 (RLS). { items }
//
// 저장은 /api/curation-k/course/save 에서 별도 처리 (discardable preview 패턴).
//
// 모델: claude-haiku-4-5-20251001 (CLAUDE.md §6 — 콘텐츠 생성·추출은 Haiku).
// tool_use 강제로 자유 텍스트 응답 차단.

export const dynamic = "force-dynamic"
export const maxDuration = 60

const DURATION_DAYS = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(5),
  z.literal(7),
])

const PostSchema = z.object({
  duration_days: DURATION_DAYS,
  departure_region: z.string().trim().min(1).max(60),
  arrival_region: z.string().trim().min(1).max(60),
})

// REGION 라벨 ↔ area_code — Claude 컨텍스트 fetch 용.
// 0027 에 정의된 17 광역시도 영문 라벨과 동기 유지.
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
  Chungcheongbuk: 33,
  Chungcheongnam: 34,
  Gyeongsangbuk: 35,
  Gyeongsangnam: 36,
  Jeollabuk: 37,
  Jeollanam: 38,
  Jeju: 39,
}

// 목적지 중심 좌표 — 반경 필터링용 (page.tsx REGION_CENTROIDS 와 동기)
const ARRIVAL_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  Seoul:           { lat: 37.5665, lng: 126.978  },
  Incheon:         { lat: 37.4563, lng: 126.7052 },
  Daejeon:         { lat: 36.3504, lng: 127.3845 },
  Daegu:           { lat: 35.8714, lng: 128.6014 },
  Gwangju:         { lat: 35.1595, lng: 126.8526 },
  Busan:           { lat: 35.1796, lng: 129.0756 },
  Ulsan:           { lat: 35.5384, lng: 129.3114 },
  Sejong:          { lat: 36.4801, lng: 127.2891 },
  Gyeonggi:        { lat: 37.27,   lng: 127.0    },
  Gangwon:         { lat: 37.8228, lng: 128.1555 },
  Chungcheongbuk:  { lat: 36.8,    lng: 127.7298 },
  Chungcheongnam:  { lat: 36.6,    lng: 126.65   },
  Gyeongsangbuk:   { lat: 36.4919, lng: 128.7427 },
  Gyeongsangnam:   { lat: 35.25,   lng: 128.2132 },
  Jeollabuk:       { lat: 35.7175, lng: 127.15   },
  Jeollanam:       { lat: 34.8161, lng: 126.99   },
  Jeju:            { lat: 33.4996, lng: 126.5312 },
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Claude tool — 일정 구조 강제 ───────────────────────────
const ITINERARY_TOOL: Anthropic.Tool = {
  name: "report_itinerary",
  description:
    "Return a multi-day Hallyu itinerary as structured data. Each day has morning/afternoon/evening stops.",
  input_schema: {
    type: "object",
    properties: {
      travel_info: {
        type: "string",
        description:
          "Travel information from departure to arrival region. Include distance, duration, and recommended transport. " +
          "Format: '{departure} → {arrival} | ~Xkm | ~Xh by [transport]' " +
          "Example: 'Seoul → Jeju | ~465km | ~1h by flight or ~5h by ferry'. " +
          "If departure and arrival are the same region, omit this field.",
      },
      days: {
        type: "array",
        maxItems: 7,
        items: {
          type: "object",
          properties: {
            day: { type: "number", description: "1-indexed day number" },
            title: {
              type: "string",
              description: "Short title for the day (e.g. 'Seoul drama trail').",
            },
            morning: { type: "array", items: { $ref: "#/definitions/stop" } },
            afternoon: { type: "array", items: { $ref: "#/definitions/stop" } },
            evening: { type: "array", items: { $ref: "#/definitions/stop" } },
          },
          required: ["day", "title", "morning", "afternoon", "evening"],
        },
      },
    },
    required: ["days"],
    definitions: {
      stop: {
        type: "object",
        properties: {
          name: { type: "string", description: "Place name in English." },
          address: {
            type: "string",
            description: "District / neighborhood / address (English).",
          },
          reason: {
            type: "string",
            description:
              "Why visit. Mention drama connection if relevant (1–2 sentences).",
          },
          transport: {
            type: "string",
            description:
              "Transport from previous stop (e.g. 'Subway Line 2 + 5min walk').",
          },
          duration_minutes: {
            type: "number",
            description: "Estimated travel time TO this stop in minutes.",
          },
          lat: { type: "number", description: "Latitude (WGS84 decimal degrees). Include for well-known landmarks and tourist spots; omit if uncertain." },
          lng: { type: "number", description: "Longitude (WGS84 decimal degrees). Include for well-known landmarks and tourist spots; omit if uncertain." },
        },
        required: ["name", "address", "reason"],
      },
    },
  },
}

const SYSTEM_PROMPT = `You are UnfoldK's Hallyu trip planner, building itineraries for global K-drama and K-pop fans visiting Korea.

Rules:
- Generate exactly the requested number of days.
- Each day MUST have stops in morning, afternoon, and evening slots.
- Maximum 5 stops per day. Morning: 1-2 stops, Afternoon: 1-2 stops, Evening: 1 stop. Keep all stops within walkable or short taxi distance of each other.
- Include a balanced mix of attractions, cultural sites, food, shopping, and festivals across the itinerary.
- Use real Korean place names from the context list when relevant.
- The entire itinerary stays within the destination region. Explore different neighborhoods and districts each day. On the last day, loop back toward the starting district.
- Be honest about transport: Seoul metro, taxi for short hops. Mention realistic duration_minutes (5–60 for in-city hops).
- Reasons are concise — 1–2 sentences, no marketing fluff.
- For each stop, include lat and lng (WGS84 decimal degrees) when the location is a recognizable landmark or tourist spot. Omit for small unknown local venues.
- Output ONLY the tool call. No prose.`

// duration_days → fetch 할 content_type_id 목록
// 12: 관광지(Sightseeing/Attractions) / 14: 문화시설(Culture) / 15: 축제(Festivals)
// 32: 숙박(Stays) / 38: 쇼핑(Shopping) / 39: 음식점(Food)
const LENGTH_CONTENT_TYPES: Record<number, number[]> = {
  1: [12, 14, 15, 38, 39],           // 당일치기 — 숙박 제외
  2: [12, 14, 15, 38, 39, 32],
  3: [12, 14, 15, 38, 39, 32],
  5: [12, 14, 15, 38, 39, 32],
  7: [12, 14, 15, 38, 39, 32],
}

// Fisher-Yates 셔플 — 재검색 시 다른 spot 조합 반환용
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 카테고리별 선택 개수 산출
function computeAllocations(duration_days: number): Record<number, number> {
  if (duration_days === 1) {
    return { 12: 6, 14: 5, 39: 6, 38: 4, 15: 3 } // 합계 24
  }
  const total = Math.max(24, duration_days * 8)
  const ratios: Record<number, number> = { 12: 0.30, 14: 0.20, 39: 0.25, 38: 0.10, 32: 0.10, 15: 0.05 }
  const alloc: Record<number, number> = {}
  let sum = 0
  for (const [k, r] of Object.entries(ratios)) {
    alloc[Number(k)] = Math.floor(total * r)
    sum += alloc[Number(k)]
  }
  // 반올림 오차 보정 — 비율 큰 순서로 1씩 추가
  const fillOrder = [12, 39, 14, 38, 32, 15]
  let rem = total - sum
  for (const k of fillOrder) {
    if (rem <= 0) break
    alloc[k]++
    rem--
  }
  return alloc
}

type SpotItem = {
  name: string
  address: string
  area_code: number | null
  content_type_id: number
  type: string
  lat: number | null
  lng: number | null
}

// 카테고리별 균등 배분 — 부족한 카테고리는 잉여로 보충
function selectByCategory(spots: SpotItem[], duration_days: number): SpotItem[] {
  const alloc = computeAllocations(duration_days)
  const byType = new Map<number, SpotItem[]>()
  for (const s of spots) {
    const arr = byType.get(s.content_type_id) ?? []
    arr.push(s)
    byType.set(s.content_type_id, arr)
  }
  for (const [k, v] of byType) byType.set(k, shuffleArray(v))

  const selected: SpotItem[] = []
  const surplus: SpotItem[] = []
  let deficit = 0

  for (const [typeIdStr, count] of Object.entries(alloc)) {
    const typeId = Number(typeIdStr)
    const pool = byType.get(typeId) ?? []
    selected.push(...pool.slice(0, count))
    surplus.push(...pool.slice(count))
    deficit += Math.max(0, count - pool.length)
  }
  // 부족분 보충 — 잉여 스팟 셔플 후 슬라이스
  if (deficit > 0 && surplus.length > 0) {
    selected.push(...shuffleArray(surplus).slice(0, deficit))
  }
  return shuffleArray(selected)
}

// ─── 컨텍스트 fetch — 출발·도착 지역 spots ──────────────────────
async function fetchContext(
  supabase: ReturnType<typeof createSupabaseServerClient> extends Promise<infer T> ? T : never,
  area_codes: number[],
  duration_days: number,
  arrival_region: string,
) {
  const contentTypes = LENGTH_CONTENT_TYPES[duration_days] ?? [12, 14, 15, 38, 39]

  // 반경 필터 기준 (km): 1d=10km / 2d=20km / 3d+=30km
  // 반경 필터 후 충분한 pool 확보 위해 fetch 여유분 확대
  const radiusKm = duration_days <= 1 ? 10 : duration_days <= 2 ? 20 : 30
  const centroid = ARRIVAL_CENTROIDS[arrival_region] ?? null

  const spotsPerRegion = Math.max(48, duration_days * 32)
  const tourPromise =
    area_codes.length > 0
      ? supabase
          .from("tour_spots")
          .select("eng_title, title, addr1, area_code, content_type_id, latitude, longitude")
          .in("area_code", area_codes)
          .in("content_type_id", contentTypes)
          .not("image_url", "is", null)
          .limit(area_codes.length * spotsPerRegion)
      : Promise.resolve({ data: null, error: null })

  const tour = await tourPromise

  const rawList: SpotItem[] = ((tour.data ?? []) as Array<{
    eng_title: string | null
    title: string
    addr1: string | null
    area_code: number | null
    content_type_id: number
    latitude: number | null
    longitude: number | null
  }>).map((r) => ({
    name: (r.eng_title ?? r.title).trim(),
    address: r.addr1 ?? "",
    area_code: r.area_code,
    content_type_id: r.content_type_id,
    type: r.content_type_id === 12 ? "attraction"
        : r.content_type_id === 14 ? "culture"
        : r.content_type_id === 38 ? "shopping"
        : r.content_type_id === 39 ? "food"
        : r.content_type_id === 32 ? "stay"
        : "festival",
    lat: r.latitude != null ? Number(r.latitude) : null,
    lng: r.longitude != null ? Number(r.longitude) : null,
  }))

  // 반경 필터 — lat/lng 없는 spot은 통과
  const filtered = centroid
    ? rawList.filter((s) => {
        if (s.lat == null || s.lng == null) return true
        return haversineKm(centroid.lat, centroid.lng, s.lat, s.lng) <= radiusKm
      })
    : rawList

  // 카테고리별 균등 배분 선택
  return { tour: selectByCategory(filtered, duration_days) }
}

const anthropic = new Anthropic()

export async function POST(request: Request) {
  // 1) 인증·Pro 가드
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }
  const { data: profile } = await supabase
    .from("users")
    .select("plan_type, is_admin, trial_ends_at")
    .eq("id", user.id)
    .maybeSingle()
  const row = profile as { plan_type?: string; is_admin?: boolean; trial_ends_at?: string | null } | null
  if (!hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin, trialEndsAt: row?.trial_ends_at })) {
    return NextResponse.json({ error: "pro_required" }, { status: 403 })
  }

  // 2) body 파싱
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { duration_days, departure_region, arrival_region } = parsed.data
  const departureCode = REGION_LABEL_TO_AREA[departure_region] ?? null
  const arrivalCode = REGION_LABEL_TO_AREA[arrival_region] ?? null
  const areaCodes = Array.from(
    new Set([departureCode, arrivalCode].filter((c): c is number => c !== null))
  )
  const sameRegion = departure_region === arrival_region

  // 3) 컨텍스트 fetch — 출발+도착 양쪽 spots (duration 기반 content_type 분기)
  const context = await fetchContext(supabase, areaCodes, duration_days, arrival_region)

  const formatTourLine = (t: {
    name: string
    address: string
    area_code: number | null
    type: string
  }) => {
    const regionTag =
      t.area_code === departureCode
        ? ` [${departure_region}]`
        : t.area_code === arrivalCode
          ? ` [${arrival_region}]`
          : ""
    return `- [${t.type}]${regionTag} ${t.name} (${t.address})`
  }

  // 일수별 토큰 예산: 하루 ~6 stops × ~250 토큰 + 구조 오버헤드
  const MAX_TOKENS_BY_DAYS: Record<number, number> = {
    1: 2048,
    2: 3072,
    3: 4096,
    5: 6144,
    7: 8192,
  }
  const maxTokens = MAX_TOKENS_BY_DAYS[duration_days] ?? 8192

  // 긴 여행일수일수록 더 많은 context spots 제공
  const tourContextLimit = Math.max(24, duration_days * 8)

  // 4) Claude 호출 — tool_use 강제
  const userPrompt = `Destination: ${arrival_region}
Trip length: ${duration_days} day(s)
Include a balanced mix of attractions, cultural sites, food, shopping, and festivals.
For trips of 2 days or more, include accommodation recommendations.

Real spots in ${arrival_region}:
${
  context.tour.length > 0
    ? context.tour.slice(0, tourContextLimit).map((t) => `- [${t.type}] ${t.name} (${t.address})`).join("\n")
    : "(no enriched data yet for this area)"
}

Build the itinerary now. Keep all stops within ${arrival_region}. Vary the neighborhoods and districts each day.${
  !sameRegion
    ? `\nDeparture region: ${departure_region}. Include travel_info with realistic transport options (flight/train/bus/ferry) and approximate duration from ${departure_region} to ${arrival_region}.`
    : ""
}`

  let response: Anthropic.Message
  try {
    response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [ITINERARY_TOOL],
      tool_choice: { type: "tool", name: ITINERARY_TOOL.name },
      messages: [{ role: "user", content: userPrompt }],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[curation-k/course] Haiku 호출 실패:", msg)
    return NextResponse.json({ error: "generation_failed", detail: msg }, { status: 500 })
  }

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock =>
      b.type === "tool_use" && b.name === ITINERARY_TOOL.name
  )
  if (!toolBlock) {
    return NextResponse.json({ error: "no_tool_output" }, { status: 500 })
  }

  const itinerary = toolBlock.input as {
    days?: Array<{
      day?: number
      title?: string
      morning?: unknown[]
      afternoon?: unknown[]
      evening?: unknown[]
    }>
  }

  if (!itinerary?.days || !Array.isArray(itinerary.days) || itinerary.days.length === 0) {
    return NextResponse.json({ error: "empty_itinerary" }, { status: 500 })
  }

  return NextResponse.json({
    itinerary,
    meta: { duration_days, departure_region, arrival_region },
  })
}

// 본인 저장 코스 목록
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("hallyu_courses")
    .select("id, title, region, course_data, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(6)

  if (error) {
    console.error("[curation-k/course] GET 실패:", error.message)
    return NextResponse.json({ error: "query_failed" }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}
