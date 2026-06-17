"use client"

import { PlaneTakeoff, PlaneLanding, Clock } from "lucide-react"
import type { FlightData } from "@/app/api/k-inbound/flight/route"

interface Props { flight: FlightData }

function fmtTime(iso?: string): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
}

function delayMin(scheduled: string, actual?: string): number | null {
  if (!actual) return null
  const diff = (new Date(actual).getTime() - new Date(scheduled).getTime()) / 60000
  return Math.round(diff)
}

export function FlightInfoPanel({ flight }: Props) {
  const depDelay = delayMin(flight.departure.scheduledTime, flight.departure.actualTime)
  const arrDelay = delayMin(flight.arrival.scheduledTime, flight.arrival.estimatedTime)

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-56 pointer-events-none select-none">
      <div className="bg-[#020c1b]/80 backdrop-blur-md border border-[#1a4a7a]/50 rounded-2xl p-4 text-white">
        {/* 항공편 번호 */}
        <div className="mb-3 pb-3 border-b border-[#1a4a7a]/40">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#4da6ff]/70 mb-0.5">Flight</p>
          <p className="text-xl font-bold tracking-wide">{flight.number}</p>
          <p className="text-xs text-[#aac4e0]/70 mt-0.5">{flight.airline}</p>
        </div>

        {/* 출발 */}
        <div className="mb-3 flex items-start gap-2">
          <PlaneTakeoff className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#4da6ff]" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#4da6ff]/70">Departure</p>
            <p className="text-sm font-semibold">{flight.departure.iata}</p>
            <p className="text-[11px] text-[#aac4e0]/70 leading-tight">{flight.departure.name}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Clock className="w-3 h-3 text-[#aac4e0]/50" />
              <span className="text-xs tabular-nums">
                {fmtTime(flight.departure.actualTime ?? flight.departure.scheduledTime)}
              </span>
              {depDelay !== null && depDelay > 0 && (
                <span className="text-[10px] text-orange-400">+{depDelay}m</span>
              )}
              {depDelay !== null && depDelay <= 0 && (
                <span className="text-[10px] text-emerald-400">On time</span>
              )}
            </div>
            {(flight.departure.terminal || flight.departure.gate) && (
              <p className="text-[10px] text-[#aac4e0]/50 mt-0.5">
                {flight.departure.terminal && `T${flight.departure.terminal}`}
                {flight.departure.terminal && flight.departure.gate && " · "}
                {flight.departure.gate && `Gate ${flight.departure.gate}`}
              </p>
            )}
          </div>
        </div>

        {/* 도착 */}
        <div className="flex items-start gap-2">
          <PlaneLanding className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#00e5ff]" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#00e5ff]/70">Arrival</p>
            <p className="text-sm font-semibold">{flight.arrival.iata}</p>
            <p className="text-[11px] text-[#aac4e0]/70 leading-tight">{flight.arrival.name}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Clock className="w-3 h-3 text-[#aac4e0]/50" />
              <span className="text-xs tabular-nums">
                {fmtTime(flight.arrival.estimatedTime ?? flight.arrival.scheduledTime)}
              </span>
              {arrDelay !== null && arrDelay > 0 && (
                <span className="text-[10px] text-orange-400">+{arrDelay}m</span>
              )}
              {arrDelay !== null && arrDelay <= 0 && (
                <span className="text-[10px] text-emerald-400">On time</span>
              )}
            </div>
          </div>
        </div>

        {/* 기체 정보 */}
        {(flight.aircraft || flight.registration) && (
          <div className="mt-3 pt-3 border-t border-[#1a4a7a]/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#4da6ff]/70 mb-1">Aircraft</p>
            {flight.aircraft && <p className="text-xs text-white/80">{flight.aircraft}</p>}
            {flight.registration && (
              <p className="text-[10px] text-[#aac4e0]/50">{flight.registration}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
