// Ticketmaster 글로벌 K팝 공연 → 'concert'/'fanmeet' 이벤트 인제스트
// classification=K-Pop OR keyword=K-pop 두 전략 병합 + 한국(KR) 제외 (글로벌 유저 대상 정책)
// 응답 메트릭에 단계별 카운트 포함 — 0건 시 어느 단계에서 사라졌는지 추적

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  fetchTicketmasterEvents,
  toIso8601Z,
  pickBestImage,
  type TmEvent,
} from "@/lib/api/ticketmaster"

export interface TicketmasterIngestResult {
  source: "ticketmaster"
  scanned: number                         // dedupe 후 검토 이벤트 수
  upserted: number
  filtered_kr: number                     // KR 제외 수
  // 디버깅 메트릭 — 응답 0건 진단용
  classification_raw: number              // classificationName=K-Pop 페이지 누적 events
  classification_total_elements: number   // 첫 페이지 page.totalElements (API 전체 매칭 수)
  classification_error: string | null
  keyword_raw: number                     // keyword=K-pop 페이지 누적 events
  keyword_total_elements: number
  keyword_error: string | null
  dropped_no_date: number                 // dates.start.dateTime 없어 제외
  with_kpop_classification: number        // classifications 에 K-Pop (subGenre/genre) 매칭
  without_kpop_classification: number
  // 에러
  error?: string
  details?: string
  hint?: string
  code?: string
  note?: string
}

// 공연명 키워드 기반 fanmeet 판정
function classifyType(name: string): "concert" | "fanmeet" {
  const lower = name.toLowerCase()
  const fanmeetKeywords = [
    "fan meeting", "fanmeeting", "fanmeet", "fan-meet", "fancon",
    "팬미팅", "팬콘",
  ]
  return fanmeetKeywords.some((k) => lower.includes(k.toLowerCase()))
    ? "fanmeet"
    : "concert"
}

// localTime 'HH:mm:ss' → '7:00 PM' 형식
function toTimeLabel(localTime?: string): string | null {
  if (!localTime || !/^\d{2}:\d{2}/.test(localTime)) return null
  const [h, m] = localTime.split(":")
  const hour = parseInt(h, 10)
  if (isNaN(hour)) return null
  const ampm = hour >= 12 ? "PM" : "AM"
  const h12 = hour % 12 || 12
  return `${h12}:${m} ${ampm}`
}

// classifications subGenre/genre 에서 'K-Pop' / 'KPop' 등 매칭 (case-insensitive)
function hasKpopClassification(ev: TmEvent): boolean {
  return (ev.classifications ?? []).some((c) => {
    const sub = c.subGenre?.name ?? ""
    const gen = c.genre?.name ?? ""
    return /k-?pop/i.test(sub) || /k-?pop/i.test(gen)
  })
}

