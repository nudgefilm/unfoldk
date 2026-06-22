"use client"

import { useEffect, useState, useCallback } from "react"
import { PlaneLanding, RefreshCw } from "lucide-react"
import type { ArrivalItem } from "@/app/api/k-inbound/arrivals/route"

// IATA → 도시명
const IATA_CITY: Record<string, string> = {
  NRT: "Tokyo", HND: "Tokyo", KIX: "Osaka", FUK: "Fukuoka",
  CTS: "Sapporo", OKA: "Okinawa", NGO: "Nagoya",
  PEK: "Beijing", PKX: "Beijing", PVG: "Shanghai", SHA: "Shanghai",
  CAN: "Guangzhou", CTU: "Chengdu", CKG: "Chongqing",
  WUH: "Wuhan", XMN: "Xiamen", CSX: "Changsha", SZX: "Shenzhen",
  HKG: "Hong Kong", MFM: "Macau", TPE: "Taipei", KHH: "Kaohsiung",
  SIN: "Singapore",
  BKK: "Bangkok", DMK: "Bangkok",
  HAN: "Hanoi", SGN: "Ho Chi Minh", DAD: "Da Nang",
  KUL: "Kuala Lumpur", CGK: "Jakarta", MNL: "Manila", CEB: "Cebu",
  RGN: "Yangon", BKI: "Kota Kinabalu",
  DEL: "Delhi", BOM: "Mumbai", MAA: "Chennai", CCU: "Kolkata",
  CMB: "Colombo", DAC: "Dhaka", KTM: "Kathmandu",
  DXB: "Dubai", AUH: "Abu Dhabi", DOH: "Doha",
  RUH: "Riyadh", KWI: "Kuwait", TLV: "Tel Aviv",
  LHR: "London", LGW: "London", CDG: "Paris", FRA: "Frankfurt",
  MUC: "Munich", AMS: "Amsterdam", ZRH: "Zurich", VIE: "Vienna",
  MAD: "Madrid", FCO: "Rome", IST: "Istanbul", ARN: "Stockholm",
  JFK: "New York", LAX: "Los Angeles", ORD: "Chicago", ATL: "Atlanta",
  SFO: "San Francisco", SEA: "Seattle", YVR: "Vancouver", YYZ: "Toronto",
  SYD: "Sydney", MEL: "Melbourne", AKL: "Auckland",
  SVO: "Moscow", ALA: "Almaty", TAS: "Tashkent",
}

// AeroDataBox .local: "2024-06-22 14:30+09:00" 또는 "2024-06-22T14:30:00+09:00"
function toHHMM(isoLocal: string): string {
  const part = isoLocal.includes("T")
    ? isoLocal.split("T")[1]
    : isoLocal.split(" ")[1]
  return part?.slice(0, 5) ?? "—"
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
        {loading && arrivals.length === 0 && (
          <div className="flex items-center justify-center py-6">
            <div
              className="w-4 h-4 rounded-full border border-[#4a9eff]/30"
              style={{ borderTopColor: "#4a9eff", animation: "spin 1s linear infinite" }}
            />
          </div>
        )}
        {!loading && error && (
          <p className="text-[#94a3b8]/50 text-[10px] text-center py-5 px-3">
            Failed to load. Tap refresh.
          </p>
        )}
        {!loading && !error && arrivals.length === 0 && (
          <p className="text-[#94a3b8]/50 text-[10px] text-center py-5 px-3">
            No more arrivals today.
          </p>
        )}
        {arrivals.map((item) => {
          const city    = IATA_CITY[item.origin] ?? item.origin
          const eta     = item.estimatedArrival ?? item.scheduledArrival
          const etaHHMM = eta ? toHHMM(eta) : "—"

          return (
            <button
              key={item.number}
              onClick={() => onSelect(item.number)}
              className="w-full px-3 py-1.5 hover:bg-[#4a9eff]/10 active:bg-[#4a9eff]/20 transition-colors border-b border-white/5 last:border-b-0 text-left"
            >
              <span className="text-[11px] font-mono text-[#94a3b8] truncate block">
                {item.number}&nbsp;&nbsp;|&nbsp;&nbsp;{city}&nbsp;&nbsp;|&nbsp;&nbsp;{etaHHMM}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
