import { NextResponse } from "next/server"
import { cache, buildFlightData } from "../flight/route"
import type { AeroRaw } from "../flight/route"

export const dynamic = "force-dynamic"

// KST 기준 오늘 날짜 반환 (Vercel Cron은 UTC 기준 — ICN 현지 날짜와 일치시킴)
function todayKST(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().split("T")[0]
}

function getEtaMs(f: AeroRaw): number {
  const t = f.arrival?.estimatedTime?.local ?? f.arrival?.scheduledTime?.local
  return t ? new Date(t).getTime() : Infinity
}

// 2026-07-05 AeroDataBox 비용/쿼터 이슈로 임시 차단 — 복원 시 이 상수만 false로
const AERODATABOX_BLOCKED = true

export async function GET() {
  if (AERODATABOX_BLOCKED) {
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 })
  }

  const apiKey = process.env.AERODATABOX_API_KEY
  if (!apiKey) return NextResponse.json({ error: "Service not configured" }, { status: 503 })

  try {
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
    if (!res.ok) return NextResponse.json({ error: `FIDS ${res.status}` }, { status: res.status })

    const body = await res.json() as { arrivals?: AeroRaw[] }
    if (!Array.isArray(body.arrivals) || body.arrivals.length === 0) {
      return NextResponse.json({ error: "No arrivals today" }, { status: 404 })
    }

    const now = Date.now()

    // EnRoute 또는 Departed 상태 편만 추출
    const active = body.arrivals.filter(f => f.status === "Active" || f.status === "EnRoute" || f.status === "Departed")
    if (active.length === 0) {
      return NextResponse.json({ error: "No active flights" }, { status: 404 })
    }

    // 현재 시각 기준 ETA 가장 가까운 편 선정
    active.sort((a, b) => Math.abs(getEtaMs(a) - now) - Math.abs(getEtaMs(b) - now))
    const best = active[0]

    const flightData = buildFlightData(best)
    if (!flightData.number) {
      return NextResponse.json({ error: "Invalid flight data" }, { status: 500 })
    }

    // 기존 flight API 캐시에 동일한 방식으로 저장
    cache.set(flightData.number, { data: flightData, fetchedAt: now })

    console.log(`[k-inbound/cron] cached ${flightData.number} (ETA ${new Date(getEtaMs(best)).toISOString()})`)
    return NextResponse.json({ ok: true, flight: flightData.number })
  } catch (err) {
    console.error("[k-inbound/cron]", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
