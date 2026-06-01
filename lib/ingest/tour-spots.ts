// Curation K — TourAPI 6개 카테고리 통합 수집 + Claude 영문 번역
//
// 카테고리:
//   12: 관광지       — intervalDays 7
//   14: 문화시설     — intervalDays 7
//   15: 축제·행사    — intervalDays 1 (당해년도 1/1 ~ 오늘 + 18개월)
//   32: 숙박         — intervalDays 7
//   38: 쇼핑         — intervalDays 7 (2026-05-28 추가)
//   39: 음식점       — intervalDays 7
//
// 2026-05-22: 비축제 4종을 30일 → 7일로 단축.
// 2026-05-28: 쇼핑(38) 추가, ingest-curation-k 단일 주간 cron 으로 통합
//   (ingest-tour-spots 주간 + ingest-filming-kpop 주간 → ingest-curation-k 주간).
//
// 수집 로직:
//   1) cron_logs 에서 본 카테고리 마지막 성공 시각 조회
//      → intervalDays 미만이면 skip (단, tour_spots 에 해당 카테고리 행 0건이면 강제 실행)
//   2) 행사·축제 = searchFestival2(당해년도 1/1 ~ 오늘+18개월, area 전체 순회)
//      그 외     = areaBasedList2(area 전체 순회, page 1만 — 30 items/area)
//   3) 응답 item 의 modifiedtime 이 DB row 와 동일하면 upsert 스킵 (불필요한 update 방지)
//   4) overview_ko 가 있고 overview_en 이 null 인 행을 Claude Haiku 로 번역 (cap)
//
// 비용·시간 가드레일:
//   - 카테고리당 area 17개 × 30 items/page = 최대 510 fetch / 한 번에 모두 페이지 1만
//   - 5개 카테고리 모두 due 인 날엔 17×5=85 list 호출 (~45초)
//   - 번역은 한 번 cron 당 MAX_TRANSLATIONS_PER_RUN 까지 (Phase 1 에선 보통 0 — list 응답은
//     overview 제공 안 함. detailCommon enrichment 결합 후부터 동작)

import Anthropic from "@anthropic-ai/sdk"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  AREA_CODE,
  CONTENT_TYPE,
  type ContentTypeId,
  type TourItem,
  areaBasedList,
  detailCommon,
  searchFestival,
} from "@/lib/api/tourapi"

const client = new Anthropic()

// TourAPI 최대값 100. 비축제는 area당 100건으로 충분.
// 축제는 인기 지역 수백 건 가능 → 아래 페이지네이션 루프로 전부 수집.
const ITEMS_PER_AREA = 100
// 축제 지역당 최대 페이지 수 (안전 cap) — 100 × 10 = 지역당 최대 1,000건
const MAX_FESTIVAL_PAGES_PER_AREA = 10
// 통합 cap — 배치 처리로 row 당 Claude 호출 분리 없음.
// 300행 ÷ 20(배치) = 15 호출 × ~5s = ~75s. 300s timeout 충분히 내.
// Claude Haiku 4.5 비용: 300 rows ~$0.5 이하.
const MAX_TRANSLATIONS_PER_RUN = 300
// 배치 크기 — 20건씩 단일 Claude 호출. max_tokens=8192 안전 범위.
const BATCH_SIZE = 20
// detailCommon2 enrichment cap — overview_ko 가 비어있는 row 에 대해 detail fetch.
// TourAPI 호출 비용만 들고 Claude 호출 없음. 한 번에 최대 50건 (~25초).
const MAX_DETAIL_ENRICHMENTS_PER_RUN = 50

// 축제·행사 검색 범위 — 당해년도 1월 1일 ~ 오늘 + 18개월.
// 1월부터 시작해야 진행중 축제·이미 시작한 long-running 축제도 포착.
const FESTIVAL_FUTURE_MONTHS = 18

interface CategoryConfig {
  contentTypeId: ContentTypeId
  name: string             // 어드민 로그 가독용
  intervalDays: number     // 마지막 성공으로부터 이 일수 미만이면 skip
}

