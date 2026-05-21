// Curation K — K드라마 촬영지 자동 추출 + TourAPI GPS 매핑
//
// 흐름:
//   1. dramas 테이블에서 후보 (filming_spots 에 row 없는 신규) 선택
//   2. Claude Haiku tool_use 로 촬영지 1~5개 + 신뢰도 + 지역 추출
//      - 모델이 모르는 드라마는 빈 배열 반환 (할루시네이션 차단)
//   3. 각 후보를 TourAPI `searchKeyword` 로 GPS 매핑 시도
//      - 매칭 성공 → contentId + addr + lat/lng + firstImage 저장
//      - 매칭 실패 → GPS 없이 status='pending' 으로 보존 (어드민 수동 확인)
//   4. (drama_title, spot_name) unique 로 중복 추출 멱등
//
// 모델: claude-haiku-4-5-20251001 (CLAUDE.md §6 AI 처리 원칙 — 추출은 Haiku)
// 비용: 드라마 1편 ≈ output 600 토큰 × $5/1M = $0.003. 일 5편 cap 으로 안전.
//
// 안전장치:
//   - 드라마 1편당 spot 최대 5개 cap (할루시네이션 폭주 차단)
//   - confidence < 0.5 면 status='pending' (어드민 검토 큐)
//   - TourAPI 결과 0건이면 status='pending'
//   - 한 cron run 처리 최대 N=5 (스로틀)

import Anthropic from "@anthropic-ai/sdk"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { searchKeyword, normalizeSpot, AREA_CODE } from "@/lib/api/tourapi"

const client = new Anthropic()

const MAX_DRAMAS_PER_RUN = 5
const MAX_SPOTS_PER_DRAMA = 5
const CONFIDENCE_PENDING_THRESHOLD = 0.5

// 잘 알려진 K드라마 TMDB ID — 촬영지 데이터 시드 품질을 보장하기 위해 우선 처리.
// Claude 학습 지식이 풍부한 작품들 (글로벌 인지도 + 촬영지 fan documentation 다수).
// 순서대로 처리 — 앞쪽이 더 우선.
const PRIORITY_TMDB_IDS: number[] = [
  94796,  // Crash Landing on You
  67809,  // Goblin (Guardian: The Lonely and Great God)
  117709, // Vincenzo
  93405,  // Squid Game
  75573,  // My Mister
  95503,  // Itaewon Class
]

export interface FilmingSpotsIngestResult {
  source: "filming-spots"
  dramasScanned: number
  dramasProcessed: number
  spotsInserted: number
  spotsConfirmed: number
  spotsPending: number
  pendingRetried: number          // 이번 run 에서 재시도한 pending row 수
  pendingPromoted: number         // 그 중 confirmed 승격 성공 수
  descriptionsBackfilled: number  // 이번 run 에서 spot_description NULL → 채워진 row 수 (빈 문자열 저장 포함)
  errors: string[]
  details: Array<{
    drama: string
    spots_found: number
    spots_mapped: number
  }>
}

interface ExtractedSpot {
  spotName: string
  region: string | null
  confidence: number
  description: string | null   // 촬영 장면·맥락 1~2문장 (영문). 모달 본문에 노출.
}

// Claude tool — 구조화 출력 강제 (CLAUDE.md §6 AI 처리 원칙)
const EXTRACT_TOOL: Anthropic.Tool = {
  name: "report_filming_spots",
  description:
    "Report the most notable real-world filming locations for a Korean drama. Return [] if you don't have reliable knowledge of this specific drama's locations.",
  input_schema: {
    type: "object",
    properties: {
      spots: {
        type: "array",
        maxItems: MAX_SPOTS_PER_DRAMA,
        items: {
          type: "object",
          properties: {
            spotName: {
              type: "string",
              description:
                "Specific real-world place name (e.g., 'Goblin Café (Jaein House)', 'Itaewon Class stairs', 'Namsan Tower'). Prefer Korean place names that TourAPI is likely to find.",
            },
            region: {
              type: "string",
              description:
                "Korean region — one of: Seoul, Gyeonggi, Gangwon, Chungcheong, Jeolla, Gyeongsang, Busan, Jeju, Incheon, Daegu, Daejeon, Gwangju, Ulsan. Or null if unsure.",
            },
            confidence: {
              type: "number",
              description:
                "Your confidence this is a real, well-documented filming location (0.0–1.0). 0.9+ = widely reported by fans / officially confirmed. 0.5–0.9 = plausible. <0.5 = guess.",
            },
            description: {
              type: "string",
              description:
                "1–2 sentences (English) describing the iconic scene or context filmed here — what fans recognize when they visit. Keep concise and spoiler-light. Omit if unsure.",
            },
          },
          required: ["spotName", "confidence"],
        },
      },
    },
    required: ["spots"],
  },
}

