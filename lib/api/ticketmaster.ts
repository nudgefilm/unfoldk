// Ticketmaster Discovery API v2 래퍼
// 공식 문서: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
// 응답 형식: JSON (별도 파서 불필요)
// ⚠️ API 키는 절대 하드코딩 금지 — process.env.TICKETMASTER_API_KEY 만 참조

const TM_BASE = "https://app.ticketmaster.com/discovery/v2/events.json"

export interface TmEvent {
  id: string
  name: string
  url?: string
  images?: Array<{
    url: string
    width?: number
    height?: number
    ratio?: string       // '16_9' | '3_2' | '4_3' 등
  }>
  dates?: {
    start?: {
      dateTime?: string  // ISO 8601 UTC
      localDate?: string // 'YYYY-MM-DD'
      localTime?: string // 'HH:mm:ss'
    }
    timezone?: string
  }
  classifications?: Array<{
    segment?: { name?: string }
    genre?: { name?: string }
    subGenre?: { name?: string }
  }>
  _embedded?: {
    venues?: Array<{
      name?: string
      city?: { name?: string }
      country?: { countryCode?: string; name?: string }
    }>
    attractions?: Array<{
      name?: string
    }>
  }
}

interface TmEventsResponse {
  _embedded?: { events?: TmEvent[] }
  page?: {
    size: number
    totalElements: number
    totalPages: number
    number: number
  }
}

export interface TmListParams {
  classificationName?: string
  keyword?: string
  startDateTime: string  // ISO 8601 'YYYY-MM-DDTHH:mm:ssZ' (Z 필수)
  endDateTime: string
  size?: number          // 최대 200, 단 size*page <= 1000
  page?: number          // 0-based
}

export interface TmListResult {
  events: TmEvent[]
  page: {
    size: number
    totalElements: number
    totalPages: number
    number: number
  }
}

export async function fetchTicketmasterEvents(
  params: TmListParams
): Promise<TmListResult> {
  const apiKey = process.env.TICKETMASTER_API_KEY
  if (!apiKey) throw new Error("TICKETMASTER_API_KEY 미설정")

  const qs = new URLSearchParams({
    apikey: apiKey,
    startDateTime: params.startDateTime,
    endDateTime: params.endDateTime,
    size: String(params.size ?? 100),
    page: String(params.page ?? 0),
    locale: "en-us,*",
  })
  if (params.classificationName) qs.set("classificationName", params.classificationName)
  if (params.keyword) qs.set("keyword", params.keyword)

  const url = `${TM_BASE}?${qs.toString()}`
  const res = await fetch(url, { next: { revalidate: 3600 } })
  if (!res.ok) {
    throw new Error(`Ticketmaster events error ${res.status}: ${await res.text()}`)
  }
  const data = (await res.json()) as TmEventsResponse
  return {
    events: data._embedded?.events ?? [],
    page: data.page ?? { size: 0, totalElements: 0, totalPages: 0, number: 0 },
  }
}

// Ticketmaster v2 는 timezone offset 거부, Z 끝나는 ISO 8601 만 허용
export function toIso8601Z(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z")
}

// 가장 적합한 이미지 선택 — 16:9 비율 우선, 그 다음 width 큰 순
export function pickBestImage(images?: TmEvent["images"]): string | null {
  if (!images || images.length === 0) return null
  const sorted = [...images].sort((a, b) => {
    const aPref = a.ratio === "16_9" ? 1 : 0
    const bPref = b.ratio === "16_9" ? 1 : 0
    if (aPref !== bPref) return bPref - aPref
    return (b.width ?? 0) - (a.width ?? 0)
  })
  return sorted[0]?.url ?? null
}