// 실행 순서 — [15, 12, 14, 32, 38, 39]. 0048 마이그레이션으로 38 CHECK 제약 추가됨.
const CATEGORIES: readonly CategoryConfig[] = [
  { contentTypeId: CONTENT_TYPE.FESTIVAL, name: "축제·행사", intervalDays: 1 },
  { contentTypeId: CONTENT_TYPE.TOURIST_SPOT, name: "관광지", intervalDays: 7 },
  { contentTypeId: CONTENT_TYPE.CULTURAL, name: "문화시설", intervalDays: 7 },
  { contentTypeId: CONTENT_TYPE.LODGING, name: "숙박", intervalDays: 7 },
  { contentTypeId: CONTENT_TYPE.SHOPPING, name: "쇼핑", intervalDays: 7 },
  { contentTypeId: CONTENT_TYPE.RESTAURANT, name: "음식점", intervalDays: 7 },
] as const

// AREA_CODE 전체 순회 — 광역시도 17개
const ALL_AREA_CODES: readonly number[] = Object.values(AREA_CODE)

export interface CategoryRunResult {
  category: number
  categoryName: string
  skipped: boolean
  skipReason?: string
  fetched: number       // TourAPI 응답 item 합계
  upserted: number      // 실제 DB upsert 된 row 수 (modifiedtime 동일은 제외)
  translated: number    // 본 카테고리에서 번역된 행 수
  errors: string[]
}

export interface TourSpotsIngestResult {
  source: "tour-spots"
  total_upserted: number
  total_translated: number
  total_enriched: number      // detailCommon2 로 overview_ko 채운 row 수
  categories: CategoryRunResult[]
  errors: string[]
}

// ─── 마지막 성공 시각 조회 ────────────────────────────────────
// cron_logs 에 카테고리별 진행 상태를 별도 키로 박제하지 않고, 본 cron 라우트의
// 마지막 success 결과에서 본 카테고리 result 를 보고 판단.
// 단순화를 위해 "ingest-curation-k 의 어떤 실행이든 본 카테고리가 skipped=false 였던 시각"
// 을 마지막 성공으로 간주.
async function getLastCategorySuccess(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  contentTypeId: number
): Promise<Date | null> {
  // ingest-curation-k (신규) 와 ingest-tour-spots (구) 모두 확인 — 이관 전 기록도 유효하게 처리
  const { data, error } = await supabase
    .from("cron_logs")
    .select("result_json, executed_at")
    .in("route", ["ingest-curation-k", "ingest-tour-spots"])
    .eq("status", "success")
    .order("executed_at", { ascending: false })
    .limit(20)

  if (error || !data) return null

  for (const row of data) {
    const rj = row.result_json as { categories?: unknown } | null
    if (!rj || !Array.isArray(rj.categories)) continue
    const hit = (rj.categories as Array<Record<string, unknown>>).find(
      (c) => c.category === contentTypeId && c.skipped === false
    )
    if (hit) return new Date(row.executed_at)
  }
  return null
}

// 본 카테고리 row 가 DB 에 한 건도 없으면 → "최초 수집" 으로 간주, 강제 실행
async function isCategoryEmpty(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  contentTypeId: number
): Promise<boolean> {
  const { count, error } = await supabase
    .from("tour_spots")
    .select("id", { count: "exact", head: true })
    .eq("content_type_id", contentTypeId)
  if (error) return false
  return (count ?? 0) === 0
}

function daysSince(date: Date): number {
  const ms = Date.now() - date.getTime()
  return ms / (1000 * 60 * 60 * 24)
}

// ─── TourItem → tour_spots row 변환 ───────────────────────────
// content_id 단일 unique 키. modifiedtime 비교는 호출자에서 수행.
interface UpsertRow {
  content_id: string
  content_type_id: number
  title: string
  area_code: number | null
  sigungu_code: number | null
  addr1: string | null
  addr2: string | null
  latitude: number | null
  longitude: number | null
  image_url: string | null
  image_url2: string | null
  event_start_date: string | null
  event_end_date: string | null
  modified_time: string | null
}

