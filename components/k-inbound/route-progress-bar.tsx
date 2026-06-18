"use client"

// ⚠️ 임의 수정 금지 — 아래 항목은 개선 작업으로 확정된 사항임
// 변경이 필요하다고 판단되는 경우 반드시 먼저 확인 요청할 것
//
// 반영 완료 항목:
// - IATA_TZ 매핑 + getTzAbbr: Intl.DateTimeFormat DST 자동 적용
// - extractTime: T/공백 구분자 양쪽 처리, 추출 실패 시 "—" 폴백
// - getStatusBadge: SCHEDULED / GROUND HOLD / EN ROUTE / ARRIVED / CANCELLED 5단계
// - 2줄 레이아웃: Row1(IATA+TZ | 항공편정보+뱃지 | TZ+IATA) / Row2(🛫시각 | 공항명 | 시각🛬)
// - 텍스트 색상 30% 밝게 (mix-with-white 30%) 적용

import type { FlightData } from "@/app/api/k-inbound/flight/route"

interface Props { flight: FlightData | null }

// IATA → IANA 시간대 (서머타임 자동 적용)
const IATA_TZ: Record<string, string> = {
  ICN: "Asia/Seoul",    GMP: "Asia/Seoul",
  LAX: "America/Los_Angeles", SFO: "America/Los_Angeles", SEA: "America/Los_Angeles",
  JFK: "America/New_York",    MIA: "America/New_York",    ORD: "America/Chicago",
  NRT: "Asia/Tokyo",   HND: "Asia/Tokyo",
  LHR: "Europe/London",
  CDG: "Europe/Paris", FRA: "Europe/Berlin",
  DXB: "Asia/Dubai",
  SIN: "Asia/Singapore",
  SYD: "Australia/Sydney",
}

// scheduledTime은 이미 공항 현지 시각(local) — 브라우저 TZ 변환 없이 HH:MM 직접 추출
// T 구분자(ISO 8601) 또는 공백 구분자(일부 API) 모두 처리
function extractTime(iso?: string): string {
  if (!iso) return ""
  const m = iso.match(/[T ](\d{2}:\d{2})/)
  return m ? m[1] : ""
}

// 현재 날짜 기준 IATA 공항의 시간대 약어 (PDT/PST, KST 등 서머타임 자동)
function getTzAbbr(iata?: string): string {
  if (!iata) return ""
  const tz = IATA_TZ[iata]
  if (!tz) return ""
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date())
  return parts.find(p => p.type === "timeZoneName")?.value ?? ""
}

interface StatusBadge { icon: string; label: string; color: string }

// progress(%)와 API status 기준 비행 단계 판단
function getStatusBadge(status: string, pct: number): StatusBadge | null {
  if (status === "Cancelled")                                    return { icon: "❌", label: "CANCELLED",   color: "#f47c7c" }
  if (status === "Scheduled" || pct === 0)                      return { icon: "🕐", label: "SCHEDULED",   color: "#b4bfcd" }
  if (status === "Departed" || pct < 2)                         return { icon: "🛫", label: "GROUND HOLD", color: "#fcdb5b" }
  if (pct >= 98 || status === "Arrived" || status === "Landed") return { icon: "🛬", label: "ARRIVED",     color: "#90c0fc" }
  return                                                               { icon: "✈",  label: "EN ROUTE",    color: "#80e8a6" }
}

