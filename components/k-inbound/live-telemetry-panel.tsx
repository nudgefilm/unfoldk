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

function Row({ label, value, sub, cls = "text-[#4a9eff]" }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-1 py-[2px]">
      <span className="text-[9px] uppercase tracking-wider text-[#94a3b8]/55 text-right pr-1 truncate">{label}</span>
      <span className={`text-[11px] font-semibold ${cls}`}>
        {value}
        {sub && <span className="text-[9px] text-[#94a3b8]/45 ml-1 font-normal">{sub}</span>}
      </span>
    </div>
  )
}

export function LiveTelemetryPanel({ flight }: Props) {
  const p     = flight?.progressRatio ?? 0
  const phase = flight ? flightPhase(p, flight.status) : "GROUND"
  const phaseCls = phase === "CRUISE" || phase === "LANDED" ? "text-[#00ff88]" : "text-[#4a9eff]"

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-black/75 backdrop-blur-sm border border-[#4a9eff]/30 rounded-xl p-4 overflow-y-auto font-mono text-white">
      <div className="text-[9px] uppercase tracking-wider text-[#94a3b8]/50 mb-2">Live Telemetry</div>

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

      <div className="border-t border-[#4a9eff]/15 my-2" />

      <Row label="Flight Phase" value={phase} cls={phaseCls} />
      <Row
        label="Progress"
        value={flight ? `${Math.round(p * 100)}% complete` : "0%"}
      />
    </div>
  )
}