function toUpsertRow(item: TourItem, contentTypeId: number): UpsertRow | null {
  if (!item.contentid || !item.title?.trim()) return null
  const mapxNum = item.mapx ? Number(item.mapx) : null
  const mapyNum = item.mapy ? Number(item.mapy) : null
  const lon =
    mapxNum !== null && Number.isFinite(mapxNum) && mapxNum !== 0 ? mapxNum : null
  const lat =
    mapyNum !== null && Number.isFinite(mapyNum) && mapyNum !== 0 ? mapyNum : null

  const toIntOrNull = (s: string | undefined): number | null => {
    if (!s) return null
    const n = parseInt(s, 10)
    return Number.isFinite(n) ? n : null
  }

  return {
    content_id: item.contentid,
    content_type_id: contentTypeId,
    title: item.title.trim(),
    area_code: toIntOrNull(item.areacode),
    sigungu_code: toIntOrNull(item.sigungucode),
    addr1: item.addr1?.trim() || null,
    addr2: item.addr2?.trim() || null,
    latitude: lat,
    longitude: lon,
    image_url: item.firstimage?.trim() || null,
    image_url2: item.firstimage2?.trim() || null,
    event_start_date: item.eventstartdate?.trim() || null,
    event_end_date: item.eventenddate?.trim() || null,
    modified_time: item.modifiedtime?.trim() || null,
  }
}

// ─── 카테고리 수집 — list 호출 + 증분 upsert ───────────────────
async function runCategory(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  config: CategoryConfig
): Promise<CategoryRunResult> {
  const result: CategoryRunResult = {
    category: config.contentTypeId,
    categoryName: config.name,
    skipped: false,
    fetched: 0,
    upserted: 0,
    translated: 0,
    errors: [],
  }

  // 1) interval 판단 — 본 카테고리 row 가 없으면 강제 실행
  const empty = await isCategoryEmpty(supabase, config.contentTypeId)
  if (!empty) {
    const lastRun = await getLastCategorySuccess(supabase, config.contentTypeId)
    if (lastRun && daysSince(lastRun) < config.intervalDays) {
      result.skipped = true
      result.skipReason = `interval ${config.intervalDays}d 미달 (마지막: ${lastRun.toISOString()})`
      return result
    }
  }

  // 2) 기존 (content_id → modified_time) 맵 — 증분 비교 용도
  // PostgREST 기본 cap(1,000행)을 우회하기 위해 1,000건씩 페이지네이션으로 전체 조회.
  const PAGE_SIZE = 1000
  const existingMap = new Map<string, string | null>()
  let pageNo = 0
  let fetchErr = false
  while (true) {
    const from = pageNo * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from("tour_spots")
      .select("content_id, modified_time")
      .eq("content_type_id", config.contentTypeId)
      .range(from, to)
    if (error) {
      result.errors.push(`existing 조회 실패 (page ${pageNo}): ${error.message}`)
      fetchErr = true
      break
    }
    const rows = (data ?? []) as Array<{ content_id: string; modified_time: string | null }>
    for (const r of rows) {
      existingMap.set(r.content_id, r.modified_time)
    }
    if (rows.length < PAGE_SIZE) break  // 마지막 페이지
    pageNo++
  }
  if (fetchErr) {
    // 오류 발생 시에도 진행 — 증분 비교 못 한 항목은 전부 upsert 됨
  }

  // 3) area 순회 fetch
  const collected: UpsertRow[] = []
  const today = new Date()
  const ymd = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
  // 축제·행사 범위: 당해년도 1/1 ~ 오늘 + 18개월. setMonth 가 월 오버플로우
  // 자동 처리 (예: 2026-05 + 18 = 2027-11).
  const eventStart = ymd(new Date(today.getFullYear(), 0, 1))
  const eventEndDate = new Date(today)
  eventEndDate.setMonth(eventEndDate.getMonth() + FESTIVAL_FUTURE_MONTHS)
  const eventEnd = ymd(eventEndDate)

  for (const areaCode of ALL_AREA_CODES) {
    try {
      const items: TourItem[] = []
      if (config.contentTypeId === CONTENT_TYPE.FESTIVAL) {
        // 축제는 인기 지역에 수백 건이 등록돼 있을 수 있어 페이지네이션 필요.
        // 응답이 ITEMS_PER_AREA 미만이면 마지막 페이지 → 루프 종료.
        let pageNo = 1
        while (pageNo <= MAX_FESTIVAL_PAGES_PER_AREA) {
          const res = await searchFestival({
            eventStartDate: eventStart,
            eventEndDate: eventEnd,
            areaCode,
            numOfRows: ITEMS_PER_AREA,
            pageNo,
          })
          items.push(...res.items)
          if (res.items.length < ITEMS_PER_AREA) break
          pageNo++
        }
      } else {
        const res = await areaBasedList({
          contentTypeId: config.contentTypeId,
          areaCode,
          numOfRows: ITEMS_PER_AREA,
          pageNo: 1,
        })
        items.push(...res.items)
      }
      result.fetched += items.length

      for (const item of items) {
        const row = toUpsertRow(item, config.contentTypeId)
        if (!row) continue

        // modifiedtime 동일하면 skip (불필요 update 회피)
        const prev = existingMap.get(row.content_id)
        if (
          prev !== undefined &&
          row.modified_time !== null &&
          prev !== null &&
          prev === row.modified_time
        ) {
          continue
        }
        collected.push(row)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`area=${areaCode} fetch: ${msg}`)
    }
  }

  // 4) upsert — content_id 충돌키
  if (collected.length > 0) {
    const { error: upErr, count } = await supabase
      .from("tour_spots")
      .upsert(collected, { onConflict: "content_id", count: "exact" })
    if (upErr) {
      result.errors.push(`upsert 실패: ${upErr.message}`)
    } else {
      result.upserted = count ?? collected.length
    }
  }

  return result
}

