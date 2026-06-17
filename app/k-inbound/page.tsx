"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { Lock, Plane } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { hasProAccess } from "@/lib/auth/plan"
import { FlightInfoPanel } from "@/components/k-inbound/flight-info-panel"
import { FlightStatusPanel } from "@/components/k-inbound/flight-status-panel"
import { FlightSearchBar } from "@/components/k-inbound/search-bar"
import type { GlobeHandle } from "@/components/k-inbound/globe"
import type { FlightData } from "@/app/api/k-inbound/flight/route"

const KInboundGlobe = dynamic(
  () => import("@/components/k-inbound/globe"),
  { ssr: false, loading: () => <div className="w-full h-full bg-[#020c1b]" /> },
)

type AuthState = "loading" | "unauthenticated" | "free" | "pro"

// 패널 빈 상태 플레이스홀더
function EmptyPanel({ side }: { side: "left" | "right" }) {
  return (
    <div className="bg-[#020c1b]/60 border border-[#1a4a7a]/30 rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-3 h-48">
      <Plane className="w-7 h-7 text-[#4da6ff]/25" />
      <p className="text-[11px] text-[#4da6ff]/35 leading-relaxed">
        {side === "left" ? "Flight info\nappears here" : "Flight status\nappears here"}
      </p>
    </div>
  )
}

