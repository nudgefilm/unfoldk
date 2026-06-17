"use client"

import type { FlightData } from "@/app/api/k-inbound/flight/route"

interface Props { flight: FlightData | null }

function fmtHHMM(ms: number): string {
  if (ms <= 0) return "00:00"
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
}
function delayMin(sched: string, actual?: string): number | null {
  if (!actual) return null
  return Math.round((new Date(actual).getTime() - new Date(sched).getTime()) / 60000)
}

const STATUS_COLOR: Record<string, string> = {
  "En Route":  "text-[#4ade80]",
  "Active":    "text-[#4ade80]",
  "Departed":  "text-white",
  "Delayed":   "text-[#FF4B6E]",
  "Landed":    "text-white",
  "Cancelled": "text-[#FF4B6E]",
  "Scheduled": "text-[#cbd5e1]",
  "Diverted":  "text-[#FF4B6E]",
}

function Row({ label, value, cls = "text-white" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-1 py-px group cursor-default">
      <span className="text-[11px] uppercase tracking-wider text-[#cbd5e1] text-right pr-1 truncate transition-colors duration-150 group-hover:text-white">{label}</span>
      <span className={`text-[13px] font-semibold transition-all duration-150 group-hover:brightness-[1.12] ${cls}`}>{value}</span>
    </div>
  )
}

export function FlightStatusPanel({ flight }: Props) {
  const now      = Date.now()
  const dd       = flight ? delayMin(flight.departure.scheduledTime, flight.departure.actualTime) : null
  const minAgo   = flight ? Math.floor((now - flight.fetchedAt) / 60_000) : null
  const isLive   = minAgo !== null && minAgo < 15
  const statusCls = flight ? (STATUS_COLOR[flight.status] ?? "text-[#cbd5e1]") : "text-[#cbd5e1]/40"

  return (
    <div className="shrink-0 flex flex-col p-3 font-mono text-white">
      <div className="text-[11px] uppercase tracking-wider text-[#cbd5e1] mb-1 hover:text-white transition-colors duration-150 cursor-default">Flight Status</div>

      {/* STATUS */}
      <div className="grid grid-cols-[110px_1fr] gap-1 py-px mb-0.5 group cursor-default">
        <span className="text-[11px] uppercase tracking-wider text-[#cbd5e1] text-right pr-1 transition-colors duration-150 group-hover:text-white">Status</span>
        <span className={`text-[13px] font-bold transition-all duration-150 group-hover:brightness-[1.12] ${statusCls}`}>
          {flight?.status ?? "◌ STANDBY"}
        </span>
      </div>

      <div className="border-t border-[#4a9eff]/15 my-1" />

      <Row label="Elapsed" value={flight ? fmtHHMM(flight.elapsedMs) : "—"} />
      <Row
        label="Remaining"
        value={flight ? `${fmtHHMM(flight.remainingMs)} est` : "—"}
        cls="text-[#cbd5e1]/80"
      />

      <div className="border-t border-[#4a9eff]/15 my-1" />

      {/* DELAY */}
      {dd !== null && dd > 0 ? (
        <Row label="Delay" value={`+${dd} min`} cls="text-[#FF4B6E]" />
      ) : dd !== null ? (
        <Row label="Delay" value="ON TIME" cls="text-[#4ade80]" />
      ) : (
        <Row label="Delay" value="—" cls="text-[#cbd5e1]/40" />
      )}

      <div className="border-t border-[#4a9eff]/15 my-1" />

      {/* SIGNAL */}
      <Row
        label="Signal"
        value={flight ? (isLive ? "● LIVE" : "◌ PREDICTIVE") : "◌ AWAITING INPUT"}
        cls={flight ? (isLive ? "text-[#4ade80]" : "text-[#cbd5e1]/70") : "text-[#cbd5e1]/40"}
      />
      <Row
        label="Updated"
        value={minAgo !== null ? `${minAgo}m ago` : "—"}
        cls="text-[#cbd5e1]/70"
      />
    </div>
  )
}
