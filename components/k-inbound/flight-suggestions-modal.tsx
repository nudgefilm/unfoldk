"use client"

import { X } from "lucide-react"
import type { FIDSSuggestion } from "@/app/api/k-inbound/flight/route"

// 출발 공항 IATA → 국가 코드 (유저 국가 우선 정렬용)
const IATA_COUNTRY: Record<string, string> = {
  JFK: "US", LAX: "US", ORD: "US", ATL: "US", SFO: "US", SEA: "US", DFW: "US", MIA: "US", BOS: "US",
  YVR: "CA", YYZ: "CA",
  LHR: "GB", LGW: "GB",
  CDG: "FR", ORY: "FR",
  FRA: "DE", MUC: "DE",
  AMS: "NL", ZRH: "CH", VIE: "AT", BRU: "BE", CPH: "DK", ARN: "SE", OSL: "NO", HEL: "FI",
  MAD: "ES", BCN: "ES", FCO: "IT", MXP: "IT", LIS: "PT",
  NRT: "JP", HND: "JP", KIX: "JP", FUK: "JP", CTS: "JP", NGO: "JP",
  PEK: "CN", PVG: "CN", SHA: "CN", CAN: "CN", CTU: "CN", CKG: "CN",
  HKG: "HK", MFM: "MO", TPE: "TW",
  SIN: "SG", KUL: "MY", CGK: "ID", MNL: "PH", BKK: "TH", HAN: "VN", SGN: "VN",
  DEL: "IN", BOM: "IN", MAA: "IN", CMB: "LK",
  DXB: "AE", AUH: "AE", DOH: "QA", RUH: "SA", KWI: "KW",
  SYD: "AU", MEL: "AU", AKL: "NZ",
  GRU: "BR", EZE: "AR", SCL: "CL", BOG: "CO",
  JNB: "ZA", CAI: "EG", NBO: "KE",
}

interface Props {
  suggestions: FIDSSuggestion[]
  userCountry: string
  onSelect: (flightNumber: string) => void
  onClose: () => void
}

export function FlightSuggestionsModal({ suggestions, userCountry, onSelect, onClose }: Props) {
  if (!suggestions.length) return null

  // 유저 국가 출발 항공편 상단 정렬
  const sorted = [...suggestions].sort((a, b) => {
    const aMatch = IATA_COUNTRY[a.origin] === userCountry ? -1 : 0
    const bMatch = IATA_COUNTRY[b.origin] === userCountry ? -1 : 0
    return aMatch - bMatch
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center font-mono">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm mx-4 bg-black/90 border border-[#FF4B6E]/30 rounded-2xl overflow-hidden">

        {/* 헤더 */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-white/10">
          <div>
            <div className="text-white text-[13px] font-semibold">Flight not found. Did you mean one of these?</div>
            <div className="text-[#94a3b8]/50 text-[10px] mt-0.5">Today&apos;s flights arriving at Seoul Incheon (ICN)</div>
          </div>
          <button onClick={onClose} className="text-[#94a3b8]/40 hover:text-white transition-colors ml-3 mt-0.5 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 항공편 목록 */}
        <div className="max-h-64 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sorted.slice(0, 10).map(s => {
            const timeStr = s.scheduledArrival?.match(/T(\d{2}:\d{2})/)?.[1] ?? ""
            const isUserCountry = !!userCountry && IATA_COUNTRY[s.origin] === userCountry
            return (
              <button
                key={s.number}
                onClick={() => { onSelect(s.number); onClose() }}
                className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
              >
                {isUserCountry
                  ? <span className="w-1.5 h-1.5 rounded-full bg-[#FF4B6E] shrink-0" />
                  : <span className="w-1.5 h-1.5 shrink-0" />
                }
                <span className="text-[#FF4B6E] font-bold text-[12px] w-14 shrink-0">{s.number}</span>
                <span className="text-[#94a3b8]/70 text-[10px] flex-1 truncate">{s.airline}</span>
                <span className="text-white/60 text-[10px] shrink-0">ICN←{s.origin}</span>
                {timeStr && <span className="text-[#4a9eff]/70 text-[10px] shrink-0 ml-1">{timeStr}</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
