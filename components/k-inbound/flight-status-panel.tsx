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
  "En Route":  "text-[#00ff88]",
  "Active":    "text-[#00ff88]",
  "Departed":  "text-[#4a9eff]",
  "Delayed":   "text-[#ff4b6e]",
  "Landed":    "text-[#4a9eff]",
  "Cancelled": "text-[#ff4b6e]",
  "Scheduled": "text-[#94a3b8]",
  "Diverted":  "text-[#ff4b6e]",
}

function Row({ label, value, cls = "text-[#4a9eff]" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-1 py-[2px]">
      <span className="text-[9px] uppercase tracking-wider text-[#94a3b8]/55 text-right pr-1 truncate">{label}</span>
      <span className={`text-[11px] font-semibold ${cls}`}>{value}</span>
    </div>
  )
}

export function FlightStatusPanel({ flight }: Props) {
  const now      = Date.now()
  const dd       = flight ? delayMin(flight.departure.scheduledTime, flight.departure.actualTime) : null
  const minAgo   = flight ? Math.floor((now - flight.fetchedAt) / 60_000) : null
  const isLive   = minAgo !== null && minAgo < 15
  const statusCls = flight ? (STATUS_COLOR[flight.status] ?? "text-[#94a3b8]") : "text-[#94a3b8]/40"

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-black/75 backdrop-blur-sm border border-[#4a9eff]/30 rounded-xl p-4 overflow-y-auto font-mono text-white">
      <div className="text-[9px] uppercase tracking-wider text-[#94a3b8]/50 mb-2">Flight Status</div>

      {/* STATUS */}
      <div className="grid grid-cols-[100px_1fr] gap-1 py-[2px] mb-1">
        <span className="text-[9px] uppercase tracking-wider text-[#94a3b8]/55 text-right pr-1">Status</span>
        <span className={`text-[11px] font-bold ${statusCls}`}>
          {flight?.status ?? "◌ STANDBY"}
        </span>
      </div>

      <div className="border-t border-[#4a9eff]/15 my-1.5" />

      <Row label="Elapsed" value={flight ? fmtHHMM(flight.elapsedMs) : "—"} />
      <Row
        label="Remaining"
        value={flight ? `${fmtHHMM(flight.remainingMs)} est` : "—"}
        cls="text-[#4a9eff]/80"
      />

      <div className="border-t border-[#4a9eff]/15 my-1.5" />

      {/* DELAY */}
      {dd !== null && dd > 0 ? (
        <Row label="Delay" value={`+${dd} min`} cls="text-[#ff4b6e]" />
      ) : dd !== null ? (
        <Row label="Delay" value="ON TIME" cls="text-[#00ff88]" />
      ) : (
        <Row label="Delay" value="—" cls="text-[#94a3b8]/35" />
      )}

      <div className="border-t border-[#4a9eff]/15 my-1.5" />

      {/* SIGNAL */}
      <Row
        label="Signal"
        value={flight ? (isLive ? "● LIVE" : "◌ PREDICTIVE") : "◌ AWAITING INPUT"}
        cls={flight ? (isLive ? "text-[#00ff88]" : "text-[#94a3b8]/60") : "text-[#94a3b8]/40"}
      />
      <Row
        label="Updated"
        value={minAgo !== null ? `${minAgo}m ago` : "—"}
        cls="text-[#94a3b8]/60"
      />
    </div>
  )
}
