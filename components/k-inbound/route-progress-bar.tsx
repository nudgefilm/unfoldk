"use client"

import type { FlightData } from "@/app/api/k-inbound/flight/route"

interface Props { flight: FlightData | null }

// IATA → IANA 시간대 (서머타임 자동 적용)
const IATA_TZ: Record<string, string> = {
  ICN: "Asia/Seoul",    GMP: "Asia/Seoul",
  LAX: "America/Los_Angeles", SFO: "America/Los_Angeles", SEA: "America/Los_Angeles",
  JFK: "America/New_York",    MIA: "America/New_York",    ORD: "America/Chicago",
  NRT: "Asia/Tokyo",   HND: "Asia/Tokyo",
  LHR: "Europe/London",
  CDG: "Europe/Paris", FRA: "Europe/Berlin",
  DXB: "Asia/Dubai",
  SIN: "Asia/Singapore",
  SYD: "Australia/Sydney",
}

// scheduledTime은 이미 공항 현지 시각(local) — 브라우저 TZ 변환 없이 HH:MM 직접 추출
function extractTime(iso?: string): string {
  if (!iso) return ""
  const m = iso.match(/T(\d{2}:\d{2})/)
  return m ? m[1] : ""
}

// 현재 날짜 기준 IATA 공항의 시간대 약어 (PDT/PST, KST 등 서머타임 자동)
function getTzAbbr(iata?: string): string {
  if (!iata) return ""
  const tz = IATA_TZ[iata]
  if (!tz) return ""
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date())
  return parts.find(p => p.type === "timeZoneName")?.value ?? ""
}

export function RouteProgressBar({ flight }: Props) {
  const pct    = flight ? Math.round(flight.progressRatio * 100) : 0
  const depTz  = getTzAbbr(flight?.departure.iata)
  const arrTz  = getTzAbbr(flight?.arrival.iata)

  return (
    <div className="backdrop-blur-sm px-4 pt-2 pb-3 font-mono rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.15)" }}>
      <div>

        {/* 상단 레이블 행 */}
        <div className="flex items-center justify-between text-[13px] mb-1.5">
          <div className="flex items-baseline gap-1.5 min-w-[90px]">
            <span className="text-[#4a9eff] font-bold">{flight?.departure.iata ?? "—"}</span>
            {flight && <span className="text-[#94a3b8] text-[11px]">{extractTime(flight.departure.scheduledTime)}</span>}
            {flight && depTz && <span className="text-[#94a3b8]/60 text-[10px]">({depTz})</span>}
          </div>

          <div className="text-[#94a3b8] text-center text-[11px] px-2">
            {flight
              ? `${flight.number} · ${pct}% · ${flight.distanceKm.toLocaleString()} km`
              : "Track flights to and from Korea"}
          </div>

          <div className="flex items-baseline gap-1.5 justify-end min-w-[90px]">
            {flight && arrTz && <span className="text-[#94a3b8]/60 text-[10px]">({arrTz})</span>}
            {flight && <span className="text-[#94a3b8] text-[11px]">{extractTime(flight.arrival.scheduledTime)}</span>}
            <span className="text-[#4a9eff] font-bold">{flight?.arrival.iata ?? "—"}</span>
          </div>
        </div>

        {/* 진행 바 */}
        <div className="relative h-5 flex items-center">
          {/* 트랙 */}
          <div className="absolute inset-0 flex items-center">
            <div className="w-full h-[2px] bg-[#4a9eff]/12 rounded-full" />
          </div>
          {/* 진행 채움 */}
          <div className="absolute inset-0 flex items-center">
            <div
              className="h-[2px] bg-gradient-to-r from-[#4a9eff] to-[#00ff88] rounded-full transition-all duration-1000"
              style={{ width: `${pct}%` }}
            />
          </div>
          {/* 출발 도트 */}
          <div className="absolute left-0 w-2.5 h-2.5 rounded-full bg-[#4a9eff] border border-[#020c1b] -translate-x-0.5" />
          {/* 도착 도트 */}
          <div className="absolute right-0 w-2.5 h-2.5 rounded-full bg-[#4a9eff]/30 border border-[#4a9eff]/50 translate-x-0.5" />
          {/* ✈ 아이콘 (현재 위치) */}
          {flight && pct > 0 && (
            <div
              className="absolute text-[#ffd700] text-xs leading-none pointer-events-none transition-all duration-1000"
              style={{ left: `calc(${pct}% - 6px)`, top: "50%", transform: "translateY(-50%)" }}
            >
              ✈
            </div>
          )}
        </div>

        {/* 공항명 */}
        <div className="flex justify-between text-[11px] text-[#94a3b8] mt-0.5">
          <span className="truncate max-w-[45%]">{flight?.departure.name ?? ""}</span>
          <span className="truncate max-w-[45%] text-right">{flight?.arrival.name ?? ""}</span>
        </div>
      </div>
    </div>
  )
}
