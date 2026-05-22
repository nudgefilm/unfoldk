// Curation K — K팝 성지 수집 (TourAPI + Claude Sonnet 직접 생성)
//
// 두 가지 수집 경로:
//   A) TourAPI searchKeyword (기존) — 콘서트장 등 관광지 DB에 등록된 스팟
//   B) Claude Sonnet 직접 생성 (신규) — 아티스트별 성지 직접 지식 기반 생성
//      → Kakao Maps Geocoding 으로 address_ko → GPS 변환
//      → 월 1회 (CLAUDE_INGEST_INTERVAL_DAYS=30) 실행
//
// 모델:
//   extractKpopMeta  : claude-haiku-4-5-20251001 (분류·추출)
//   generateSpots    : claude-sonnet-4-6         (지식 기반 생성)
// cap: TourAPI 키워드당 3건 / 전체 50건 per run

import Anthropic from "@anthropic-ai/sdk"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { searchKeyword, normalizeSpot } from "@/lib/api/tourapi"

const client = new Anthropic()

const MAX_SPOTS_PER_KEYWORD = 3
const MAX_TOTAL_PER_RUN = 50
const CONFIDENCE_THRESHOLD = 0.7

// Claude 직접 생성 인터벌 — tour_content_id IS NULL row 기준 마지막 업데이트 후 이 일수 미만이면 skip
const CLAUDE_INGEST_INTERVAL_DAYS = 30

type SpotType = "agency" | "mv_location" | "cafe" | "concert_venue"

// ─── A. TourAPI 시드 키워드 ────────────────────────────────────
const SEED_KEYWORDS: ReadonlyArray<{ keyword: string; spot_type: SpotType }> = [
  // 소속사
  { keyword: "HYBE", spot_type: "agency" },
  { keyword: "SM엔터테인먼트", spot_type: "agency" },
  { keyword: "YG엔터테인먼트", spot_type: "agency" },
  { keyword: "JYP엔터테인먼트", spot_type: "agency" },
  { keyword: "스타쉽엔터테인먼트", spot_type: "agency" },
  { keyword: "큐브엔터테인먼트", spot_type: "agency" },
  { keyword: "플레디스엔터테인먼트", spot_type: "agency" },
  { keyword: "울림엔터테인먼트", spot_type: "agency" },

  // 콘서트장
  { keyword: "올림픽공원", spot_type: "concert_venue" },
  { keyword: "KSPO돔", spot_type: "concert_venue" },
  { keyword: "잠실올림픽주경기장", spot_type: "concert_venue" },
  { keyword: "고척스카이돔", spot_type: "concert_venue" },
  { keyword: "인스파이어아레나", spot_type: "concert_venue" },
  { keyword: "서울월드컵경기장", spot_type: "concert_venue" },
  { keyword: "경희대학교 평화의전당", spot_type: "concert_venue" },

  // 팬성지
  { keyword: "홍대", spot_type: "mv_location" },
  { keyword: "명동", spot_type: "mv_location" },
  { keyword: "한강공원", spot_type: "mv_location" },
  { keyword: "이태원", spot_type: "mv_location" },
  { keyword: "압구정", spot_type: "mv_location" },
] as const

export interface KpopSpotsIngestResult {
  source: "kpop-spots"
  keywordsScanned: number
  candidatesFetched: number
  candidatesSkipped: number
  haikuCalls: number
  spotsUpserted: number
  belowThreshold: number
  errors: string[]
  details: Array<{
    keyword: string
    spot_type: SpotType
    fetched: number
    upserted: number
  }>
  claude: KpopSpotsClaudeResult | null   // Claude 직접 생성 단계 결과
}