export function RouteProgressBar({ flight }: Props) {
  const pct     = flight ? Math.round(flight.progressRatio * 100) : 0
  const depTz   = getTzAbbr(flight?.departure.iata)
  const arrTz   = getTzAbbr(flight?.arrival.iata)
  const badge   = flight ? getStatusBadge(flight.status, pct) : null
  // 출발: actualTime 우선, 없으면 scheduledTime — 추출 실패 시 "—" 폴백
  const depTime = extractTime(flight?.departure.actualTime ?? flight?.departure.scheduledTime) || "—"
  // 도착: estimatedTime 우선, 없으면 scheduledTime — 추출 실패 시 "—" 폴백
  const arrTime = extractTime(flight?.arrival.estimatedTime ?? flight?.arrival.scheduledTime) || "—"

  return (
    <div className="backdrop-blur-sm px-4 pt-1.5 pb-2 font-mono rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.15)" }}>
      <div>

        {/* Row 1: 출발IATA(TZ) | 항공편 정보 + 뱃지 | (TZ)도착IATA */}
        <div className="flex items-center mb-0.5">
          <div className="flex-1 flex items-baseline gap-1 text-[13px]">
            <span className="text-[#80bbff] font-bold">{flight?.departure.iata ?? "—"}</span>
            {flight && depTz && <span className="text-[#b4bfcd]/60 text-[10px]">({depTz})</span>}
          </div>
          <div className="shrink-0 flex items-center gap-1.5 text-[11px] text-[#b4bfcd] px-1">
            {flight ? (
              <>
                <span>{flight.number} · {pct}% · {flight.distanceKm.toLocaleString()} km</span>
                {badge && (
                  <span
                    className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold shrink-0"
                    style={{ color: badge.color, border: `1px solid ${badge.color}40`, background: `${badge.color}12` }}
                  >
                    {badge.icon} {badge.label}
                  </span>
                )}
              </>
            ) : <span>Track flights to and from Korea</span>}
          </div>
          <div className="flex-1 flex items-baseline gap-1 justify-end text-[13px]">
            {flight && arrTz && <span className="text-[#b4bfcd]/60 text-[10px]">({arrTz})</span>}
            <span className="text-[#80bbff] font-bold">{flight?.arrival.iata ?? "—"}</span>
          </div>
        </div>

        {/* Row 2: 🛫 출발시각 | 공항명 | 도착시각 🛬 */}
        <div className="flex items-center text-[11px] mb-1">
          <div className="shrink-0 flex items-center gap-1 text-[#b4bfcd]">
            {flight && (
              <>
                <span>🛫</span>
                <span>{depTime}</span>
              </>
            )}
          </div>
          <div className="flex-1 min-w-0 text-center text-[#b4bfcd]/70 px-2">
            {flight && (
              <span className="block truncate">
                {flight.departure.name} — {flight.arrival.name}
              </span>
            )}
          </div>
          <div className="shrink-0 flex items-center gap-1 text-[#b4bfcd]">
            {flight && (
              <>
                <span>{arrTime}</span>
                <span>🛬</span>
              </>
            )}
          </div>
        </div>

        {/* 진행 바 */}
        <div className="relative h-5 flex items-center">
          {/* 트랙 */}
          <div className="absolute inset-0 flex items-center">
            <div className="w-full h-[2px] bg-[#4a9eff]/12 rounded-full" />
          </div>
          {/* 진행 채움 */}
          <div className="absolute inset-0 flex items-center">
            <div
              className="h-[2px] bg-gradient-to-r from-[#4a9eff] to-[#00ff88] rounded-full transition-all duration-1000"
              style={{ width: `${pct}%` }}
            />
          </div>
          {/* 출발 도트 */}
          <div className="absolute left-0 w-2.5 h-2.5 rounded-full bg-[#4a9eff] border border-[#020c1b] -translate-x-0.5" />
          {/* 도착 도트 */}
          <div className="absolute right-0 w-2.5 h-2.5 rounded-full bg-[#4a9eff]/30 border border-[#4a9eff]/50 translate-x-0.5" />
          {/* ✈ 아이콘 (현재 위치) */}
          {flight && pct > 0 && (
            <div
              className="absolute text-[#ffe34d] text-xs leading-none pointer-events-none transition-all duration-1000"
              style={{ left: `calc(${pct}% - 6px)`, top: "50%", transform: "translateY(-50%)" }}
            >
              ✈
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