// ─── Claude Haiku 배치 번역 ────────────────────────────────────
// BATCH_SIZE 건씩 단일 호출 — 순차 1건/호출 대비 ~20× 속도 향상.
const BATCH_TRANSLATE_TOOL: Anthropic.Tool = {
  name: "report_batch_translations",
  description: "Submit English translations for a batch of Korean tourism spot entries.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        description: "One result per input item.",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "Item ID from input — return unchanged." },
            title_en: {
              type: "string",
              description: "English place name (≤80 chars). Include only if title_ko was provided.",
            },
            overview_en: {
              type: "string",
              description: "English tourism description (≤500 chars). Include only if overview_ko was provided.",
            },
          },
          required: ["id"],
        },
      },
    },
    required: ["items"],
  },
}

const BATCH_TRANSLATE_SYSTEM = `You translate Korean tourism content into English for UnfoldK, a Hallyu fan platform.

For each input item:
- title_en (only if title_ko given): English place name. Romanize Korean proper nouns (경복궁 → Gyeongbokgung Palace). ≤80 chars. Name only — no description or extra text.
- overview_en (only if overview_ko given): Natural English tourism description. Preserve all facts. Friendly tone for travelers. Strip HTML tags. ≤500 chars.

Return every item via the tool keyed by its original id. Only include title_en / overview_en for fields that were requested.`

// ─── detailCommon2 enrichment ────────────────────────────────
// list 엔드포인트는 overview 를 안 줘서 overview_ko 가 영구 null.
// 본 함수가 누락 row 를 모아 detailCommon2 호출 → overview_ko / homepage /
// modified_time 갱신. 다음 단계 translatePendingRows 에서 overview_en 생성.
interface EnrichmentStats {
  enriched: number
  errors: string[]
}

// TourAPI overview 는 종종 HTML 태그 (<br>, <strong>, ...) 포함 — 단순 strip
function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .trim()
}

async function enrichOverviews(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  cap: number,
  contentTypeFilter?: number
): Promise<EnrichmentStats> {
  const stats: EnrichmentStats = { enriched: 0, errors: [] }

  let q = supabase
    .from("tour_spots")
    .select("id, content_id")
    .is("overview_ko", null)
    .limit(cap)
  if (contentTypeFilter !== undefined) q = q.eq("content_type_id", contentTypeFilter)
  const { data, error } = await q

  if (error) {
    stats.errors.push(`enrichment 대기열 조회 실패: ${error.message}`)
    return stats
  }

  type Row = { id: string; content_id: string }
  const rows = (data ?? []) as Row[]

  for (const row of rows) {
    let detail: Awaited<ReturnType<typeof detailCommon>>
    try {
      detail = await detailCommon(row.content_id)
    } catch (err) {
      stats.errors.push(
        `detailCommon "${row.content_id}": ${err instanceof Error ? err.message : String(err)}`
      )
      continue
    }
    if (!detail) continue

    const updates: {
      overview_ko?: string
      homepage?: string
      modified_time?: string
    } = {}

    if (detail.overview) {
      const cleaned = stripHtml(detail.overview)
      if (cleaned.length > 0) updates.overview_ko = cleaned.slice(0, 4000)
    }
    if (detail.homepage) {
      const cleanedHome = detail.homepage.trim().slice(0, 1000)
      if (cleanedHome.length > 0) updates.homepage = cleanedHome
    }
    if (detail.modifiedtime) {
      updates.modified_time = detail.modifiedtime
    }

    if (Object.keys(updates).length === 0) continue

    const { error: upErr } = await supabase
      .from("tour_spots")
      .update(updates)
      .eq("id", row.id)

    if (upErr) {
      stats.errors.push(`enrichment 업데이트 실패 (${row.id}): ${upErr.message}`)
      continue
    }
    if (updates.overview_ko) stats.enriched++
  }

  return stats
}