// ─── A-1. Haiku — TourAPI 후보 메타 추출 ──────────────────────
interface ExtractedKpopMeta {
  primaryArtist: string
  visitReason: string
  confidence: number
}

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "report_kpop_meta",
  description:
    "Identify the most relevant K-pop artist or group connected to this place, and explain why K-pop fans visit. Return confidence 0–1.",
  input_schema: {
    type: "object",
    properties: {
      primary_artist: {
        type: "string",
        description:
          "Single most associated K-pop artist or group (Latin script). Examples: 'BTS', 'BLACKPINK', 'NewJeans', 'TWICE'. If multiple equally relevant, pick the most internationally famous. If genuinely none, return 'K-pop fans' as a generic placeholder.",
      },
      visit_reason: {
        type: "string",
        description:
          "1–2 sentences explaining why this place matters to K-pop fans (in English). Mention agency, concert venue, MV shoot, or fan gathering spot context.",
      },
      confidence: {
        type: "number",
        description:
          "Confidence (0.0–1.0) that this is a real, documented K-pop pilgrimage site with a clear artist or category connection. 0.9+ = strong (e.g., HYBE HQ ↔ BTS). 0.7–0.9 = plausible. <0.7 = guess (skip).",
      },
    },
    required: ["primary_artist", "visit_reason", "confidence"],
  },
}

const EXTRACT_SYSTEM_PROMPT = `You are a K-pop tourism researcher for UnfoldK, a Hallyu fan platform.

Given a real-world place in Korea (name + address + spot type), identify the most relevant K-pop artist or group connected to it, and write a brief reason fans visit. Strict rules:
- ONLY claim a strong artist connection (confidence > 0.7) when widely documented (agency HQ, concert venue history, MV shooting location). When the connection is weak or generic (broad neighborhood like Hongdae), set confidence 0.5–0.6 and use a general framing.
- DO NOT invent specific artist connections. Hallucinated facts cause data quality issues.
- Write the visit_reason in English, friendly and concise.
- Use the most international Latin spelling for artist names (e.g., 'BTS', 'BLACKPINK', 'NewJeans', 'aespa').
- Output ONLY the tool call.`

async function extractKpopMeta(
  spotName: string,
  address: string | null,
  spotType: SpotType
): Promise<ExtractedKpopMeta | null> {
  const typeLabel: Record<SpotType, string> = {
    agency: "K-pop agency / company HQ",
    concert_venue: "concert venue",
    cafe: "fan-favorite café",
    mv_location: "MV / variety shoot location or fan hangout",
  }

  const userPrompt = `Place: "${spotName}"
Address: ${address ?? "(not provided)"}
Type: ${typeLabel[spotType]}

Identify the most relevant K-pop artist and reason for visit.`

  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: [
        { type: "text", text: EXTRACT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: EXTRACT_TOOL.name },
      messages: [{ role: "user", content: userPrompt }],
    })
  } catch (err) {
    console.warn(
      `[kpop-spots] Haiku 호출 실패 "${spotName}":`,
      err instanceof Error ? err.message : String(err)
    )
    return null
  }

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock =>
      b.type === "tool_use" && b.name === EXTRACT_TOOL.name
  )
  if (!toolBlock) return null

  const input = toolBlock.input as {
    primary_artist?: unknown
    visit_reason?: unknown
    confidence?: unknown
  }
  if (
    typeof input.primary_artist !== "string" ||
    input.primary_artist.trim().length === 0
  )
    return null
  if (
    typeof input.visit_reason !== "string" ||
    input.visit_reason.trim().length === 0
  )
    return null
  if (typeof input.confidence !== "number") return null

  return {
    primaryArtist: input.primary_artist.trim().slice(0, 80),
    visitReason: input.visit_reason.trim().slice(0, 600),
    confidence: Math.max(0, Math.min(1, input.confidence)),
  }
}