const SYSTEM_PROMPT = `You are a K-drama production research assistant for UnfoldK, a Hallyu fan platform.

Given a Korean drama title, list the most well-documented real-world filming locations in South Korea. Strict rules:
- ONLY include locations you have reliable knowledge of. If you don't know this specific drama, return an empty spots array.
- DO NOT invent location names to look helpful. Hallucinated spots cause downstream data quality issues.
- Prefer locations that fans visit as pilgrimage spots — cafés, landmarks, neighborhoods that became famous because of the drama.
- Use the official Korean place name where possible (better TourAPI match) but write in Latin script.
- Maximum 5 spots per drama. Pick the most iconic.
- Be honest with confidence: 0.9+ only if you are sure this location appeared in this specific drama.`

async function extractSpotsForDrama(
  dramaTitle: string,
  titleKo: string | null
): Promise<ExtractedSpot[]> {
  const userPrompt = titleKo
    ? `K-drama: "${dramaTitle}" (Korean: "${titleKo}").\n\nReport its most notable filming locations.`
    : `K-drama: "${dramaTitle}".\n\nReport its most notable filming locations.`

  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: EXTRACT_TOOL.name },
      messages: [{ role: "user", content: userPrompt }],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[filming-spots] Haiku 호출 실패 "${dramaTitle}":`, msg)
    return []
  }

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === EXTRACT_TOOL.name
  )
  if (!toolBlock) return []

  const input = toolBlock.input as { spots?: unknown }
  if (!Array.isArray(input.spots)) return []

  const out: ExtractedSpot[] = []
  for (const raw of input.spots.slice(0, MAX_SPOTS_PER_DRAMA)) {
    if (typeof raw !== "object" || raw === null) continue
    const r = raw as {
      spotName?: unknown
      region?: unknown
      confidence?: unknown
      description?: unknown
    }
    if (typeof r.spotName !== "string" || r.spotName.trim().length === 0) continue
    if (typeof r.confidence !== "number") continue
    const confidence = Math.max(0, Math.min(1, r.confidence))
    out.push({
      spotName: r.spotName.trim().slice(0, 200),
      region: typeof r.region === "string" && r.region.trim().length > 0 ? r.region.trim() : null,
      confidence,
      description:
        typeof r.description === "string" && r.description.trim().length > 0
          ? r.description.trim().slice(0, 600)
          : null,
    })
  }
  return out
}

// ─── 한국어 장소명 변환 캐시 ─────────────────────────────────
// TourAPI 가 영어 키워드로 못 찾는 경우 (e.g. "Goblin Café (Jaein House)" → 한국어
// 등록명 다름) 대비 — Claude Haiku 로 한국어 변환 후 재검색.
//
// 캐시: 모듈 스코프 Map. Vercel 함수 인스턴스 재사용 시 cross-run 재활용 (best-effort).
// CAP 500 도달 시 절반 비움 (단순 FIFO-ish). 정확도 < 비용 절감 우선.
const translationCache = new Map<string, string | null>()
const TRANSLATION_CACHE_CAP = 500

function cacheKey(spotName: string): string {
  return spotName.trim().toLowerCase()
}

// 한국어 (Hangul) 문자가 충분히 포함됐는지 검증 — LLM 이 영어로 답하거나 거부 응답 거름.
function hasEnoughHangul(s: string): boolean {
  const hangul = s.match(/[가-힯]/g)
  return hangul !== null && hangul.length >= 2
}

const TRANSLATE_SYSTEM_PROMPT = `You are a Korean drama location translator for TourAPI (Korea Tourism Organization) keyword search.

Given an English filming location name from a K-drama, output its most common KOREAN (Hangul) name.

