"use client"

import type { FlightData } from "@/app/api/k-inbound/flight/route"

interface Props { flight: FlightData | null }

function fmtFlightTime(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return `${h}h ${m.toString().padStart(2, "0")}m`
}

function Row({ label, value, cls = "text-[#4a9eff]" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-1 py-[2px]">
      <span className="text-[9px] uppercase tracking-wider text-[#94a3b8]/55 text-right pr-1 truncate">{label}</span>
      <span className={`text-[11px] font-semibold ${cls} break-words`}>{value}</span>
    </div>
  )
}

export function AircraftInfoPanel({ flight }: Props) {
  const totalMs = flight ? flight.elapsedMs + flight.remainingMs : 0

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-black/75 backdrop-blur-sm border border-[#4a9eff]/30 rounded-xl p-4 overflow-y-auto font-mono text-white">
      <div className="text-[9px] uppercase tracking-wider text-[#94a3b8]/50 mb-2">Aircraft Info</div>

      <Row label="Registration" value={flight?.registration || "—"} />
      <Row label="Model" value={flight?.aircraft || "—"} />
      <Row label="Airline" value={flight?.airline || "—"} />

      <div className="border-t border-[#4a9eff]/15 my-2" />

      <Row
        label="Flight Dist"
        value={flight ? `${flight.distanceKm.toLocaleString()} km` : "—"}
      />
      <Row
        label="Flight Time"
        value={flight && totalMs > 0 ? `${fmtFlightTime(totalMs)} est` : "—"}
        cls="text-[#4a9eff]/80"
      />

      <div className="border-t border-[#4a9eff]/15 my-2" />

      <Row label="Codeshare" value="—" cls="text-[#94a3b8]/35" />
    </div>
  )
}