// kpop_artists 에서 artist_name 로 best-effort id 찾기 (FK 매핑 — 실패해도 진행)
async function findArtistId(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  artistName: string
): Promise<string | null> {
  if (!artistName || artistName.toLowerCase() === "k-pop fans") return null
  const { data } = await supabase
    .from("kpop_artists")
    .select("id")
    .ilike("name", artistName)
    .limit(1)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

// ─── B. Claude Sonnet 직접 생성 ───────────────────────────────

// 대상 아티스트 — 월 1회 생성 (claude-sonnet-4-6)
const ARTISTS_FOR_CLAUDE: readonly string[] = [
  "BTS",
  "BLACKPINK",
  "aespa",
  "EXO",
  "TWICE",
  "Stray Kids",
  "NewJeans",
  "IVE",
  "SEVENTEEN",
  "NCT",
]

interface GeneratedSpot {
  name_ko: string
  name_en: string
  category: "Agency" | "Venue" | "MV_Location" | "Fan_Spot"
  address_ko: string
  visit_reason: string
  homepage: string | null
}

const GENERATE_TOOL: Anthropic.Tool = {
  name: "report_kpop_pilgrimage_spots",
  description:
    "Report real K-pop pilgrimage spots for the given artist, covering all four categories.",
  input_schema: {
    type: "object",
    properties: {
      spots: {
        type: "array",
        description:
          "3–5 spots per category (Agency / Venue / MV_Location / Fan_Spot). Only real, documented locations.",
        items: {
          type: "object",
          properties: {
            name_ko: {
              type: "string",
              description: "Korean name of the place (e.g. 'HYBE 사옥').",
            },
            name_en: {
              type: "string",
              description: "English or Romanized name (e.g. 'HYBE Headquarters').",
            },
            category: {
              type: "string",
              enum: ["Agency", "Venue", "MV_Location", "Fan_Spot"],
              description:
                "Agency = label HQ / Venue = concert hall / MV_Location = documented MV or drama shoot / Fan_Spot = fan-gathering area.",
            },
            address_ko: {
              type: "string",
              description:
                "Full Korean address for geocoding (e.g. '서울특별시 용산구 이태원로 246').",
            },
            visit_reason: {
              type: "string",
              description:
                "1–2 sentence English fan tip. Mention specific connection (song title, concert series, MV scene).",
            },
            homepage: {
              type: "string",
              description: "Official URL if known.",
            },
          },
          required: ["name_ko", "name_en", "category", "address_ko", "visit_reason"],
        },
      },
    },
    required: ["spots"],
  },
}

const GENERATE_SYSTEM_PROMPT = `You are a K-pop tourism expert for UnfoldK, a Hallyu fan platform.

Generate a list of real, documented K-pop pilgrimage sites for the requested artist. Rules:
- ONLY include places with a verified real-world address in South Korea.
- Cover all four categories: Agency (label HQ), Venue (concert hall), MV_Location (documented MV or variety filming site), Fan_Spot (popular fan-gathering area).
- 3–5 spots per category. Skip a category entirely if fewer than 2 real spots exist for this artist.
- address_ko must be a full Korean address accurate enough for map geocoding.
- visit_reason: concise, fan-friendly English. Reference specific songs, concerts, or MV scenes when possible.
- Do NOT invent connections. If unsure of the exact address, omit the spot rather than guess.
- Output ONLY the tool call.`

// category 문자열 → DB spot_type 매핑
function categoryToSpotType(category: GeneratedSpot["category"]): SpotType {
  const map: Record<GeneratedSpot["category"], SpotType> = {
    Agency: "agency",
    Venue: "concert_venue",
    MV_Location: "mv_location",
    Fan_Spot: "mv_location",  // fan_spot 은 기존 spot_type enum 에 없음 — mv_location 으로 통일
  }
  return map[category]
}

// GPS 확보 — 우선순위:
//   1. TourAPI searchKeyword(name_ko) — 기존 인프라, 비용 없음
//   2. Google Maps Geocoding API (GOOGLE_MAPS_API_KEY 설정 시)
//   3. 둘 다 실패 → null (GPS 없이 insert, 추후 pending-retry 가능)
async function geocodeAddress(
  nameKo: string,
  addressKo: string
): Promise<{ lat: number; lng: number } | null> {
  // 1차: TourAPI searchKeyword — name_ko 로 장소 검색 → 첫 번째 GPS 사용
  try {
    const res = await searchKeyword({ keyword: nameKo, numOfRows: 1 })
    const spot = res.items[0] ? normalizeSpot(res.items[0]) : null
    if (spot && spot.latitude !== null && spot.longitude !== null) {
      return { lat: spot.latitude, lng: spot.longitude }
    }
  } catch {
    // fall through
  }

  // 2차: Google Maps Geocoding API
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY
  if (mapsKey) {
    try {
      const query = `${nameKo} ${addressKo}`.slice(0, 200)
      const url =
        `https://maps.googleapis.com/maps/api/geocode/json` +
        `?address=${encodeURIComponent(query)}&key=${mapsKey}`
      const r = await fetch(url)
      if (r.ok) {
        const body = (await r.json()) as {
          results?: Array<{ geometry: { location: { lat: number; lng: number } } }>
        }
        const loc = body.results?.[0]?.geometry?.location
        if (loc && !isNaN(loc.lat) && !isNaN(loc.lng) && loc.lat !== 0) {
          return { lat: loc.lat, lng: loc.lng }
        }
      }
    } catch {
      // fall through
    }
  }

  return null
}

export interface KpopSpotsClaudeResult {
  artistsProcessed: number
  spotsGenerated: number    // Claude 응답 spots 총수 (geocoding 전)
  geocodeFailed: number     // GPS 변환 실패로 null 삽입된 건 수
  upserted: number
  skipped: boolean          // 인터벌 미달로 전체 skip
  errors: string[]
}

async function runKpopSpotsClaudeIngest(
  supabase: ReturnType<typeof createSupabaseAdminClient>
): Promise<KpopSpotsClaudeResult> {
  const result: KpopSpotsClaudeResult = {
    artistsProcessed: 0,
    spotsGenerated: 0,
    geocodeFailed: 0,
    upserted: 0,
    skipped: false,
    errors: [],
  }

  // 인터벌 체크 — tour_content_id IS NULL = Claude 생성 row. 최근 30일 이내면 skip.
  const { data: latestClaudeRow } = await supabase
    .from("kpop_spots")
    .select("updated_at")
    .is("tour_content_id", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestClaudeRow) {
    const row = latestClaudeRow as { updated_at: string }
    const daysSince = (Date.now() - new Date(row.updated_at).getTime()) / 86400000
    if (daysSince < CLAUDE_INGEST_INTERVAL_DAYS) {
      result.skipped = true
      return result
    }
  }

  for (const artist of ARTISTS_FOR_CLAUDE) {
    result.artistsProcessed++

    let response: Anthropic.Message
    try {
      response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: [
          {
            type: "text",
            text: GENERATE_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: [GENERATE_TOOL],
        tool_choice: { type: "tool", name: GENERATE_TOOL.name },
        messages: [
          {
            role: "user",
            content: `Generate K-pop pilgrimage spots for: ${artist}`,
          },
        ],
      })
    } catch (err) {
      result.errors.push(
        `[${artist}] Sonnet 호출 실패: ${err instanceof Error ? err.message : String(err)}`
      )
      continue
    }

    const toolBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === "tool_use" && b.name === GENERATE_TOOL.name
    )
    if (!toolBlock) continue

    const output = toolBlock.input as { spots?: unknown[] }
    if (!Array.isArray(output.spots) || output.spots.length === 0) continue

    result.spotsGenerated += output.spots.length

    const artistId = await findArtistId(supabase, artist)

    for (const rawSpot of output.spots) {
      const spot = rawSpot as Partial<GeneratedSpot>
      if (!spot.name_ko?.trim() || !spot.name_en?.trim() || !spot.address_ko?.trim()) continue
      if (
        !spot.category ||
        !["Agency", "Venue", "MV_Location", "Fan_Spot"].includes(spot.category)
      )
        continue

      const geo = await geocodeAddress(spot.name_ko, spot.address_ko)
      if (!geo) result.geocodeFailed++

      const spotType = categoryToSpotType(spot.category as GeneratedSpot["category"])

      const { error: upErr } = await supabase.from("kpop_spots").upsert(
        {
          artist_id: artistId,
          artist_name: artist,
          spot_name: spot.name_ko.trim().slice(0, 200),
          eng_title: spot.name_en.trim().slice(0, 200),
          spot_type: spotType,
          address: spot.address_ko.trim().slice(0, 400),
          latitude: geo?.lat ?? null,
          longitude: geo?.lng ?? null,
          visit_reason: spot.visit_reason?.trim().slice(0, 600) ?? null,
          homepage: spot.homepage?.trim().slice(0, 500) ?? null,
          tour_content_id: null,  // Claude 생성 식별자 (TourAPI 행과 구분)
        },
        { onConflict: "artist_name,spot_name,spot_type" }
      )

      if (upErr) {
        result.errors.push(
          `upsert 실패 (${artist} / ${spot.name_ko}): ${upErr.message}`
        )
      } else {
        result.upserted++
      }
    }
  }

  return result
}

