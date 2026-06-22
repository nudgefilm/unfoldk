"use client"

import { useEffect, useState, useCallback } from "react"
import { PlaneLanding, RefreshCw } from "lucide-react"
import type { ArrivalItem } from "@/app/api/k-inbound/arrivals/route"

// IATA → 도시명 (표시용)
const IATA_CITY: Record<string, string> = {
  // 일본
  NRT: "Tokyo", HND: "Tokyo", KIX: "Osaka", FUK: "Fukuoka",
  CTS: "Sapporo", OKA: "Okinawa", NGO: "Nagoya",
  // 중국
  PEK: "Beijing", PKX: "Beijing", PVG: "Shanghai", SHA: "Shanghai",
  CAN: "Guangzhou", CTU: "Chengdu", CKG: "Chongqing",
  WUH: "Wuhan", XMN: "Xiamen", CSX: "Changsha", SZX: "Shenzhen",
  // 홍콩·마카오·대만
  HKG: "Hong Kong", MFM: "Macau", TPE: "Taipei", KHH: "Kaohsiung",
  // 동남아
  SIN: "Singapore",
  BKK: "Bangkok", DMK: "Bangkok",
  HAN: "Hanoi", SGN: "Ho Chi Minh", DAD: "Da Nang",
  KUL: "Kuala Lumpur", CGK: "Jakarta", MNL: "Manila", CEB: "Cebu",
  RGN: "Yangon", BKI: "Kota Kinabalu",
  // 남아시아
  DEL: "Delhi", BOM: "Mumbai", MAA: "Chennai", CCU: "Kolkata",
  CMB: "Colombo", DAC: "Dhaka", KTM: "Kathmandu",
  // 중동
  DXB: "Dubai", AUH: "Abu Dhabi", DOH: "Doha",
  RUH: "Riyadh", KWI: "Kuwait", TLV: "Tel Aviv",
  // 유럽
  LHR: "London", LGW: "London", CDG: "Paris", FRA: "Frankfurt",
  MUC: "Munich", AMS: "Amsterdam", ZRH: "Zurich", VIE: "Vienna",
  MAD: "Madrid", FCO: "Rome", IST: "Istanbul", ARN: "Stockholm",
  // 북미
  JFK: "New York", LAX: "Los Angeles", ORD: "Chicago", ATL: "Atlanta",
  SFO: "San Francisco", SEA: "Seattle", YVR: "Vancouver", YYZ: "Toronto",
  // 오세아니아·기타
  SYD: "Sydney", MEL: "Melbourne", AKL: "Auckland",
  SVO: "Moscow", ALA: "Almaty", TAS: "Tashkent",
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  Active:    { label: "En Route",  color: "#4a9eff" },
  EnRoute:   { label: "En Route",  color: "#4a9eff" },
  Departed:  { label: "Departed",  color: "#f59e0b" },
  Landed:    { label: "Landed",    color: "#22c55e" },
  Arrived:   { label: "Landed",    color: "#22c55e" },
  Delayed:   { label: "Delayed",   color: "#ef4444" },
  Scheduled: { label: "Scheduled", color: "#64748b" },
  Unknown:   { label: "—",         color: "#64748b" },
}

// AeroDataBox .local 형식: "2024-06-22 14:30+09:00" 또는 "2024-06-22T14:30:00+09:00"
function toHHMM(isoLocal: string): string {
  const part = isoLocal.includes("T")
    ? isoLocal.split("T")[1]
    : isoLocal.split(" ")[1]
  return part?.slice(0, 5) ?? "—"
}

function isDelayed(item: ArrivalItem): boolean {
  if (!item.estimatedArrival || !item.scheduledArrival) return false
  return (
    new Date(item.estimatedArrival).getTime() >
    new Date(item.scheduledArrival).getTime() + 5 * 60 * 1000
  )
}

interface Props {
  onSelect: (flightNumber: string) => void
}

export function ICNArrivalsPanel({ onSelect }: Props) {
  const [arrivals, setArrivals] = useState<ArrivalItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res  = await fetch("/api/k-inbound/arrivals")
      if (!res.ok) throw new Error()
      const data = await res.json() as { arrivals?: ArrivalItem[] }
      setArrivals(data.arrivals ?? [])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [load])

  return (
    <div className="bg-black/40 backdrop-blur-md border border-[#4a9eff]/20 rounded-xl overflow-hidden flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#4a9eff]/10 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <PlaneLanding className="w-3.5 h-3.5 text-[#4a9eff]" />
          <span className="text-[#4a9eff] text-[10px] font-bold tracking-widest uppercase">
            Arriving at ICN Today
          </span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-0.5 rounded hover:bg-white/10 transition-colors disabled:opacity-40"
          aria-label="Refresh arrivals"
        >
          <RefreshCw
            className="w-3 h-3 text-[#94a3b8]"
            style={{ animation: loading ? "spin 1s linear infinite" : "none" }}
          />
        </button>
      </div>

      {/* 리스트 */}
      <div className="overflow-y-auto max-h-[320px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* 로딩 */}
        {loading && arrivals.length === 0 && (
          <div className="flex items-center justify-center py-6">
            <div
              className="w-4 h-4 rounded-full border border-[#4a9eff]/30"
              style={{ borderTopColor: "#4a9eff", animation: "spin 1s linear infinite" }}
            />
          </div>
        )}

        {/* 에러 */}
        {!loading && error && (
          <p className="text-[#94a3b8]/50 text-[10px] text-center py-5 px-3">
            Failed to load. Tap refresh.
          </p>
        )}

        {/* 빈 상태 */}
        {!loading && !error && arrivals.length === 0 && (
          <p className="text-[#94a3b8]/50 text-[10px] text-center py-5 px-3">
            No more arrivals today.
          </p>
        )}

        {/* 항공편 목록 */}
        {arrivals.map((item) => {
          const city    = IATA_CITY[item.origin] ?? item.origin
          const eta     = item.estimatedArrival ?? item.scheduledArrival
          const etaHHMM = eta ? toHHMM(eta) : "—"
          const delayed = isDelayed(item)
          const landed  = item.status === "Landed" || item.status === "Arrived"
          const sc      = STATUS_CONFIG[item.status] ?? { label: item.status, color: "#64748b" }

          return (
            <button
              key={item.number}
              onClick={() => onSelect(item.number)}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#4a9eff]/10 active:bg-[#4a9eff]/20 transition-colors border-b border-white/5 last:border-b-0 text-left"
            >
              {/* 항공편명 */}
              <span
                className="text-[11px] font-bold w-[52px] flex-shrink-0 tracking-wide"
                style={{ color: landed ? "#4a5568" : "#e2e8f0" }}
              >
                {item.number}
              </span>

              {/* 출발지 */}
              <span
                className="flex-1 text-[10px] truncate"
                style={{ color: landed ? "#4a5568" : "#94a3b8" }}
              >
                {city}
              </span>

              {/* ETA + 상태 */}
              <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                <span
                  className="text-[11px] font-mono tabular-nums"
                  style={{
                    color: landed ? "#4a5568" : delayed ? "#f59e0b" : "#e2e8f0",
                  }}
                >
                  {etaHHMM}
                </span>
                <span
                  className="text-[9px] font-bold uppercase tracking-wide"
                  style={{ color: landed ? "#4a5568" : sc.color }}
                >
                  {sc.label}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
