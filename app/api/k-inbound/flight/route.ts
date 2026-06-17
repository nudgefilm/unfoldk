import { NextResponse } from "next/server"

// ── 공항 좌표 테이블 ──────────────────────────────────────────────────────────
const AIRPORT_COORDS: Record<string, { lat: number; lng: number }> = {
  ICN: { lat: 37.4602, lng: 126.4407 }, GMP: { lat: 37.5583, lng: 126.7906 },
  PUS: { lat: 35.1796, lng: 128.9381 }, CJU: { lat: 33.5113, lng: 126.4930 },
  TAE: { lat: 35.8941, lng: 128.6589 }, KWJ: { lat: 35.1264, lng: 126.8088 },
  CJJ: { lat: 36.7166, lng: 127.4991 }, NRT: { lat: 35.7647, lng: 140.3864 },
  HND: { lat: 35.5494, lng: 139.7798 }, KIX: { lat: 34.4272, lng: 135.2440 },
  FUK: { lat: 33.5852, lng: 130.4511 }, CTS: { lat: 42.7752, lng: 141.6922 },
  OKA: { lat: 26.1958, lng: 127.6461 }, NGO: { lat: 34.8583, lng: 136.8049 },
  PEK: { lat: 40.0799, lng: 116.6031 }, PVG: { lat: 31.1443, lng: 121.8083 },
  SHA: { lat: 31.1979, lng: 121.3362 }, CAN: { lat: 23.3924, lng: 113.2990 },
  CTU: { lat: 30.5785, lng: 103.9471 }, CKG: { lat: 29.7192, lng: 106.6417 },
  HKG: { lat: 22.3080, lng: 113.9185 }, MFM: { lat: 22.1496, lng: 113.5917 },
  TPE: { lat: 25.0777, lng: 121.2327 }, SIN: { lat: 1.3644, lng: 103.9915 },
  BKK: { lat: 13.6900, lng: 100.7501 }, HAN: { lat: 21.2187, lng: 105.8068 },
  SGN: { lat: 10.8188, lng: 106.6519 }, KUL: { lat: 2.7456, lng: 101.7099 },
  CGK: { lat: -6.1275, lng: 106.6537 }, MNL: { lat: 14.5086, lng: 121.0196 },
  DEL: { lat: 28.5665, lng: 77.1031 },  BOM: { lat: 19.0896, lng: 72.8656 },
  MAA: { lat: 12.9900, lng: 80.1693 },  CMB: { lat: 7.1808, lng: 79.8841 },
  DXB: { lat: 25.2532, lng: 55.3657 },  AUH: { lat: 24.4430, lng: 54.6511 },
  DOH: { lat: 25.2607, lng: 51.6138 },  RUH: { lat: 24.9578, lng: 46.7000 },
  KWI: { lat: 29.2267, lng: 47.9689 },  TLV: { lat: 32.0114, lng: 34.8867 },
  IST: { lat: 41.2753, lng: 28.7519 },  LHR: { lat: 51.4775, lng: -0.4614 },
  LGW: { lat: 51.1537, lng: -0.1821 },  CDG: { lat: 49.0097, lng: 2.5479 },
  ORY: { lat: 48.7233, lng: 2.3794 },   FRA: { lat: 50.0379, lng: 8.5622 },
  MUC: { lat: 48.3537, lng: 11.7750 },  AMS: { lat: 52.3086, lng: 4.7639 },
  ZRH: { lat: 47.4647, lng: 8.5492 },   VIE: { lat: 48.1103, lng: 16.5697 },
  MAD: { lat: 40.4936, lng: -3.5668 },  BCN: { lat: 41.2971, lng: 2.0785 },
  FCO: { lat: 41.8003, lng: 12.2389 },  MXP: { lat: 45.6306, lng: 8.7281 },
  CPH: { lat: 55.6180, lng: 12.6508 },  ARN: { lat: 59.6498, lng: 17.9238 },
  OSL: { lat: 60.1939, lng: 11.1004 },  HEL: { lat: 60.3172, lng: 24.9633 },
  BRU: { lat: 50.9014, lng: 4.4844 },   LIS: { lat: 38.7742, lng: -9.1342 },
  WAW: { lat: 52.1657, lng: 20.9671 },  PRG: { lat: 50.1008, lng: 14.2600 },
  ATH: { lat: 37.9364, lng: 23.9445 },  SVO: { lat: 55.9726, lng: 37.4146 },
  JFK: { lat: 40.6413, lng: -73.7781 }, LAX: { lat: 33.9425, lng: -118.4081 },
  ORD: { lat: 41.9742, lng: -87.9073 }, ATL: { lat: 33.6407, lng: -84.4277 },
  SFO: { lat: 37.6213, lng: -122.3790 }, SEA: { lat: 47.4502, lng: -122.3088 },
  DFW: { lat: 32.8998, lng: -97.0403 }, MIA: { lat: 25.7959, lng: -80.2870 },
  BOS: { lat: 42.3656, lng: -71.0096 }, YVR: { lat: 49.1947, lng: -123.1792 },
  YYZ: { lat: 43.6772, lng: -79.6306 }, MEX: { lat: 19.4363, lng: -99.0721 },
  GRU: { lat: -23.4356, lng: -46.4731 }, EZE: { lat: -34.8222, lng: -58.5358 },
  SCL: { lat: -33.3930, lng: -70.7858 }, BOG: { lat: 4.7016, lng: -74.1469 },
  LIM: { lat: -12.0219, lng: -77.1143 }, SYD: { lat: -33.9399, lng: 151.1753 },
  MEL: { lat: -37.6690, lng: 144.8410 }, AKL: { lat: -37.0082, lng: 174.7917 },
  JNB: { lat: -26.1392, lng: 28.2460 },  NBO: { lat: -1.3192, lng: 36.9275 },
  CAI: { lat: 30.1219, lng: 31.4056 },   ADD: { lat: 8.9779, lng: 38.7993 },
}