interface TranslationStats {
  translated: number                       // 본 run 에서 update 발생한 row 수 (title+overview 합)
  byCategory: Map<number, number>          // category 별 update 발생 row 수
  errors: string[]
}

// title 에 한글이 포함되어 있는지 — 영문만이면 번역 skip
function hasHangul(s: string): boolean {
  return /[가-힣]/.test(s)
}

// title + overview 배치 번역.
// cap 은 "row" 단위. BATCH_SIZE 건씩 Claude 단일 호출 — 순차 대비 ~20× 빠름.
// 우선순위: 두 필드 모두 누락 > overview 만 누락 > title 만 누락.
async function translatePendingRows(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  cap: number,
  contentTypeFilter?: number
): Promise<TranslationStats> {
  const stats: TranslationStats = { translated: 0, byCategory: new Map(), errors: [] }

  let q = supabase
    .from("tour_spots")
    .select("id, content_type_id, title, eng_title, overview_ko, overview_en")
    .or("eng_title.is.null,and(overview_ko.not.is.null,overview_en.is.null)")
    .limit(cap * 2)
  if (contentTypeFilter !== undefined) q = q.eq("content_type_id", contentTypeFilter)
  const { data, error } = await q

  if (error) {
    stats.errors.push(`번역 대기열 조회 실패: ${error.message}`)
    return stats
  }

  type Row = {
    id: string
    content_type_id: number
    title: string
    eng_title: string | null
    overview_ko: string | null
    overview_en: string | null
  }
  const allRows = (data ?? []) as Row[]

  const scored = allRows
    .map((r) => {
      const needTitle = r.eng_title === null && hasHangul(r.title)
      const needOverview = r.overview_ko !== null && r.overview_en === null
      let score = 0
      if (needTitle && needOverview) score = 2
      else if (needOverview) score = 1
      else if (needTitle) score = 0
      return { r, needTitle, needOverview, score }
    })
    .filter((x) => x.needTitle || x.needOverview)

  scored.sort((a, b) => b.score - a.score)
  const rows = scored.slice(0, cap)

  // ── 배치 루프 ────────────────────────────────────────────────
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)

    const lines: string[] = [`Translate these ${batch.length} Korean tourism entries:`]
    for (const { r, needTitle, needOverview } of batch) {
      const parts: string[] = [`id: ${r.id}`]
      if (needTitle) parts.push(`title_ko: ${r.title.slice(0, 200)}`)
      if (needOverview && r.overview_ko) parts.push(`overview_ko: ${r.overview_ko.slice(0, 1500)}`)
      lines.push(parts.join(" | "))
    }
    lines.push("\nOutput all items through the tool.")

    const resultMap = new Map<string, { title_en?: string; overview_en?: string }>()
    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 8192,
        system: [
          { type: "text", text: BATCH_TRANSLATE_SYSTEM, cache_control: { type: "ephemeral" } },
        ],
        tools: [BATCH_TRANSLATE_TOOL],
        tool_choice: { type: "tool", name: BATCH_TRANSLATE_TOOL.name },
        messages: [{ role: "user", content: lines.join("\n") }],
      })

      const toolBlock = response.content.find(
        (b): b is Anthropic.ToolUseBlock =>
          b.type === "tool_use" && b.name === BATCH_TRANSLATE_TOOL.name
      )
      if (toolBlock) {
        const input = toolBlock.input as { items?: unknown }
        if (Array.isArray(input.items)) {
          for (const item of input.items as Array<Record<string, unknown>>) {
            if (typeof item.id !== "string") continue
            const entry: { title_en?: string; overview_en?: string } = {}
            if (typeof item.title_en === "string" && item.title_en.trim()) {
              entry.title_en = item.title_en.trim().slice(0, 80)
            }
            if (typeof item.overview_en === "string" && item.overview_en.trim()) {
              entry.overview_en = item.overview_en.trim().slice(0, 4000)
            }
            resultMap.set(item.id, entry)
          }
        }
      }
    } catch (err) {
      stats.errors.push(
        `배치 번역 실패 (batch ${Math.floor(i / BATCH_SIZE) + 1}): ${
          err instanceof Error ? err.message : String(err)
        }`
      )
      continue
    }

    // ── DB 업데이트 ────────────────────────────────────────────
    for (const { r } of batch) {
      const result = resultMap.get(r.id)
      if (!result) continue
      const updates: { eng_title?: string; overview_en?: string } = {}
      if (result.title_en) updates.eng_title = result.title_en
      if (result.overview_en) updates.overview_en = result.overview_en
      if (Object.keys(updates).length === 0) continue

      const { error: upErr } = await supabase
        .from("tour_spots")
        .update(updates)
        .eq("id", r.id)

      if (upErr) {
        stats.errors.push(`번역 업데이트 실패 (${r.id}): ${upErr.message}`)
        continue
      }
      stats.translated++
      stats.byCategory.set(r.content_type_id, (stats.byCategory.get(r.content_type_id) ?? 0) + 1)
    }
  }

  return stats
}

