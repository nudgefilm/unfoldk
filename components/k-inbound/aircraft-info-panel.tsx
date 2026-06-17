"use client"

import type { FlightData } from "@/app/api/k-inbound/flight/route"

interface Props { flight: FlightData | null }

function fmtFlightTime(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return `${h}h ${m.toString().padStart(2, "0")}m`
}

function Row({ label, value, cls = "text-white" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-1 py-px group cursor-default">
      <span className="text-[11px] uppercase tracking-wider text-[#cbd5e1] text-right pr-1 truncate transition-colors duration-150 group-hover:text-white">{label}</span>
      <span className={`text-[13px] font-semibold transition-all duration-150 group-hover:brightness-[1.12] ${cls} break-words`}>{value}</span>
    </div>
  )
}

export function AircraftInfoPanel({ flight }: Props) {
  const totalMs = flight ? flight.elapsedMs + flight.remainingMs : 0

  return (
    <div className="shrink-0 flex flex-col bg-black/75 backdrop-blur-sm border border-[#4a9eff]/30 rounded-xl p-3 font-mono text-white">
      <div className="text-[11px] uppercase tracking-wider text-[#cbd5e1] mb-1 hover:text-white transition-colors duration-150 cursor-default">Aircraft Info</div>

      <Row label="Registration" value={flight?.registration || "—"} />
      <Row label="Model" value={flight?.aircraft || "—"} />
      <Row label="Airline" value={flight?.airline || "—"} />

      <div className="border-t border-[#4a9eff]/15 my-1.5" />

      <Row
        label="Flight Dist"
        value={flight ? `${flight.distanceKm.toLocaleString()} km` : "—"}
      />
      <Row
        label="Flight Time"
        value={flight && totalMs > 0 ? `${fmtFlightTime(totalMs)} est` : "—"}
        cls="text-[#cbd5e1]/80"
      />

      <div className="border-t border-[#4a9eff]/15 my-1.5" />

      <Row label="Codeshare" value="—" cls="text-[#cbd5e1]/40" />
    </div>
  )
}