// ── 타입 ─────────────────────────────────────────────────────────────────────
export interface FlightData {
  number: string
  airline: string
  aircraft: string
  registration: string
  departure: {
    iata: string; name: string
    scheduledTime: string; actualTime?: string
    terminal?: string; gate?: string
    lat: number; lng: number
  }
  arrival: {
    iata: string; name: string
    scheduledTime: string; estimatedTime?: string
    lat: number; lng: number
  }
  status: string
  elapsedMs: number
  remainingMs: number
  distanceKm: number
  progressRatio: number
  estimatedAltitudeFt: number
  estimatedSpeedKmh: number
  bearingDeg: number
  fetchedAt: number    // 마지막 API 호출 시각 (ms) — 캐시 TTL 계산용
  timestamp: number    // fetchedAt과 동일 — 클라이언트 progress 보간 기준점
}

interface AeroRaw {
  number?: string
  airline?: { name?: string }
  aircraft?: { model?: string; reg?: string }
  departure?: {
    airport?: { iata?: string; name?: string }
    scheduledTime?: { local?: string }
    actualTime?: { local?: string }
    terminal?: string
    gate?: string
  }
  arrival?: {
    airport?: { iata?: string; name?: string }
    scheduledTime?: { local?: string }
    estimatedTime?: { local?: string }
  }
  status?: string
}

// ── 서버 메모리 캐시 ──────────────────────────────────────────────────────────
interface CacheEntry { data: FlightData; fetchedAt: number }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 10 * 60 * 1000 // 10분

// ── 계산 헬퍼 ────────────────────────────────────────────────────────────────
function toRad(d: number) { return d * Math.PI / 180 }

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function initialBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = toRad(lat1), φ2 = toRad(lat2), Δλ = toRad(lng2 - lng1)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

const AIRCRAFT_SPEEDS: Record<string, number> = {
  B777: 905, B747: 907, A380: 903, A350: 910, B787: 903,
  A330: 880, A320: 840, B737: 840, B738: 840, B789: 903,
}
function getSpeed(model: string): number {
  for (const [k, v] of Object.entries(AIRCRAFT_SPEEDS)) {
    if (model.toUpperCase().includes(k)) return v
  }
  return 880
}