// ─── 메인 진입점 ──────────────────────────────────────────────
// onlyFestivals=true (일 cron / 어드민 "축제만(빠른)"):
//   - TourAPI fetch: 축제 카테고리(15)만
//   - enrichOverviews + translatePendingRows: 축제 카테고리만 필터
//
// onlyFestivals=false (주 1회 전체 cron):
//   - 5개 카테고리 전부 fetch + 전체 번역 backfill
//
// 번역은 배치 처리(BATCH_SIZE=20) — 300건 기준 ~75s, timeout 없음.
export async function runTourSpotsIngest(
  options: { onlyFestivals?: boolean } = {}
): Promise<TourSpotsIngestResult> {
  const result: TourSpotsIngestResult = {
    source: "tour-spots",
    total_upserted: 0,
    total_translated: 0,
    total_enriched: 0,
    categories: [],
    errors: [],
  }

  const supabase = createSupabaseAdminClient()
  const categoriesToRun = options.onlyFestivals
    ? CATEGORIES.filter((c) => c.contentTypeId === CONTENT_TYPE.FESTIVAL)
    : CATEGORIES
  // onlyFestivals=true 이면 enrich·번역도 축제 카테고리만 처리
  const contentTypeFilter = options.onlyFestivals ? CONTENT_TYPE.FESTIVAL : undefined

  // ── 1. TourAPI fetch ────────────────────────────────────────
  const t0 = Date.now()
  for (const config of categoriesToRun) {
    try {
      const cat = await runCategory(supabase, config)
      result.categories.push(cat)
      result.total_upserted += cat.upserted
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`${config.name}(${config.contentTypeId}) 예외: ${msg}`)
      result.categories.push({
        category: config.contentTypeId,
        categoryName: config.name,
        skipped: false,
        fetched: 0,
        upserted: 0,
        translated: 0,
        errors: [msg],
      })
    }
  }
  console.log(`[tour-spots] fetch 완료 ${Date.now() - t0}ms | upserted=${result.total_upserted}`)

  // ── 2. enrichOverviews — overview_ko 없는 row 에 detailCommon 호출 ──
  const t1 = Date.now()
  try {
    const enr = await enrichOverviews(supabase, MAX_DETAIL_ENRICHMENTS_PER_RUN, contentTypeFilter)
    result.total_enriched = enr.enriched
    if (enr.errors.length > 0) result.errors.push(...enr.errors)
  } catch (err) {
    result.errors.push(
      `enrichment 단계 예외: ${err instanceof Error ? err.message : String(err)}`
    )
  }
  console.log(`[tour-spots] enrich 완료 ${Date.now() - t1}ms | enriched=${result.total_enriched}`)

  // ── 3. translatePendingRows — Claude Haiku 배치 번역 ─────────
  const t2 = Date.now()
  try {
    const tr = await translatePendingRows(supabase, MAX_TRANSLATIONS_PER_RUN, contentTypeFilter)
    result.total_translated = tr.translated
    for (const cat of result.categories) {
      cat.translated = tr.byCategory.get(cat.category) ?? 0
    }
    if (tr.errors.length > 0) result.errors.push(...tr.errors)
  } catch (err) {
    result.errors.push(
      `번역 단계 예외: ${err instanceof Error ? err.message : String(err)}`
    )
  }
  console.log(`[tour-spots] 번역 완료 ${Date.now() - t2}ms | translated=${result.total_translated}`)

  return result
}