// ─── 메인 진입점 ─────────────────────────────────────────────
export async function runKpopSpotsIngest(): Promise<KpopSpotsIngestResult> {
  const result: KpopSpotsIngestResult = {
    source: "kpop-spots",
    keywordsScanned: 0,
    candidatesFetched: 0,
    candidatesSkipped: 0,
    haikuCalls: 0,
    spotsUpserted: 0,
    belowThreshold: 0,
    errors: [],
    details: [],
    claude: null,
  }

  const supabase = createSupabaseAdminClient()

  // ── A. TourAPI 경로 ──────────────────────────────────────────
  const { data: existing, error: existErr } = await supabase
    .from("kpop_spots")
    .select("tour_content_id")
    .not("tour_content_id", "is", null)

  if (existErr) {
    result.errors.push(`기존 tour_content_id 조회 실패: ${existErr.message}`)
  }
  const existingContentIds = new Set<string>(
    ((existing ?? []) as Array<{ tour_content_id: string | null }>)
      .map((r) => r.tour_content_id)
      .filter((id): id is string => !!id)
  )

  for (const seed of SEED_KEYWORDS) {
    if (result.spotsUpserted >= MAX_TOTAL_PER_RUN) break
    result.keywordsScanned++

    const detail = {
      keyword: seed.keyword,
      spot_type: seed.spot_type,
      fetched: 0,
      upserted: 0,
    }

    let items: Awaited<ReturnType<typeof searchKeyword>>["items"]
    try {
      const res = await searchKeyword({
        keyword: seed.keyword,
        numOfRows: MAX_SPOTS_PER_KEYWORD * 2,
      })
      items = res.items
    } catch (err) {
      result.errors.push(
        `searchKeyword "${seed.keyword}": ${err instanceof Error ? err.message : String(err)}`
      )
      result.details.push(detail)
      continue
    }

    detail.fetched = items.length
    result.candidatesFetched += items.length

    let processedForKeyword = 0
    for (const item of items) {
      if (processedForKeyword >= MAX_SPOTS_PER_KEYWORD) break
      if (result.spotsUpserted >= MAX_TOTAL_PER_RUN) break

      const spot = normalizeSpot(item)
      if (spot.latitude === null || spot.longitude === null) continue
      if (!spot.contentId || !spot.title?.trim()) continue

      if (existingContentIds.has(spot.contentId)) {
        result.candidatesSkipped++
        continue
      }

      result.haikuCalls++
      const meta = await extractKpopMeta(spot.title, spot.address, seed.spot_type)
      if (!meta) {
        result.belowThreshold++
        continue
      }
      if (meta.confidence < CONFIDENCE_THRESHOLD) {
        result.belowThreshold++
        continue
      }

      const artistId = await findArtistId(supabase, meta.primaryArtist)

      const { error: insErr } = await supabase
        .from("kpop_spots")
        .upsert(
          {
            artist_id: artistId,
            artist_name: meta.primaryArtist,
            spot_name: spot.title,
            spot_type: seed.spot_type,
            region: null,
            address: spot.address,
            latitude: spot.latitude,
            longitude: spot.longitude,
            tour_content_id: spot.contentId,
            image_url: spot.imageUrl,
            visit_reason: meta.visitReason,
          },
          { onConflict: "artist_name,spot_name,spot_type" }
        )

      if (insErr) {
        result.errors.push(
          `upsert 실패 (${seed.keyword} / ${spot.title}): ${insErr.message}`
        )
        continue
      }
      processedForKeyword++
      detail.upserted++
      result.spotsUpserted++
      existingContentIds.add(spot.contentId)
    }

    result.details.push(detail)
  }

  // ── B. Claude Sonnet 직접 생성 경로 ─────────────────────────
  try {
    result.claude = await runKpopSpotsClaudeIngest(supabase)
    if (result.claude.errors.length > 0) {
      result.errors.push(...result.claude.errors)
    }
  } catch (err) {
    result.errors.push(
      `Claude 생성 단계 예외: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  return result
}
