"use client"

import type { FlightData } from "@/app/api/k-inbound/flight/route"

interface Props { flight: FlightData | null }

function fmtTime(iso?: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
}
function delayMin(sched: string, actual?: string): number | null {
  if (!actual) return null
  return Math.round((new Date(actual).getTime() - new Date(sched).getTime()) / 60000)
}
function Row({ label, value, cls = "text-white" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-1 py-[3px]">
      <span className="text-[11px] uppercase tracking-wider text-[#cbd5e1] text-right pr-1 truncate">{label}</span>
      <span className={`text-[13px] font-semibold ${cls}`}>{value}</span>
    </div>
  )
}

export function FlightInfoPanel({ flight }: Props) {
  const dd = flight ? delayMin(flight.departure.scheduledTime, flight.departure.actualTime) : null
  const ad = flight ? delayMin(flight.arrival.scheduledTime, flight.arrival.estimatedTime) : null

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-black/75 backdrop-blur-sm border border-[#4a9eff]/30 rounded-xl p-4 overflow-hidden font-mono text-white">

      {/* 헤더 */}
      {flight ? (
        <div className="mb-3 pb-2 border-b border-[#4a9eff]/20">
          <div className="flex items-center gap-1.5">
            <span className="text-[#FF4B6E] text-base leading-none">✈</span>
            <span className="text-white font-bold tracking-wide text-[14px]">{flight.number}</span>
          </div>
          <div className="text-[12px] text-[#cbd5e1]/80 mt-0.5">{flight.airline}</div>
        </div>
      ) : (
        <div className="mb-3 pb-2 border-b border-[#4a9eff]/20">
          <div className="text-[#FF4B6E] text-xs font-bold tracking-widest">✈ K-INBOUND</div>
          <div className="text-[11px] text-[#4a9eff]/70 uppercase tracking-wider">FLIGHT SIMULATOR</div>
          <div className="mt-2 text-[11px] text-[#cbd5e1]/60 leading-relaxed">
            항공편 번호 입력 시<br />실시간 비행 정보 표시
          </div>
          <div className="text-[11px] text-[#4a9eff]/50 mt-1">KE017 · OZ201 · AA280</div>
        </div>
      )}

      {/* ROUTE */}
      <div className="text-[11px] uppercase tracking-wider text-[#cbd5e1] mb-0.5">Route</div>
      <div className="text-sm font-bold text-[#FF4B6E] mb-1">
        {flight ? `${flight.departure.iata} → ${flight.arrival.iata}` : "—"}
      </div>
      {flight && (
        <div className="text-[11px] text-[#cbd5e1]/70 mb-3 leading-relaxed">
          {flight.departure.name}<br />{flight.arrival.name}
        </div>
      )}
      {!flight && <div className="text-[11px] text-[#cbd5e1]/30 mb-3">—</div>}

      {/* DEPARTURE */}
      <div className="text-[11px] uppercase tracking-wider text-[#cbd5e1] mb-0.5 mt-1">Departure</div>
      <Row label="Scheduled" value={flight ? fmtTime(flight.departure.scheduledTime) : "—"} />
      <Row
        label="Actual"
        value={flight
          ? `${fmtTime(flight.departure.actualTime ?? flight.departure.scheduledTime)}${dd !== null && dd > 0 ? ` (+${dd}m)` : ""}`
          : "—"}
        cls={dd !== null ? (dd > 0 ? "text-[#ff4b6e]" : "text-[#4ade80]") : "text-white"}
      />

      {/* ARRIVAL */}
      <div className="text-[11px] uppercase tracking-wider text-[#cbd5e1] mb-0.5 mt-2">Arrival</div>
      <Row label="Scheduled" value={flight ? fmtTime(flight.arrival.scheduledTime) : "—"} />
      <Row
        label="Estimated"
        value={flight
          ? `${fmtTime(flight.arrival.estimatedTime ?? flight.arrival.scheduledTime)}${ad !== null && ad > 0 ? ` (+${ad}m)` : ""}`
          : "—"}
        cls={ad !== null ? (ad > 0 ? "text-[#ff4b6e]" : "text-[#4ade80]") : "text-white"}
      />

      {/* TERMINAL / GATE */}
      <div className="text-[11px] uppercase tracking-wider text-[#cbd5e1] mb-0.5 mt-2">Terminal / Gate</div>
      <Row label="Terminal" value={flight?.departure.terminal ?? "—"} />
      <Row label="Gate" value={flight?.departure.gate ?? "—"} />
    </div>
  )
}
