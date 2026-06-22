import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const KOREA_AIRPORTS = new Set(["ICN", "GMP", "PUS", "CJU", "TAE", "KWJ", "CJJ"])

export interface ArrivalItem {
  number: string
  airline: string
  origin: string        // departure IATA
  originName: string    // departure airport name
  scheduledArrival: string   // ISO local (AeroDataBox .local)
  estimatedArrival?: string  // ISO local — 있으면 지연 여부 판단 가능
  status: string
}

// 모듈 레벨 캐시 — cron 캐시와 별도로 전체 목록 보관
let arrivalsCache: { data: ArrivalItem[]; fetchedAt: number } | null = null
const CACHE_TTL = 10 * 60 * 1000

// KST 기준 오늘 날짜 (AeroDataBox dateFrom/dateTo 용)
function todayKST(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().split("T")[0]
}

async function fetchFromAeroDataBox(apiKey: string): Promise<ArrivalItem[]> {
  const today = todayKST()
  const url =
    `https://aerodatabox.p.rapidapi.com/flights/airports/iata/ICN` +
    `?withLeg=true&direction=Arrival&dateFrom=${today}&dateTo=${today}` +
    `&withCancelled=false&withCodeshared=false`

  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key":  apiKey,
      "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com",
    },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`AeroDataBox ${res.status}`)

  const body = await res.json() as { arrivals?: unknown[] }
  if (!Array.isArray(body.arrivals)) return []

  const now = Date.now()

  return (
    body.arrivals
      .map((f: unknown): ArrivalItem | null => {
        const fl  = f as Record<string, unknown>
        const dep = fl.departure as Record<string, unknown> | undefined
        const arr = fl.arrival   as Record<string, unknown> | undefined
        const depAirport = dep?.airport as Record<string, unknown> | undefined
        const origin = (depAirport?.iata as string) ?? ""
        if (!origin || KOREA_AIRPORTS.has(origin)) return null  // 국내선 제외

        const scheduledArrival =
          ((arr?.scheduledTime as Record<string, unknown> | undefined)?.local as string) ?? ""
        const estimatedArrival =
          ((arr?.estimatedTime as Record<string, unknown> | undefined)?.local as string) || undefined
        const status = (fl.status as string) ?? "Unknown"

        // 이미 착륙했거나 ETA가 현재 시각 이전인 편 제외
        const isLanded = status === "Landed" || status === "Arrived"
        if (isLanded) return null

        const etaMs = new Date(estimatedArrival ?? scheduledArrival).getTime()
        if (etaMs && etaMs < now) return null

        return {
          number:   (fl.number as string)                           ?? "",
          airline:  ((fl.airline as Record<string, unknown>)?.name as string) ?? "",
          origin,
          originName: (depAirport?.name as string)                  ?? "",
          scheduledArrival,
          estimatedArrival,
          status,
        }
      })
      .filter((item): item is ArrivalItem => item !== null && !!item.number && !!item.scheduledArrival)
      // ETA 오름차순 정렬
      .sort((a, b) => {
        const aMs = new Date(a.estimatedArrival ?? a.scheduledArrival).getTime()
        const bMs = new Date(b.estimatedArrival ?? b.scheduledArrival).getTime()
        return aMs - bMs
      })
      .slice(0, 15)
  )
}

export async function GET() {
  const apiKey = process.env.AERODATABOX_API_KEY
  if (!apiKey) return NextResponse.json({ error: "Service not configured" }, { status: 503 })

  // 캐시 히트
  if (arrivalsCache && Date.now() - arrivalsCache.fetchedAt < CACHE_TTL) {
    return NextResponse.json({ arrivals: arrivalsCache.data, cached: true })
  }

  try {
    const arrivals = await fetchFromAeroDataBox(apiKey)
    arrivalsCache = { data: arrivals, fetchedAt: Date.now() }
    console.log(`[k-inbound/arrivals] fetched ${arrivals.length} ICN arrivals`)
    return NextResponse.json({ arrivals, cached: false })
  } catch (err) {
    console.error("[k-inbound/arrivals]", err)
    // 만료된 캐시라도 있으면 반환 (AeroDataBox 오류 시 graceful fallback)
    if (arrivalsCache) {
      return NextResponse.json({ arrivals: arrivalsCache.data, cached: true, stale: true })
    }
    return NextResponse.json({ error: "Failed to fetch arrivals" }, { status: 500 })
  }
}