export async function runTicketmasterIngest(): Promise<TicketmasterIngestResult> {
  const today = new Date()
  const sixMonthsLater = new Date()
  sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6)

  const baseParams = {
    startDateTime: toIso8601Z(today),
    endDateTime: toIso8601Z(sixMonthsLater),
    size: 100,
  }

  const pagesPerStrategy = 3

  // classification 전략 — 직렬 호출로 에러 단계별 캡처
  // 200 응답인데 events 빈 배열인 경우는 throw 안 됨 → classification_raw=0 으로 잡힘
  const classificationEvents: TmEvent[] = []
  let classificationTotalElements = 0
  let classificationError: string | null = null
  for (let p = 0; p < pagesPerStrategy; p++) {
    try {
      const result = await fetchTicketmasterEvents({
        ...baseParams,
        classificationName: "K-Pop",
        page: p,
      })
      if (p === 0) classificationTotalElements = result.page.totalElements
      classificationEvents.push(...result.events)
      if (result.page.totalPages <= p + 1) break
    } catch (err) {
      classificationError = err instanceof Error ? err.message : "unknown"
      console.error(`[ingest-ticketmaster] classification page ${p} 실패:`, err)
      break
    }
  }

  // keyword 전략
  const keywordEvents: TmEvent[] = []
  let keywordTotalElements = 0
  let keywordError: string | null = null
  for (let p = 0; p < pagesPerStrategy; p++) {
    try {
      const result = await fetchTicketmasterEvents({
        ...baseParams,
        keyword: "K-pop",
        page: p,
      })
      if (p === 0) keywordTotalElements = result.page.totalElements
      keywordEvents.push(...result.events)
      if (result.page.totalPages <= p + 1) break
    } catch (err) {
      keywordError = err instanceof Error ? err.message : "unknown"
      console.error(`[ingest-ticketmaster] keyword page ${p} 실패:`, err)
      break
    }
  }

  // event.id 로 dedupe (두 전략 교집합 처리)
  const dedupedMap = new Map<string, TmEvent>()
  for (const ev of [...classificationEvents, ...keywordEvents]) {
    dedupedMap.set(ev.id, ev)
  }
  const dedupedEvents = Array.from(dedupedMap.values())

  // classifications K-Pop 매칭 분포 — keyword 전략은 K-Pop 아닌 이벤트도 잡을 수 있음
  let withKpopClassification = 0
  let withoutKpopClassification = 0
  for (const ev of dedupedEvents) {
    if (hasKpopClassification(ev)) withKpopClassification++
    else withoutKpopClassification++
  }

  // KR 제외 — UnfoldK 는 글로벌 유저 대상, 국내 전용 공연 (Melon Ticket 등) 은 노출 안 함
  let filteredKr = 0
  const filtered = dedupedEvents.filter((ev) => {
    const country = ev._embedded?.venues?.[0]?.country?.countryCode
    if (country === "KR") {
      filteredKr++
      return false
    }
    return true
  })

  // 행 생성 + dateTime 없는 이벤트 카운트
  let droppedNoDate = 0
  const rows = filtered
    .map((ev) => {
      const dateTime = ev.dates?.start?.dateTime
      if (!dateTime) {
        droppedNoDate++
        return null
      }
      const venue = ev._embedded?.venues?.[0]
      const attraction = ev._embedded?.attractions?.[0]
      const artistName = attraction?.name ?? ev.name

      return {
        type: classifyType(ev.name),
        title: ev.name,
        artist_or_drama: artistName,
        event_date: dateTime,
        event_time_label: toTimeLabel(ev.dates?.start?.localTime),
        // 2026-05-22 venue 정보를 별도 컬럼으로 분리 (0037 마이그레이션). description 은
        // 이제 다른 source_api 의 Claude 한 줄 요약과 의미 충돌 없게 명시적 null 로 비움.
        // upsert ignoreDuplicates:false 이므로 기존 행의 description="venue 합성 문자열"
        // 도 다음 cron 에서 자동 정리됨.
        description: null,
        venue_name: venue?.name ?? null,
        venue_city: venue?.city?.name ?? null,
        venue_country_code: venue?.country?.countryCode ?? null,
        source_api: "ticketmaster" as const,
        source_id: ev.id,
        thumbnail_url: pickBestImage(ev.images),
        // ev.url = Ticketmaster 공식 이벤트·티켓 페이지. UI 'Get Tickets' 버튼 링크.
        // upsert ignoreDuplicates:false 라서 기존 행도 다음 cron 에서 backfill 됨.
        url: ev.url ?? null,
        is_premium: false,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  const baseMetrics = {
    source: "ticketmaster" as const,
    scanned: dedupedEvents.length,
    filtered_kr: filteredKr,
    classification_raw: classificationEvents.length,
    classification_total_elements: classificationTotalElements,
    classification_error: classificationError,
    keyword_raw: keywordEvents.length,
    keyword_total_elements: keywordTotalElements,
    keyword_error: keywordError,
    dropped_no_date: droppedNoDate,
    with_kpop_classification: withKpopClassification,
    without_kpop_classification: withoutKpopClassification,
  }

  // 두 전략 모두 실패면 명시적 에러 — silent 0 방지
  if (classificationError && keywordError) {
    return {
      ...baseMetrics,
      upserted: 0,
      error: `두 전략 모두 실패: classification=${classificationError}, keyword=${keywordError}`,
    }
  }

  if (rows.length === 0) {
    return {
      ...baseMetrics,
      upserted: 0,
      note: "유효 이벤트 매칭 없음 — 디버깅 메트릭 확인",
    }
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("hallyu_calendar_events")
    .upsert(rows, {
      onConflict: "source_api,source_id",
      ignoreDuplicates: false,
    })
    .select("id")

  if (error) {
    console.error("[ingest-ticketmaster] upsert 실패:", error)
    return {
      ...baseMetrics,
      upserted: 0,
      error: error.message,
      details: error.details ?? undefined,
      hint: error.hint ?? undefined,
      code: error.code ?? undefined,
    }
  }

  return {
    ...baseMetrics,
    upserted: data?.length ?? 0,
  }
}
