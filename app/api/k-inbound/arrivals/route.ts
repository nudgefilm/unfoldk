import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const KOREA_AIRPORTS = new Set(["ICN", "GMP", "PUS", "CJU", "TAE", "KWJ", "CJJ"])

// IATA → 도시명 폴백 맵 (AeroDataBox municipalityName 없을 때 사용)
// 한국 취항 빈도 높은 공항 위주 + 일반 글로벌 허브
const IATA_CITY: Record<string, string> = {
  // ── 일본 ──────────────────────────────────────────────────────────────────
  NRT: "Tokyo",       HND: "Tokyo",       ITM: "Osaka",       KIX: "Osaka",
  UKB: "Kobe",        NGO: "Nagoya",      FUK: "Fukuoka",     KKJ: "Kita Kyushu",
  CTS: "Sapporo",     OKD: "Sapporo",     HKD: "Hakodate",    AKJ: "Asahikawa",
  MMB: "Abashiri",    OKA: "Okinawa",     MMY: "Miyako",      ISG: "Ishigaki",
  AOJ: "Aomori",      MSJ: "Misawa",      HNA: "Hanamaki",    SDJ: "Sendai",
  GAJ: "Yamagata",    FKS: "Fukushima",   AXT: "Akita",       KIJ: "Niigata",
  TOY: "Toyama",      KMQ: "Kanazawa",    FSZ: "Shizuoka",    OKJ: "Okayama",
  HIJ: "Hiroshima",   IWJ: "Masuda",      UBJ: "Yamaguchi",   TKS: "Tokushima",
  TAK: "Takamatsu",   MYJ: "Matsuyama",   KCZ: "Kochi",       OIT: "Oita",
  KOJ: "Kagoshima",   KMI: "Miyazaki",    NGS: "Nagasaki",
  // ── 중국 ──────────────────────────────────────────────────────────────────
  PEK: "Beijing",     PKX: "Beijing",     TSN: "Tianjin",     SJW: "Shijiazhuang",
  TYN: "Taiyuan",     PVG: "Shanghai",    SHA: "Shanghai",    NKG: "Nanjing",
  HGH: "Hangzhou",    WNZ: "Wenzhou",     NGB: "Ningbo",      FOC: "Fuzhou",
  XMN: "Xiamen",      CAN: "Guangzhou",   SZX: "Shenzhen",    BHY: "Beihai",
  ZHA: "Zhanjiang",   NNG: "Nanning",     HAK: "Haikou",      SYX: "Sanya",
  CTU: "Chengdu",     CKG: "Chongqing",   KMG: "Kunming",     XIY: "Xi'an",
  INC: "Yinchuan",    LHW: "Lanzhou",     URC: "Urumqi",      XNN: "Xining",
  WUH: "Wuhan",       CSX: "Changsha",    NKG2: "Nanjing",    KHN: "Nanchang",
  CGO: "Zhengzhou",   TAO: "Qingdao",     TNA: "Jinan",       YNT: "Yantai",
  WEH: "Weihai",      LYG: "Lianyungang", DLC: "Dalian",      SHE: "Shenyang",
  CGQ: "Changchun",   HRB: "Harbin",      MDG: "Mudanjiang",  YNJ: "Yanji",
  HKG: "Hong Kong",   MFM: "Macau",
  // ── 대만 ──────────────────────────────────────────────────────────────────
  TPE: "Taipei",      TSA: "Taipei",      KHH: "Kaohsiung",   RMQ: "Taichung",
  // ── 러시아 ────────────────────────────────────────────────────────────────
  VVO: "Vladivostok", KHV: "Khabarovsk",
  SVO: "Moscow",      DME: "Moscow",      VKO: "Moscow",      LED: "St. Petersburg",
  // ── 동남아 ────────────────────────────────────────────────────────────────
  BKK: "Bangkok",     DMK: "Bangkok",     HKT: "Phuket",      CNX: "Chiang Mai",
  SIN: "Singapore",
  KUL: "Kuala Lumpur", LGK: "Langkawi",   BKI: "Kota Kinabalu", KCH: "Kuching",
  CGK: "Jakarta",     DPS: "Bali",        SUB: "Surabaya",
  MNL: "Manila",      CEB: "Cebu",        DVO: "Davao",
  HAN: "Hanoi",       SGN: "Ho Chi Minh", DAD: "Da Nang",
  RGN: "Yangon",      MDL: "Mandalay",
  PNH: "Phnom Penh",  REP: "Siem Reap",
  VTE: "Vientiane",
  // ── 남아시아 ──────────────────────────────────────────────────────────────
  DEL: "Delhi",       BOM: "Mumbai",      MAA: "Chennai",     BLR: "Bengaluru",
  CCU: "Kolkata",     HYD: "Hyderabad",   AMD: "Ahmedabad",
  CMB: "Colombo",     DAC: "Dhaka",       KTM: "Kathmandu",
  // ── 중동 ──────────────────────────────────────────────────────────────────
  DXB: "Dubai",       AUH: "Abu Dhabi",   DOH: "Doha",
  RUH: "Riyadh",      JED: "Jeddah",      KWI: "Kuwait",
  TLV: "Tel Aviv",    AMM: "Amman",       CAI: "Cairo",
  // ── 유럽 ──────────────────────────────────────────────────────────────────
  IST: "Istanbul",    SAW: "Istanbul",
  LHR: "London",      LGW: "London",      STN: "London",
  CDG: "Paris",       ORY: "Paris",
  FRA: "Frankfurt",   MUC: "Munich",      DUS: "Düsseldorf",  BER: "Berlin",
  AMS: "Amsterdam",   ZRH: "Zurich",      VIE: "Vienna",
  ARN: "Stockholm",   OSL: "Oslo",        CPH: "Copenhagen",  HEL: "Helsinki",
  MAD: "Madrid",      BCN: "Barcelona",
  FCO: "Rome",        MXP: "Milan",       LIN: "Milan",
  BRU: "Brussels",    LIS: "Lisbon",
  PRG: "Prague",      WAW: "Warsaw",      BUD: "Budapest",    ATH: "Athens",
  // ── 북미 ──────────────────────────────────────────────────────────────────
  JFK: "New York",    EWR: "New York",    LAX: "Los Angeles", SFO: "San Francisco",
  ORD: "Chicago",     ATL: "Atlanta",     DFW: "Dallas",      MIA: "Miami",
  SEA: "Seattle",     BOS: "Boston",
  YVR: "Vancouver",   YYZ: "Toronto",     YUL: "Montreal",
  // ── 오세아니아 ────────────────────────────────────────────────────────────
  SYD: "Sydney",      MEL: "Melbourne",   BNE: "Brisbane",    AKL: "Auckland",
}

