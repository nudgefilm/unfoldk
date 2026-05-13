// Ticketmaster 글로벌 K팝 공연 → 'concert'/'fanmeet' 이벤트 인제스트
// classification=K-Pop OR keyword=K-pop 두 전략 병합 + 한국(KR) 제외 (KOPIS 와 중복 방지)

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  fetchTicketmasterEvents,
  toIso8601Z,
  pickBestImage,
  type TmEvent,
  type TmListResult,
} from "@/lib/api/ticketmaster"

export interface TicketmasterIngestResult {
  source: "ticketmaster"
  scanned: number       // dedupe 후 검토 이벤트 수
  upserted: number
  filtered_kr: number   // 한국 이벤트 제외 수
  error?: string
  details?: string
  hint?: string
  code?: string
  note?: string
}

// 공연명 키워드 기반 fanmeet 판정 — KOPIS 와 동일 패턴
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

export async function runTicketmasterIngest(): Promise<TicketmasterIngestResult> {
  const today = new Date()
  const sixMonthsLater = new Date()
  sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6)

  const baseParams = {
    startDateTime: toIso8601Z(today),
    endDateTime: toIso8601Z(sixMonthsLater),
    size: 100,
  }

  // 2전략 × 3페이지 = 최대 600건 사전 — Free tier 5,000/day 여유
  // 어느 한 페이지/전략 실패해도 다른 결과는 활용 (catch 로 빈 배열 반환)
  const pagesPerStrategy = 3
  const calls: Promise<TmListResult>[] = []
  for (let p = 0; p < pagesPerStrategy; p++) {
    calls.push(
      fetchTicketmasterEvents({
        ...baseParams,
        classificationName: "K-Pop",
        page: p,
      }).catch((e) => {
        console.error(`[ingest-ticketmaster] classification page ${p} 실패:`, e)
        return { events: [], page: { size: 0, totalElements: 0, totalPages: 0, number: p } }
      })
    )
    calls.push(
      fetchTicketmasterEvents({
        ...baseParams,
        keyword: "K-pop",
        page: p,
      }).catch((e) => {
        console.error(`[ingest-ticketmaster] keyword page ${p} 실패:`, e)
        return { events: [], page: { size: 0, totalElements: 0, totalPages: 0, number: p } }
      })
    )
  }
  const results = await Promise.all(calls)
  const allEvents = results.flatMap((r) => r.events)

  // event.id 로 dedupe — 두 전략 교집합 처리
  const dedupedMap = new Map<string, TmEvent>()
  for (const ev of allEvents) dedupedMap.set(ev.id, ev)
  const dedupedEvents = Array.from(dedupedMap.values())

  // 한국(KR) 이벤트 제외 — KOPIS 에서 이미 수집
  let filteredKr = 0
  const filtered = dedupedEvents.filter((ev) => {
    const country = ev._embedded?.venues?.[0]?.country?.countryCode
    if (country === "KR") {
      filteredKr++
      return false
    }
    return true
  })

  const rows = filtered
    .map((ev) => {
      const dateTime = ev.dates?.start?.dateTime
      if (!dateTime) return null

      const venue = ev._embedded?.venues?.[0]
      const attraction = ev._embedded?.attractions?.[0]
      const artistName = attraction?.name ?? ev.name

      const venueDesc = [venue?.name, venue?.city?.name, venue?.country?.name]
        .filter(Boolean)
        .join(" · ")

      return {
        type: classifyType(ev.name),
        title: ev.name,
        artist_or_drama: artistName,
        event_date: dateTime,
        event_time_label: toTimeLabel(ev.dates?.start?.localTime),
        description: venueDesc || null,
        source_api: "ticketmaster" as const,
        source_id: ev.id,
        thumbnail_url: pickBestImage(ev.images),
        is_premium: false,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  if (rows.length === 0) {
    return {
      source: "ticketmaster",
      scanned: dedupedEvents.length,
      upserted: 0,
      filtered_kr: filteredKr,
      note: "유효 이벤트 매칭 없음",
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
      source: "ticketmaster",
      scanned: dedupedEvents.length,
      upserted: 0,
      filtered_kr: filteredKr,
      error: error.message,
      details: error.details ?? undefined,
      hint: error.hint ?? undefined,
      code: error.code ?? undefined,
    }
  }

  return {
    source: "ticketmaster",
    scanned: dedupedEvents.length,
    upserted: data?.length ?? 0,
    filtered_kr: filteredKr,
  }
}
