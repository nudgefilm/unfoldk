// Curation K — K팝 성지 자동 수집 (TourAPI + Claude Haiku)
//
// 흐름:
//   1. 시드 키워드 (3 카테고리 × 다수) 순회
//   2. TourAPI searchKeyword 로 위경도 있는 후보 fetch (키워드당 cap)
//   3. tour_content_id 가 이미 kpop_spots 에 있으면 skip (재처리 방지)
//   4. Claude Haiku tool_use 로 primary_artist + visit_reason + confidence 추출
//   5. confidence ≥ 0.7 만 upsert (filming_spots 패턴)
//   6. (artist_name, spot_name, spot_type) unique 로 중복 추출 멱등
//
// 모델: claude-haiku-4-5-20251001 (CLAUDE.md §6 — 추출은 Haiku)
// cap: 키워드당 3건 / 전체 50건 per run

import Anthropic from "@anthropic-ai/sdk"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { searchKeyword, normalizeSpot } from "@/lib/api/tourapi"

const client = new Anthropic()

const MAX_SPOTS_PER_KEYWORD = 3
const MAX_TOTAL_PER_RUN = 50
const CONFIDENCE_THRESHOLD = 0.7

type SpotType = "agency" | "mv_location" | "cafe" | "concert_venue"

// 시드 키워드 — TourAPI 한글 검색에 매칭되도록 한국어 표기.
// spot_type 매핑:
//   소속사     → agency
//   콘서트장   → concert_venue
//   팬성지     → mv_location (광범위 — MV/예능 촬영지 + 팬 핫스팟)
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

  // 팬성지 (mv_location 로 통일 — 광범위 핫스팟)
  { keyword: "홍대", spot_type: "mv_location" },
  { keyword: "명동", spot_type: "mv_location" },
  { keyword: "한강공원", spot_type: "mv_location" },
  { keyword: "이태원", spot_type: "mv_location" },
  { keyword: "압구정", spot_type: "mv_location" },
] as const

export interface KpopSpotsIngestResult {
  source: "kpop-spots"
  keywordsScanned: number
  candidatesFetched: number       // TourAPI 응답 후보 수
  candidatesSkipped: number       // 기존 tour_content_id 충돌로 skip
  haikuCalls: number              // 실제 Claude 호출 수
  spotsUpserted: number           // confidence 통과 후 DB upsert 성공 수
  belowThreshold: number          // confidence < 0.7 로 skip
  errors: string[]
  details: Array<{
    keyword: string
    spot_type: SpotType
    fetched: number
    upserted: number
  }>
}

// ─── Claude tool — primary_artist + visit_reason + confidence ──
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

const SYSTEM_PROMPT = `You are a K-pop tourism researcher for UnfoldK, a Hallyu fan platform.

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
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
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
  }

  const supabase = createSupabaseAdminClient()

  // 기존 tour_content_id 집합 — 재처리 차단용
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

      // tour_content_id 충돌 — 이미 처리한 동일 TourAPI 항목이면 skip
      if (existingContentIds.has(spot.contentId)) {
        result.candidatesSkipped++
        continue
      }

      // Claude 호출
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
      existingContentIds.add(spot.contentId) // 같은 run 내 중복 차단
    }

    result.details.push(detail)
  }

  return result
}