Strict rules:
- Output the Korean name in Hangul only. No English. No romanization. No parentheses.
- No explanation, preamble, or quotes. Just the name.
- If the input is already Korean or you don't know the Korean equivalent, output the single character: 모름
- Prefer the official place name TourAPI is likely to have indexed (e.g., real café name, station name, neighborhood) over fan-given nicknames.
- Max 40 characters.`

async function translateToKorean(spotName: string): Promise<string | null> {
  const key = cacheKey(spotName)
  if (translationCache.has(key)) {
    return translationCache.get(key) ?? null
  }

  // 캐시 cap — 가장 오래된 절반 제거 (Map.entries() 순서 = 삽입 순)
  if (translationCache.size >= TRANSLATION_CACHE_CAP) {
    const half = Math.floor(TRANSLATION_CACHE_CAP / 2)
    const iter = translationCache.keys()
    for (let i = 0; i < half; i++) {
      const k = iter.next().value
      if (k === undefined) break
      translationCache.delete(k)
    }
  }

  let translated: string | null = null
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 64,
      system: [
        {
          type: "text",
          text: TRANSLATE_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: spotName }],
    })
    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    )
    const raw = textBlock?.text?.trim() ?? ""
    if (raw.length > 0 && raw !== "모름" && hasEnoughHangul(raw)) {
      translated = raw.slice(0, 40)
    }
  } catch (err) {
    console.warn(`[filming-spots] translateToKorean 실패 "${spotName}":`, err)
  }

  translationCache.set(key, translated)
  return translated
}

// Claude 가 추출한 region 라벨 → TourAPI areaCode 매핑.
// 라벨은 영문 (Claude 시스템 프롬프트에서 영문 region 명시 — Seoul/Gyeonggi 등).
// 매칭 안 되면 undefined → 전국 검색.
const REGION_TO_AREA_CODE: Record<string, number> = {
  "Seoul": AREA_CODE.SEOUL,
  "Incheon": AREA_CODE.INCHEON,
  "Daejeon": AREA_CODE.DAEJEON,
  "Daegu": AREA_CODE.DAEGU,
  "Gwangju": AREA_CODE.GWANGJU,
  "Busan": AREA_CODE.BUSAN,
  "Ulsan": AREA_CODE.ULSAN,
  "Sejong": AREA_CODE.SEJONG,
  "Gyeonggi": AREA_CODE.GYEONGGI,
  "Gangwon": AREA_CODE.GANGWON,
  // Claude 가 약식 (Chungcheong / Jeolla / Gyeongsang) 으로 답할 수도 있어 polite alias.
  // 정확한 도 구분 불가 시 북도를 우선 — 명확한 정보 부족 시 사용자 검증으로.
  "Chungbuk": AREA_CODE.CHUNGCHEONGBUK,
  "Chungnam": AREA_CODE.CHUNGCHEONGNAM,
  "Chungcheong": AREA_CODE.CHUNGCHEONGNAM,
  "Gyeongbuk": AREA_CODE.GYEONGSANGBUK,
  "Gyeongnam": AREA_CODE.GYEONGSANGNAM,
  "Gyeongsang": AREA_CODE.GYEONGSANGNAM,
  "Jeonbuk": AREA_CODE.JEOLLABUK,
  "Jeonnam": AREA_CODE.JEOLLANAM,
  "Jeolla": AREA_CODE.JEOLLANAM,
  "Jeju": AREA_CODE.JEJU,
}

function regionToAreaCode(region: string | null): number | undefined {
  if (!region) return undefined
  return REGION_TO_AREA_CODE[region.trim()]
}

// TourAPI 키워드 검색 단발 호출. 0건/예외 시 null. areaCode 옵션으로 지역 제한.
async function searchOneTourSpot(keyword: string, areaCode?: number) {
  try {
    const { items } = await searchKeyword({
      keyword,
      // 음식점·문화시설·관광지 모두 후보로 — contentTypeId 미지정 (전체 검색)
      numOfRows: 1,
      ...(areaCode ? { areaCode } : {}),
    })
    if (items.length === 0) return null
    return normalizeSpot(items[0])
  } catch (err) {
    console.warn(
      `[filming-spots] TourAPI search 실패 "${keyword}" (area=${areaCode ?? "nat"}):`,
      err
    )
    return null
  }
}

// TourAPI GPS 매핑 — 3-tier fallback.
//   Tier 1: 영문 keyword + areaCode (region 있을 때) → 가장 정확
//   Tier 2: Claude Haiku 한국어 변환 + areaCode (TourAPI 영문 인덱싱 약함 대응)
//   Tier 3: areaCode 없이 전국 검색 (region 매핑 실패·매칭 0건 fallback)
// 0건이면 null → 호출자는 GPS 없는 pending 상태로 저장.
async function mapToTourAPI(spotName: string, region: string | null) {
  const areaCode = regionToAreaCode(region)

  // Tier 1 — 영문 spotName + areaCode 필터
  const tier1 = await searchOneTourSpot(spotName, areaCode)
  if (tier1) return tier1

  // Tier 2 — 한국어 변환 + areaCode 필터
  const koreanName = await translateToKorean(spotName)
  if (koreanName) {
    const tier2 = await searchOneTourSpot(koreanName, areaCode)
    if (tier2) return tier2
  }

  // Tier 3 — 전국 검색 (areaCode 제거). 한국어 이름 우선, 없으면 영문.
  const nationKeyword = koreanName ?? spotName
  const tier3 = await searchOneTourSpot(nationKeyword)
  if (tier3) return tier3

  return null
}

// ─── 단발 description 생성 (backfill 전용) ──────────────────────────────────
// 기존 spot_description NULL row 보충용. drama_title + spot_name 1쌍으로 단발 호출.
// tool_use 안 씀 — 1~2문장 텍스트만 필요하니 overkill.
// 반환 규약:
//   - string (비어있거나 정상) → DB 저장. 빈 문자열도 저장해야 NULL 차단 → 다음 cron 에서 재호출 X.
//   - null → API 일시 에러 (rate limit / network). 호출자가 skip → NULL 유지 → 다음 cron 재시도.
const BACKFILL_DESC_SYSTEM_PROMPT = `You are a K-drama filming location curator for UnfoldK.