export default function KInboundPage() {
  const [authState, setAuthState] = useState<AuthState>("loading")
  const [flight, setFlight] = useState<FlightData | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const globeRef = useRef<GlobeHandle>(null)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setAuthState("unauthenticated"); return }
      const { data: user } = await supabase
        .from("users")
        .select("plan_type, is_admin, trial_ends_at")
        .eq("id", session.user.id)
        .single()
      if (!user) { setAuthState("free"); return }
      setAuthState(hasProAccess({
        planType: user.plan_type as string,
        isAdmin: user.is_admin as boolean,
        trialEndsAt: user.trial_ends_at as string | null,
      }) ? "pro" : "free")
    })
  }, [])

  const handleSearch = useCallback(async (flightNumber: string) => {
    setSearching(true)
    setSearchError(null)
    try {
      const res = await fetch(`/api/k-inbound/flight?number=${encodeURIComponent(flightNumber)}`)
      if (res.status === 404) { setSearchError("Flight not found. Try a different number."); return }
      if (!res.ok) { setSearchError("Service temporarily unavailable."); return }
      const { flight: f } = await res.json() as { flight: FlightData }
      setFlight(f)
      globeRef.current?.setFlight(f)
      const midLat = (f.departure.lat + f.arrival.lat) / 2
      const midLng = (f.departure.lng + f.arrival.lng) / 2
      globeRef.current?.flyTo(midLat, midLng, 1400)
    } catch {
      setSearchError("Network error. Please try again.")
    } finally {
      setSearching(false)
    }
  }, [])

  // ── 로딩 ─────────────────────────────────────────────────────────
  if (authState === "loading") {
    return (
      <div className="fixed inset-0 bg-[#020c1b] flex items-center justify-center">
        <div className="text-[#4da6ff]/60 text-sm animate-pulse">Initializing…</div>
      </div>
    )
  }

  // ── Pro 전용 잠금 모달 ────────────────────────────────────────────
  if (authState === "unauthenticated" || authState === "free") {
    return (
      <div className="fixed inset-0 bg-[#020c1b] flex flex-col">
        <KInboundGlobe className="absolute inset-0 opacity-30 pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center">
          <div className="bg-[#020c1b]/90 backdrop-blur-xl border border-[#1a4a7a]/60 rounded-3xl p-10 max-w-md w-full shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-[#1a4a7a]/40 flex items-center justify-center mx-auto mb-5">
              <Lock className="w-7 h-7 text-[#4da6ff]" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">K-Inbound Flight Simulator</h1>
            <p className="text-sm text-[#aac4e0]/70 mb-1">
              Track real-time flights inbound to Korea on a 3D globe.
            </p>
            <p className="text-xs text-[#aac4e0]/40 mb-6">
              한국행 항공편을 3D 지구본에서 실시간으로 추적하세요.
            </p>
            {authState === "unauthenticated" ? (
              <>
                <Link href="/signup" className="block w-full py-3 rounded-xl bg-[#FF4B6E] hover:bg-[#ff6080] text-white font-semibold text-sm transition-colors mb-2">
                  Sign up — it's free
                </Link>
                <Link href="/login" className="block w-full py-2.5 rounded-xl border border-[#1a4a7a]/60 hover:bg-[#0a1e30] text-[#4da6ff] text-sm transition-colors">
                  Already have an account
                </Link>
              </>
            ) : (
              <>
                <Link href="/pricing" className="block w-full py-3 rounded-xl bg-[#FF4B6E] hover:bg-[#ff6080] text-white font-semibold text-sm transition-colors mb-2">
                  Get Hallyu Pass
                </Link>
                <p className="text-[11px] text-[#aac4e0]/40">Unlock all 5 Hallyu services for $9/month</p>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Pro 메인 — 3단 레이아웃 ───────────────────────────────────────
  return (
    <div className="fixed inset-0 flex flex-col bg-[#020c1b] overflow-hidden">

      {/* ─── 메인 행: 좌패널 | 지구본 | 우패널 ─────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* 좌측 패널 (280px, 모바일 숨김) */}
        <div className="hidden md:flex w-[280px] shrink-0 flex-col gap-3 p-3 border-r border-[#1a4a7a]/25 overflow-y-auto">
          {/* 브랜드 링크 */}
          <Link
            href="/"
            className="text-[11px] font-bold tracking-widest uppercase text-[#4da6ff]/50 hover:text-[#4da6ff]/80 transition-colors px-1"
          >
            ← UnfoldK
          </Link>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#4da6ff]/40 px-1">
            FLIGHT INFO
          </p>
          {flight ? <FlightInfoPanel flight={flight} /> : <EmptyPanel side="left" />}
        </div>

        {/* 지구본 영역 */}
        <div className="relative flex-1 min-w-0">
          {/* 검색 바 — 지구본 상단 중앙 고정 오버레이 */}
          <div className="absolute top-0 left-0 right-0 z-20 flex justify-center pt-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-xs px-4">
              <FlightSearchBar onSearch={handleSearch} loading={searching} error={searchError} />
            </div>
          </div>

          {/* 모바일: 브랜드 링크 */}
          <Link
            href="/"
            className="md:hidden absolute top-4 left-4 z-10 text-[11px] font-bold tracking-widest uppercase text-[#4da6ff]/50 hover:text-[#4da6ff]/80 transition-colors"
          >
            ← UnfoldK
          </Link>

          <KInboundGlobe ref={globeRef} className="w-full h-full" />
        </div>

        {/* 우측 패널 (280px, 모바일 숨김) */}
        <div className="hidden md:flex w-[280px] shrink-0 flex-col gap-3 p-3 border-l border-[#1a4a7a]/25 overflow-y-auto">
          <div className="text-[11px] font-bold tracking-widest uppercase text-[#4da6ff]/40 px-1 mt-6">
            FLIGHT STATUS
          </div>
          {flight ? <FlightStatusPanel flight={flight} /> : <EmptyPanel side="right" />}
        </div>
      </div>

      {/* ─── 하단 진행 바 ─────────────────────────────────────────── */}
      {flight && (
        <div className="shrink-0 bg-[#020c1b]/80 backdrop-blur-sm border-t border-[#1a4a7a]/35 px-6 py-3">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-1.5 text-[11px] text-[#aac4e0]/60">
              <span className="font-mono">{flight.departure.iata}</span>
              <span className="font-semibold text-white/70 tabular-nums">
                {Math.round(flight.progressRatio * 100)}% · {flight.number}
              </span>
              <span className="font-mono">{flight.arrival.iata}</span>
            </div>
            <div className="h-1.5 w-full bg-[#0a2840] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#4da6ff] via-[#00c8ff] to-[#00e5ff] transition-all duration-1000"
                style={{ width: `${Math.round(flight.progressRatio * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
