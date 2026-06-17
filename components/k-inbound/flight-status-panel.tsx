"use client"

import { Gauge, ArrowUp, Compass, Wifi } from "lucide-react"
import type { FlightData } from "@/app/api/k-inbound/flight/route"

interface Props { flight: FlightData }

function fmtMs(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  "En Route":   { bg: "bg-emerald-400/20", text: "text-emerald-400" },
  "Active":     { bg: "bg-emerald-400/20", text: "text-emerald-400" },
  "Delayed":    { bg: "bg-orange-400/20",  text: "text-orange-400"  },
  "Landed":     { bg: "bg-blue-400/20",    text: "text-blue-400"    },
  "Cancelled":  { bg: "bg-red-400/20",     text: "text-red-400"     },
  "Scheduled":  { bg: "bg-[#4da6ff]/20",   text: "text-[#4da6ff]"  },
}

function statusStyle(s: string) {
  return STATUS_STYLES[s] ?? { bg: "bg-white/10", text: "text-white/60" }
}

export function FlightStatusPanel({ flight }: Props) {
  const { bg, text } = statusStyle(flight.status)
  const pct = Math.round(flight.progressRatio * 100)

  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-52 pointer-events-none select-none">
      <div className="bg-[#020c1b]/80 backdrop-blur-md border border-[#1a4a7a]/50 rounded-2xl p-4 text-white">
        {/* 상태 뱃지 */}
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#1a4a7a]/40">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#4da6ff]/70">Status</p>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${bg} ${text}`}>
            {flight.status}
          </span>
        </div>

        {/* 경과·잔여 */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <p className="text-[10px] text-[#aac4e0]/60 mb-0.5">Elapsed</p>
            <p className="text-sm font-semibold tabular-nums">{fmtMs(flight.elapsedMs)}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#aac4e0]/60 mb-0.5">Remaining</p>
            <p className="text-sm font-semibold tabular-nums">{fmtMs(flight.remainingMs)}</p>
          </div>
        </div>

        {/* 거리 */}
        <div className="mb-3 pb-3 border-b border-[#1a4a7a]/40">
          <p className="text-[10px] text-[#aac4e0]/60 mb-0.5">Distance</p>
          <p className="text-sm font-semibold tabular-nums">{flight.distanceKm.toLocaleString()} km</p>
        </div>

        {/* 고도 */}
        <div className="flex items-center gap-2 mb-2.5">
          <ArrowUp className="w-3.5 h-3.5 text-[#4da6ff] shrink-0" />
          <div>
            <p className="text-[10px] text-[#aac4e0]/60">Altitude</p>
            <p className="text-xs font-semibold tabular-nums">
              {flight.estimatedAltitudeFt.toLocaleString()} ft
            </p>
          </div>
        </div>

        {/* 속도 */}
        <div className="flex items-center gap-2 mb-2.5">
          <Gauge className="w-3.5 h-3.5 text-[#4da6ff] shrink-0" />
          <div>
            <p className="text-[10px] text-[#aac4e0]/60">Speed</p>
            <p className="text-xs font-semibold tabular-nums">{flight.estimatedSpeedKmh} km/h</p>
          </div>
        </div>

        {/* 방위 */}
        <div className="flex items-center gap-2 mb-3">
          <Compass className="w-3.5 h-3.5 text-[#4da6ff] shrink-0" />
          <div>
            <p className="text-[10px] text-[#aac4e0]/60">Bearing</p>
            <p className="text-xs font-semibold tabular-nums">{flight.bearingDeg}°</p>
          </div>
        </div>

        {/* 진행도 바 */}
        <div className="pt-3 border-t border-[#1a4a7a]/40">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-[#4da6ff]/70">{flight.departure.iata}</span>
            <span className="text-[10px] text-[#aac4e0]/50 tabular-nums">{pct}%</span>
            <span className="text-[10px] text-[#00e5ff]/70">{flight.arrival.iata}</span>
          </div>
          <div className="h-1 w-full bg-[#0a2840] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#4da6ff] to-[#00e5ff] rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* 신호 */}
        <div className="mt-3 flex items-center gap-1.5">
          <Wifi className="w-3 h-3 text-emerald-400/70" />
          <span className="text-[10px] text-emerald-400/70">Live signal</span>
        </div>
      </div>
    </div>
  )
}