export interface ArrivalItem {
  number: string
  airline: string
  origin: string        // departure IATA
  originCity: string    // 표시용 도시명 (municipalityName → IATA_CITY → IATA fallback)
  scheduledArrival: string   // ISO local (AeroDataBox .local)
  estimatedArrival?: string  // ISO local
  status: string
}

// 도시명 결정: AeroDataBox municipalityName 우선 → IATA_CITY 맵 → IATA code fallback
function resolveCity(iata: string, municipalityName?: string): string {
  if (municipalityName && municipalityName.trim()) return municipalityName.trim()
  return IATA_CITY[iata] ?? iata
}

// 모듈 레벨 캐시
let arrivalsCache: { data: ArrivalItem[]; fetchedAt: number } | null = null
const CACHE_TTL = 10 * 60 * 1000

// KST 기준 오늘 날짜
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
        if (status === "Landed" || status === "Arrived") return null
        const etaMs = new Date(estimatedArrival ?? scheduledArrival).getTime()
        if (etaMs && etaMs < now) return null

        // AeroDataBox municipalityName 우선 → IATA_CITY 맵 → IATA fallback
        const municipalityName = (depAirport?.municipalityName as string) || undefined
        const originCity = resolveCity(origin, municipalityName)

        return {
          number:   (fl.number as string)                                    ?? "",
          airline:  ((fl.airline as Record<string, unknown>)?.name as string) ?? "",
          origin,
          originCity,
          scheduledArrival,
          estimatedArrival,
          status,
        }
      })
      .filter((item): item is ArrivalItem => item !== null && !!item.number && !!item.scheduledArrival)
      // ETA 오름차순
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
    if (arrivalsCache) {
      return NextResponse.json({ arrivals: arrivalsCache.data, cached: true, stale: true })
    }
    return NextResponse.json({ error: "Failed to fetch arrivals" }, { status: 500 })
  }
}
