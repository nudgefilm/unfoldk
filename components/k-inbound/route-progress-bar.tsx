"use client"

import type { FlightData } from "@/app/api/k-inbound/flight/route"

interface Props { flight: FlightData | null }

function fmtTime(iso?: string) {
  if (!iso) return ""
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
}

export function RouteProgressBar({ flight }: Props) {
  const pct = flight ? Math.round(flight.progressRatio * 100) : 0

  return (
    <div className="shrink-0 bg-black/75 backdrop-blur-sm border-t border-[#4a9eff]/20 px-4 pt-2 pb-3 font-mono">
      <div className="max-w-3xl mx-auto">

        {/* 상단 레이블 행 */}
        <div className="flex items-center justify-between text-[10px] mb-1.5">
          <div className="flex items-baseline gap-1.5 min-w-[80px]">
            <span className="text-[#4a9eff] font-bold">{flight?.departure.iata ?? "—"}</span>
            {flight && <span className="text-[#94a3b8]/50">{fmtTime(flight.departure.scheduledTime)}</span>}
          </div>

          <div className="text-[#94a3b8]/45 text-center text-[9px] px-2">
            {flight
              ? `${flight.number} · ${pct}% · ${flight.distanceKm.toLocaleString()} km`
              : "Search a flight to see the route"}
          </div>

          <div className="flex items-baseline gap-1.5 justify-end min-w-[80px]">
            {flight && <span className="text-[#94a3b8]/50">{fmtTime(flight.arrival.scheduledTime)}</span>}
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
        <div className="flex justify-between text-[9px] text-[#94a3b8]/40 mt-0.5">
          <span className="truncate max-w-[45%]">{flight?.departure.name ?? ""}</span>
          <span className="truncate max-w-[45%] text-right">{flight?.arrival.name ?? ""}</span>
        </div>
      </div>
    </div>
  )
}