Given a Korean drama title and a filming spot name, write 1–2 concise English sentences describing the iconic scene or context filmed at this location — what fans recognize when they visit. Keep spoiler-light.

Strict rules:
- Output the description text only. No preamble, no quotes, no explanation.
- If you don't have reliable knowledge of this specific drama or location, output the single character: 모름
- Maximum 2 sentences. Keep concise.`

async function generateSpotDescription(
  dramaTitle: string,
  spotName: string
): Promise<string | null> {
  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: [
        {
          type: "text",
          text: BACKFILL_DESC_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `K-drama: "${dramaTitle}"\nFilming spot: "${spotName}"\n\nWrite the description.`,
        },
      ],
    })
  } catch (err) {
    console.warn(
      `[filming-spots] generateSpotDescription 호출 실패 "${dramaTitle} / ${spotName}":`,
      err instanceof Error ? err.message : String(err)
    )
    return null
  }

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text"
  )
  const raw = textBlock?.text?.trim() ?? ""

  // 거부 / 모름 / 너무 짧음 → 빈 문자열 (NULL 차단해 재호출 방지)
  if (raw.length === 0) return ""
  if (raw === "모름") return ""
  if (raw.length < 20) return ""
  if (/^(i don't|i do not|i cannot|i can't|i'm not|sorry|unfortunately|i have no)/i.test(raw)) {
    return ""
  }

  return raw.slice(0, 600)
}

export async function runFilmingSpotsIngest(): Promise<FilmingSpotsIngestResult> {
  const result: FilmingSpotsIngestResult = {
    source: "filming-spots",
    dramasScanned: 0,
    dramasProcessed: 0,
    spotsInserted: 0,
    spotsConfirmed: 0,
    spotsPending: 0,
    pendingRetried: 0,
    pendingPromoted: 0,
    descriptionsBackfilled: 0,
    errors: [],
    details: [],
  }

  const supabase = createSupabaseAdminClient()

  // 후보: 인기 K드라마 중 filming_spots 에 아직 한 건도 없는 것 우선.
  // 정렬: year desc → rating desc (최신작 우선, 동률 시 평점 높은 쪽).
  // 잘 알려진 작품 (PRIORITY_TMDB_IDS) 은 fetch 후 in-memory 로 앞쪽으로 끌어올림.
  const { data: dramas, error: dramaErr } = await supabase
    .from("dramas")
    .select("id, tmdb_id, title, title_ko")
    .eq("is_active", true)
    .order("year", { ascending: false, nullsFirst: false })
    .order("rating", { ascending: false, nullsFirst: false })
    .limit(50) // 후보 풀

  if (dramaErr) {
    result.errors.push(`dramas fetch failed: ${dramaErr.message}`)
    return result
  }

  result.dramasScanned = dramas?.length ?? 0
  if (!dramas || dramas.length === 0) return result

  // 이미 filming_spots 에 등록된 drama_title 제외 (멱등)
  const titles = dramas.map((d) => d.title)
  const { data: existing } = await supabase
    .from("filming_spots")
    .select("drama_title")
    .in("drama_title", titles)

  const existingTitles = new Set<string>(
    ((existing ?? []) as Array<{ drama_title: string }>).map((e) => e.drama_title)
  )

  // 우선순위 partition — PRIORITY_TMDB_IDS 순서대로 먼저, 나머지는 year·rating 정렬 유지.
  // 둘 다 existingTitles 필터 통과한 것만. 50개 풀 내에 우선순위 작품 없으면 자연스럽게 normal 로 채워짐.
  type DramaRow = { id: string; tmdb_id: number | null; title: string; title_ko: string | null }
  const remaining = (dramas as DramaRow[]).filter((d) => !existingTitles.has(d.title))

  const priorityBucket: DramaRow[] = []
  for (const targetId of PRIORITY_TMDB_IDS) {
    const found = remaining.find((d) => d.tmdb_id === targetId)
    if (found) priorityBucket.push(found)
  }
  const priorityIds = new Set(priorityBucket.map((d) => d.id))
  const normalBucket = remaining.filter((d) => !priorityIds.has(d.id))

  const candidates = [...priorityBucket, ...normalBucket].slice(0, MAX_DRAMAS_PER_RUN)
  if (candidates.length === 0) return result

  for (const drama of candidates) {
    const dramaTitle = drama.title
    const dramaTitleKo = drama.title_ko
    const dramaId = drama.id

    let spotsFound = 0
    let spotsMapped = 0

    try {
      const extracted = await extractSpotsForDrama(dramaTitle, dramaTitleKo)
      spotsFound = extracted.length

      if (extracted.length === 0) {
        // Claude 가 모르는 드라마 — 진행 카운트만 + drama_title 더미 row 1건 삽입해 재시도 차단.
        // 더미 row 는 spot_name='__no_spots_found__' + status='pending' 로 표시, 어드민 UI 에서 필터.
        const { error: dummyErr } = await supabase.from("filming_spots").insert({
          drama_id: dramaId,
          drama_title: dramaTitle,
          spot_name: "__no_spots_found__",
          status: "pending",
          confidence: 0,
        })
        if (dummyErr) {
          // unique 충돌은 무해 — 이미 dummy 가 있으면 그대로
          if (!dummyErr.message.includes("duplicate")) {
            result.errors.push(`dummy insert ${dramaTitle}: ${dummyErr.message}`)
          }
        }
        result.details.push({ drama: dramaTitle, spots_found: 0, spots_mapped: 0 })
        result.dramasProcessed++
        continue
      }

      for (const spot of extracted) {
        const tourSpot = await mapToTourAPI(spot.spotName, spot.region)
        const hasGps = !!(tourSpot && tourSpot.latitude !== null && tourSpot.longitude !== null)
        const status =
          spot.confidence >= CONFIDENCE_PENDING_THRESHOLD && hasGps ? "confirmed" : "pending"

        const { error: insertErr } = await supabase.from("filming_spots").insert({
          drama_id: dramaId,
          drama_title: dramaTitle,
          spot_name: spot.spotName,
          spot_description: spot.description,
          region: spot.region,
          address: tourSpot?.address ?? null,
          latitude: tourSpot?.latitude ?? null,
          longitude: tourSpot?.longitude ?? null,
          tour_content_id: tourSpot?.contentId ?? null,
          image_url: tourSpot?.imageUrl ?? null,
          confidence: spot.confidence,
          status,
        })

        if (insertErr) {
          if (!insertErr.message.includes("duplicate")) {
            result.errors.push(`${dramaTitle} / ${spot.spotName}: ${insertErr.message}`)
          }
          continue
        }

        result.spotsInserted++
        if (status === "confirmed") result.spotsConfirmed++
        else result.spotsPending++
        if (hasGps) spotsMapped++
      }
    } catch (err) {
      result.errors.push(
        `${dramaTitle} 처리 예외: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    result.details.push({ drama: dramaTitle, spots_found: spotsFound, spots_mapped: spotsMapped })
    result.dramasProcessed++
  }

  // ─── pending 재시도 — status='pending' + latitude NULL 인 기존 행 재매핑 ─────
  // 이번 run 에서 신규 처리 후 잉여 시간/cost 로 과거 미매핑 row 를 보충 시도.
  // 비용 통제: 최대 10건/run cap (TourAPI 3-tier × 10 = 최대 30 호출 + 한국어 변환 10).
  // 더미 row (__no_spots_found__) 는 명시 제외.
  const PENDING_RETRY_CAP = 10
  try {
    const { data: pendingRows, error: pendingErr } = await supabase
      .from("filming_spots")
      .select("id, spot_name, region")
      .eq("status", "pending")
      .is("latitude", null)
      .neq("spot_name", "__no_spots_found__")
      .order("created_at", { ascending: true })
      .limit(PENDING_RETRY_CAP)

    if (pendingErr) {
      result.errors.push(`pending 조회 실패: ${pendingErr.message}`)
    } else {
      type PendingRow = { id: string; spot_name: string; region: string | null }
      const rows = (pendingRows ?? []) as PendingRow[]

      for (const row of rows) {
        result.pendingRetried++
        try {
          const tourSpot = await mapToTourAPI(row.spot_name, row.region)
          const hasGps = !!(
            tourSpot &&
            tourSpot.latitude !== null &&
            tourSpot.longitude !== null
          )
          if (!hasGps) continue

          const { error: upErr } = await supabase
            .from("filming_spots")
            .update({
              latitude: tourSpot.latitude,
              longitude: tourSpot.longitude,
              address: tourSpot.address,
              tour_content_id: tourSpot.contentId,
              image_url: tourSpot.imageUrl,
              status: "confirmed",
            })
            .eq("id", row.id)

          if (upErr) {
            result.errors.push(`pending 승격 실패 ${row.spot_name}: ${upErr.message}`)
            continue
          }
          result.pendingPromoted++
        } catch (err) {
          result.errors.push(
            `pending 처리 예외 ${row.spot_name}: ${err instanceof Error ? err.message : String(err)}`
          )
        }
      }
    }
  } catch (err) {
    result.errors.push(
      `pending 재시도 블록 예외: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  // ─── description backfill — spot_description NULL row 보충 ───────────────
  // description 추출 코드 추가 이전에 ingest 된 기존 row (61건 예상) 가 NULL.
  // 매 cron 10건씩 단발 호출 → 며칠 내 완결. 완결 후엔 NULL row 없어 0 호출 → no-op.
  // Claude 가 모르는 케이스도 빈 문자열로 저장해 NULL 차단 → 무한 재호출 방지.
  // dummy row (__no_spots_found__) 는 명시 제외.
  const DESCRIPTION_BACKFILL_CAP = 10
  try {
    const { data: missingDesc, error: descErr } = await supabase
      .from("filming_spots")
      .select("id, drama_title, spot_name")
      .is("spot_description", null)
      .neq("spot_name", "__no_spots_found__")
      .order("created_at", { ascending: true })
      .limit(DESCRIPTION_BACKFILL_CAP)

    if (descErr) {
      result.errors.push(`description backfill 조회 실패: ${descErr.message}`)
    } else {
      type DescRow = { id: string; drama_title: string; spot_name: string }
      const rows = (missingDesc ?? []) as DescRow[]

      for (const row of rows) {
        try {
          const desc = await generateSpotDescription(row.drama_title, row.spot_name)
          if (desc === null) continue // API 일시 에러 → NULL 유지, 다음 run 재시도

          const { error: upErr } = await supabase
            .from("filming_spots")
            .update({ spot_description: desc })
            .eq("id", row.id)

          if (upErr) {
            result.errors.push(
              `description update 실패 ${row.drama_title} / ${row.spot_name}: ${upErr.message}`
            )
            continue
          }
          result.descriptionsBackfilled++
        } catch (err) {
          result.errors.push(
            `description backfill 예외 ${row.spot_name}: ${err instanceof Error ? err.message : String(err)}`
          )
        }
      }
    }
  } catch (err) {
    result.errors.push(
      `description backfill 블록 예외: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  return result
}
