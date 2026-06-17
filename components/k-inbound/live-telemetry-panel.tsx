"use client"

import type { FlightData } from "@/app/api/k-inbound/flight/route"

interface Props { flight: FlightData | null }

function bearingDir(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
  return dirs[Math.round(deg / 45) % 8]
}

function flightPhase(p: number, status: string): string {
  if (status === "Landed" || status === "Cancelled" || status === "Diverted") return status.toUpperCase()
  if (p <= 0)    return "BOARDING"
  if (p < 0.02)  return "TAXI"
  if (p < 0.06)  return "TAKEOFF"
  if (p < 0.15)  return "CLIMB"
  if (p < 0.88)  return "CRUISE"
  if (p < 0.95)  return "DESCENT"
  if (p < 1.0)   return "APPROACH"
  return "LANDED"
}

function altPhase(p: number): string {
  if (p < 0.05) return "CLIMBING ↑"
  if (p < 0.90) return "CRUISING"
  return "DESCENDING ↓"
}

function Row({ label, value, sub, cls = "text-white" }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-1 py-px group cursor-default">
      <span className="text-[11px] uppercase tracking-wider text-[#cbd5e1] text-right pr-1 truncate transition-colors duration-150 group-hover:text-white">{label}</span>
      <span className={`text-[13px] font-semibold transition-all duration-150 group-hover:brightness-125 ${cls}`}>
        {value}
        {sub && <span className="text-[10px] text-[#cbd5e1]/55 ml-1 font-normal">{sub}</span>}
      </span>
    </div>
  )
}

export function LiveTelemetryPanel({ flight }: Props) {
  const p     = flight?.progressRatio ?? 0
  const phase = flight ? flightPhase(p, flight.status) : "GROUND"
  const phaseCls = phase === "CRUISE" || phase === "LANDED" ? "text-[#4ade80]" : "text-white"

  return (
    <div className="shrink-0 flex flex-col bg-black/75 backdrop-blur-sm border border-[#4a9eff]/30 rounded-xl p-3 font-mono text-white">
      <div className="text-[11px] uppercase tracking-wider text-[#cbd5e1] mb-1 hover:text-white transition-colors duration-150 cursor-default">Live Telemetry</div>

      <Row
        label="Est Altitude"
        value={flight ? `${flight.estimatedAltitudeFt.toLocaleString()} ft` : "—"}
        sub={flight ? altPhase(p) : undefined}
      />
      <Row
        label="Est Speed"
        value={flight ? `${flight.estimatedSpeedKmh} km/h` : "—"}
        sub="est"
      />
      <Row
        label="Est Heading"
        value={flight ? `${flight.bearingDeg}° ${bearingDir(flight.bearingDeg)}` : "—"}
        sub="est"
      />

      <div className="border-t border-[#4a9eff]/15 my-1.5" />

      <Row label="Flight Phase" value={phase} cls={phaseCls} />
      <Row
        label="Progress"
        value={flight ? `${Math.round(p * 100)}% complete` : "0%"}
      />
    </div>
  )
}
