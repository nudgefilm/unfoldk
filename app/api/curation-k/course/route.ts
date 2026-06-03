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

// ─── Claude tool — 일정 구조 강제 ───────────────────────────
const ITINERARY_TOOL: Anthropic.Tool = {
  name: "report_itinerary",
  description:
    "Return a multi-day Hallyu itinerary as structured data. Each day has morning/afternoon/evening stops.",
  input_schema: {
    type: "object",
    properties: {
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

const SYSTEM_PROMPT = `You are UnfoldK's Hallyu trip planner, building day-trip itineraries for global K-drama and K-pop fans visiting Korea.

Rules:
- Generate exactly the requested number of days.
- Each day MUST have at least one stop in morning / afternoon / evening (3–4 stops per day is standard; filming and cultural styles may have fewer but richer stops).
- Use real Korean place names from the context list when relevant. When citing the drama, anchor the visit to the actual filming spot or themed café provided.
- Match the traveler's style precisely:
  · filming → drama filming locations are the primary anchors; visit the exact spots shown on screen, then explore the surrounding neighborhood
  · sightseeing → major landmarks and must-see tourist attractions fill the day; mix iconic spots with hidden gems
  · foodie → restaurants, street food stalls, and traditional markets dominate; tie food choices to local specialties and drama-featured dishes
  · cultural → museums, palaces, temples, galleries, and historical districts; prioritize [culture] and [attraction] spots from the context list
  · shopping → shopping districts, local markets, and specialty stores; mix with nearby cafés for breaks
- The entire itinerary stays within the destination region. Explore different neighborhoods and districts each day to give a full experience of the area. On the last day, loop back toward the starting district.
- Be honest about transport: Seoul metro, taxi for short hops. Mention realistic duration_minutes (5–60 for in-city hops).
- Reasons are concise — 1–2 sentences, no marketing fluff.
- For each stop, include lat and lng (WGS84 decimal degrees) when the location is a recognizable landmark, neighborhood, or tourist spot. Omit for small unknown local venues.
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

// ─── 컨텍스트 fetch — 출발·도착 지역 spots ──────────────────────
async function fetchContext(
  supabase: ReturnType<typeof createSupabaseServerClient> extends Promise<infer T> ? T : never,
  area_codes: number[],
  duration_days: number,
) {
  const contentTypes = LENGTH_CONTENT_TYPES[duration_days] ?? [12, 14, 32, 38, 15, 39]

  // 일수가 길수록 더 많은 스팟 필요 — 하루 8건 기준 + 셔플 여유분(×2)
  const spotsPerRegion = Math.max(24, duration_days * 16)
  const tourPromise =
    area_codes.length > 0
      ? supabase
          .from("tour_spots")
          .select("eng_title, title, addr1, area_code, content_type_id")
          .in("area_code", area_codes)
          .in("content_type_id", contentTypes)
          .not("image_url", "is", null)
          .limit(area_codes.length * spotsPerRegion)
      : Promise.resolve({ data: null, error: null })

  const tour = await tourPromise

  const tourList = ((tour.data ?? []) as Array<{
    eng_title: string | null
    title: string
    addr1: string | null
    area_code: number | null
    content_type_id: number
  }>).map((r) => ({
    name: (r.eng_title ?? r.title).trim(),
    address: r.addr1 ?? "",
    area_code: r.area_code,
    type: r.content_type_id === 12 ? "attraction"
        : r.content_type_id === 14 ? "culture"
        : r.content_type_id === 38 ? "shopping"
        : r.content_type_id === 39 ? "food"
        : r.content_type_id === 32 ? "stay"
        : "festival",
  }))

  // 재검색 시 다른 spot 조합 반환 — 셔플 후 슬라이스
  return { tour: shuffleArray(tourList) }
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
  const context = await fetchContext(supabase, areaCodes, duration_days)

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

Build the itinerary now. Keep all stops within ${arrival_region}. Vary the neighborhoods and districts each day.`

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