function buildFlightData(raw: AeroRaw): FlightData {
  const now = Date.now()
  const depIata = raw.departure?.airport?.iata ?? ""
  const arrIata = raw.arrival?.airport?.iata ?? ""
  const depC = AIRPORT_COORDS[depIata] ?? { lat: 0, lng: 0 }
  const arrC = AIRPORT_COORDS[arrIata] ?? { lat: 0, lng: 0 }
  const model = raw.aircraft?.model ?? ""
  const speed = getSpeed(model)
  const distKm = Math.round(haversineKm(depC.lat, depC.lng, arrC.lat, arrC.lng))
  const bearing = Math.round(initialBearing(depC.lat, depC.lng, arrC.lat, arrC.lng))

  const actualDepMs = raw.departure?.actualTime?.local
    ? new Date(raw.departure.actualTime.local).getTime()
    : raw.departure?.scheduledTime?.local
    ? new Date(raw.departure.scheduledTime.local).getTime()
    : null

  const estArrMs = raw.arrival?.estimatedTime?.local
    ? new Date(raw.arrival.estimatedTime.local).getTime()
    : raw.arrival?.scheduledTime?.local
    ? new Date(raw.arrival.scheduledTime.local).getTime()
    : null

  const totalMs = actualDepMs && estArrMs ? estArrMs - actualDepMs : (distKm / speed) * 3_600_000
  const elapsedMs = actualDepMs ? Math.max(0, now - actualDepMs) : 0
  const remainingMs = estArrMs ? Math.max(0, estArrMs - now) : Math.max(0, totalMs - elapsedMs)
  const progressRatio = totalMs > 0 ? Math.min(elapsedMs / totalMs, 1) : 0

  let altFt = 0
  if (progressRatio < 0.05)      altFt = (progressRatio / 0.05) * 35000
  else if (progressRatio < 0.9)  altFt = 35000
  else                            altFt = ((1 - progressRatio) / 0.1) * 35000

  return {
    number: raw.number ?? "",
    airline: raw.airline?.name ?? "",
    aircraft: model,
    registration: raw.aircraft?.reg ?? "",
    departure: {
      iata: depIata, name: raw.departure?.airport?.name ?? "",
      scheduledTime: raw.departure?.scheduledTime?.local ?? "",
      actualTime: raw.departure?.actualTime?.local,
      terminal: raw.departure?.terminal,
      gate: raw.departure?.gate,
      lat: depC.lat, lng: depC.lng,
    },
    arrival: {
      iata: arrIata, name: raw.arrival?.airport?.name ?? "",
      scheduledTime: raw.arrival?.scheduledTime?.local ?? "",
      estimatedTime: raw.arrival?.estimatedTime?.local,
      lat: arrC.lat, lng: arrC.lng,
    },
    status: raw.status ?? "Unknown",
    elapsedMs, remainingMs, distanceKm: distKm,
    progressRatio, estimatedAltitudeFt: Math.round(altFt),
    estimatedSpeedKmh: speed, bearingDeg: bearing,
    fetchedAt: now, timestamp: now,
  }
}

function recompute(data: FlightData): FlightData {
  const now = Date.now()
  const depMs = data.departure.actualTime
    ? new Date(data.departure.actualTime).getTime()
    : new Date(data.departure.scheduledTime).getTime()
  const arrMs = data.arrival.estimatedTime
    ? new Date(data.arrival.estimatedTime).getTime()
    : new Date(data.arrival.scheduledTime).getTime()
  const totalMs = arrMs - depMs
  const elapsedMs = Math.max(0, now - depMs)
  const remainingMs = Math.max(0, arrMs - now)
  const progressRatio = totalMs > 0 ? Math.min(elapsedMs / totalMs, 1) : 0
  let altFt = 0
  if (progressRatio < 0.05)      altFt = (progressRatio / 0.05) * 35000
  else if (progressRatio < 0.9)  altFt = 35000
  else                            altFt = ((1 - progressRatio) / 0.1) * 35000
  return { ...data, elapsedMs, remainingMs, progressRatio, estimatedAltitudeFt: Math.round(altFt) }
}

// ── Route handler ────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const raw = searchParams.get("number")
  if (!raw) return NextResponse.json({ error: "Flight number required" }, { status: 400 })

  const flightNumber = raw.toUpperCase().replace(/\s+/g, "")
  const apiKey = process.env.AERODATABOX_API_KEY
  if (!apiKey) return NextResponse.json({ error: "Service not configured" }, { status: 503 })

  // 캐시 히트
  const entry = cache.get(flightNumber)
  if (entry && Date.now() - entry.fetchedAt < CACHE_TTL) {
    return NextResponse.json({ flight: recompute(entry.data), cached: true })
  }

  // AeroDataBox 호출
  try {
    const url = `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(flightNumber)}`
    const res = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com",
      },
      cache: "no-store",
    })

    if (res.status === 404) return NextResponse.json({ error: "Flight not found" }, { status: 404 })
    if (!res.ok) return NextResponse.json({ error: `AeroDataBox ${res.status}` }, { status: res.status })

    const body = await res.json()
    const rawFlight: AeroRaw = Array.isArray(body) ? body[0] : body
    if (!rawFlight) return NextResponse.json({ error: "Flight not found" }, { status: 404 })

    const flightData = buildFlightData(rawFlight)

    if (flightData.status === "Landed" || flightData.status === "Cancelled") {
      cache.delete(flightNumber)
    } else {
      cache.set(flightNumber, { data: flightData, fetchedAt: Date.now() })
    }

    return NextResponse.json({ flight: flightData, cached: false })
  } catch (err) {
    console.error("[k-inbound/flight]", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
