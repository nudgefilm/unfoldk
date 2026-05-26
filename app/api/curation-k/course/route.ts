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

const TRAVEL_STYLE = z.enum(["relaxed", "packed", "foodie", "cultural"])
const DURATION_DAYS = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(5),
  z.literal(7),
])

const PostSchema = z.object({
  drama_title: z.string().trim().min(1).max(160),
  travel_style: TRAVEL_STYLE,
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
        },
        required: ["name", "address", "reason"],
      },
    },
  },
}

const SYSTEM_PROMPT = `You are UnfoldK's Hallyu trip planner, building day-trip itineraries for global K-drama and K-pop fans visiting Korea.

Rules:
- Generate exactly the requested number of days.
- Each day MUST have at least one stop in morning / afternoon / evening (3–4 stops total per day is ideal for "relaxed", 5–6 for "packed").
- Use real Korean place names from the context list when relevant. When citing the drama, anchor the visit to the actual filming spot or themed café provided.
- Match the traveler's style:
  · relaxed → fewer stops, longer downtime, café-leaning
  · packed → more stops, tighter transit
  · foodie → restaurants and markets dominate
  · cultural → palaces, museums, historical districts
- Honor the departure → arrival route:
  · Same region (departure == arrival) → loop course, ending near departure on the last day.
  · Different regions → progress geographically from departure to arrival. Stops earlier in the trip should be near departure; later stops near arrival. Include realistic inter-city transit (KTX, bus, domestic flight if needed) on the transition day.
- Be honest about transport: Seoul metro, KTX between cities, taxi for short hops. Mention realistic duration_minutes (5–180; allow longer for inter-city transit).
- Reasons are concise — 1–2 sentences, no marketing fluff.
- Output ONLY the tool call. No prose.`

// ─── 컨텍스트 fetch — 드라마 촬영지 + 출발 지역 spots ──────────
async function fetchContext(
  supabase: ReturnType<typeof createSupabaseServerClient> extends Promise<infer T> ? T : never,
  drama_title: string,
  area_codes: number[]      // 출발 + 도착 (중복 제거)
) {
  const safeDrama = drama_title.replace(/[%_]/g, "")

  const filmingPromise = supabase
    .from("filming_spots")
    .select("spot_name, address, region")
    .ilike("drama_title", safeDrama)
    .neq("spot_name", "__no_spots_found__")
    .order("confidence", { ascending: false, nullsFirst: false })
    .limit(10)

  // 도착·출발 지역 양쪽 tour_spots — 동선 가이드에 쓰임. 각 지역에서 최대 12건.
  const tourPromise =
    area_codes.length > 0
      ? supabase
          .from("tour_spots")
          .select("eng_title, title, addr1, area_code, content_type_id")
          .in("area_code", area_codes)
          .in("content_type_id", [12, 14, 39]) // attractions / culture / food
          .not("image_url", "is", null)
          .limit(area_codes.length * 12)
      : Promise.resolve({ data: null, error: null })

  const [filming, tour] = await Promise.all([filmingPromise, tourPromise])

  const filmingList = ((filming.data ?? []) as Array<{
    spot_name: string
    address: string | null
    region: string | null
  }>).map((r) => ({
    name: r.spot_name,
    address: r.address ?? r.region ?? "",
  }))

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
    type: r.content_type_id === 12 ? "attraction" : r.content_type_id === 14 ? "culture" : "food",
  }))

  return { filming: filmingList, tour: tourList }
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
  const { drama_title, travel_style, duration_days, departure_region, arrival_region } = parsed.data
  const departureCode = REGION_LABEL_TO_AREA[departure_region] ?? null
  const arrivalCode = REGION_LABEL_TO_AREA[arrival_region] ?? null
  const areaCodes = Array.from(
    new Set([departureCode, arrivalCode].filter((c): c is number => c !== null))
  )
  const sameRegion = departure_region === arrival_region

  // 3) 컨텍스트 fetch — 출발+도착 양쪽 spots
  const context = await fetchContext(supabase, drama_title, areaCodes)

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

  // 4) Claude 호출 — tool_use 강제
  const userPrompt = `Drama: "${drama_title}"
Departure region: ${departure_region}
Arrival region: ${arrival_region}${sameRegion ? " (same as departure — loop course)" : " (different region — progress geographically)"}
Trip length: ${duration_days} day(s)
Style: ${travel_style}

Filming locations from this drama (use these as anchors when relevant):
${
  context.filming.length > 0
    ? context.filming.map((f) => `- ${f.name} (${f.address || "address unknown"})`).join("\n")
    : "(none in our database — improvise plausibly from your knowledge)"
}

Real spots in ${
    sameRegion ? departure_region : `${departure_region} and ${arrival_region}`
  } (tag = region):
${
  context.tour.length > 0
    ? context.tour.slice(0, 24).map(formatTourLine).join("\n")
    : "(no enriched data yet for these areas)"
}

Build the itinerary now. ${
    sameRegion
      ? `Keep all stops within ${departure_region}.`
      : `Start near ${departure_region}, end near ${arrival_region}, include inter-city transit.`
  }`

  let response: Anthropic.Message
  try {
    response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
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
    meta: { drama_title, travel_style, duration_days, departure_region },
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
    .limit(20)

  if (error) {
    console.error("[curation-k/course] GET 실패:", error.message)
    return NextResponse.json({ error: "query_failed" }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}
