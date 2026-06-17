"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { hasProAccess } from "@/lib/auth/plan"
import { FlightInfoPanel } from "@/components/k-inbound/flight-info-panel"
import { AircraftInfoPanel } from "@/components/k-inbound/aircraft-info-panel"
import { FlightStatusPanel } from "@/components/k-inbound/flight-status-panel"
import { LiveTelemetryPanel } from "@/components/k-inbound/live-telemetry-panel"
import { RouteProgressBar } from "@/components/k-inbound/route-progress-bar"
import { FlightSearchBar } from "@/components/k-inbound/search-bar"
import { FlightSuggestionsModal } from "@/components/k-inbound/flight-suggestions-modal"
import { GlobalComms } from "@/components/k-inbound/global-comms"
import type { GlobeHandle } from "@/components/k-inbound/globe"
import type { FlightData, FIDSSuggestion } from "@/app/api/k-inbound/flight/route"

const KInboundGlobe = dynamic(
  () => import("@/components/k-inbound/globe"),
  { ssr: false, loading: () => <div className="w-full h-full bg-black" /> },
)

type AuthState = "loading" | "unauthenticated" | "free" | "pro"

export default function KInboundPage() {
  const [authState, setAuthState]       = useState<AuthState>("loading")
  const [flight, setFlight]             = useState<FlightData | null>(null)
  const [searching, setSearching]       = useState(false)
  const [searchError, setSearchError]   = useState<string | null>(null)
  const [suggestions, setSuggestions]   = useState<FIDSSuggestion[]>([])
  const [userCountry, setUserCountry]   = useState("")
  const globeRef = useRef<GlobeHandle>(null)

  // IP → 국가 코드 (검색 제안 정렬용)
  useEffect(() => {
    fetch("https://ipapi.co/json/")
      .then(r => r.json())
      .then((d: { country_code?: string }) => { if (d.country_code) setUserCountry(d.country_code) })
      .catch(() => {})
  }, [])

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
        planType:    user.plan_type    as string,
        isAdmin:     user.is_admin     as boolean,
        trialEndsAt: user.trial_ends_at as string | null,
      }) ? "pro" : "free")
    })
  }, [])

  const handleSearch = useCallback(async (flightNumber: string) => {
    setSearching(true)
    setSearchError(null)
    try {
      const res = await fetch(`/api/k-inbound/flight?number=${encodeURIComponent(flightNumber)}`)
      if (res.status === 404) {
        const body = await res.json() as { error: string; suggestions?: FIDSSuggestion[] }
        if (body.suggestions?.length) {
          setSuggestions(body.suggestions)
        } else {
          setSearchError("Flight not found.")
        }
        return
      }
      if (!res.ok) { setSearchError("Service unavailable."); return }
      const { flight: f } = await res.json() as { flight: FlightData }
      setFlight(f)
      globeRef.current?.setFlight(f) // 내부에서 현재 위치 계산 후 자동 flyTo
    } catch {
      setSearchError("Network error. Please try again.")
    } finally {
      setSearching(false)
    }
  }, [])

  // ── 로딩
  if (authState === "loading") {
    return (
      <div className="fixed top-16 left-0 right-0 bottom-0 bg-black flex items-center justify-center font-mono">
        <div className="text-[#4a9eff]/60 text-sm animate-pulse">INITIALIZING…</div>
      </div>
    )
  }

  // ── Pro 잠금
  if (authState === "unauthenticated" || authState === "free") {
    return (
      <div className="fixed top-16 left-0 right-0 bottom-0 bg-black flex flex-col">
        <KInboundGlobe className="absolute inset-0 opacity-25 pointer-events-none" />
        <div className="relative z-10 flex items-center justify-center h-full px-6">
          <div className="bg-black/80 backdrop-blur-xl border border-[#4a9eff]/40 rounded-3xl p-10 max-w-md w-full text-center font-mono">
            <div className="text-[#4a9eff] text-3xl mb-4">✈</div>
            <div className="text-white text-sm font-bold tracking-widest uppercase mb-1">K-INBOUND FLIGHT SIMULATOR</div>
            <p className="text-xs text-[#94a3b8]/60 mb-1">Track real-time flights inbound to Korea on a 3D globe.</p>
            <p className="text-[11px] text-[#94a3b8]/40 mb-6">Live altitude, speed &amp; route — all on one screen.</p>
            {authState === "unauthenticated" ? (
              <>
                <Link href="/signup" className="block w-full py-3 rounded-xl bg-[#FF4B6E] hover:bg-[#ff6080] text-white font-semibold text-sm transition-colors mb-2">
                  Sign up — it&apos;s free
                </Link>
                <Link href="/login" className="block w-full py-2.5 rounded-xl border border-[#4a9eff]/40 hover:bg-white/5 text-[#4a9eff] text-sm transition-colors">
                  Already have an account
                </Link>
              </>
            ) : (
              <>
                <Link href="/pricing" className="block w-full py-3 rounded-xl bg-[#FF4B6E] hover:bg-[#ff6080] text-white font-semibold text-sm transition-colors mb-2">
                  Get Hallyu Pass
                </Link>
                <p className="text-[11px] text-[#94a3b8]/40">Unlock all 5 Hallyu services for $9/month</p>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Pro 메인 — 지구본 전체 배경 + 패널 overlay
  return (
    <div className="fixed top-16 left-0 right-0 bottom-0 overflow-hidden font-mono">
      {/* 지구본 — 전체 배경 */}
      <KInboundGlobe ref={globeRef} className="absolute inset-0" />

      {/* 검색 바 — 상단 중앙 overlay */}
      <div className="absolute top-3 left-0 right-0 z-50 flex justify-center pointer-events-none">
        <div className="pointer-events-auto w-full max-w-sm px-4">
          <FlightSearchBar onSearch={handleSearch} loading={searching} error={searchError} />
        </div>
      </div>

      {/* 좌측 패널 — GlobalComms 높이(240px) + 하단바(64px) 위 공간 */}
      <div className="absolute top-2 left-2 z-10 w-[280px] hidden md:flex flex-col gap-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ bottom: "calc(1rem + 248px)" }}>
        <FlightInfoPanel   flight={flight} />
        <AircraftInfoPanel flight={flight} />
      </div>

      {/* GLOBAL COMMS — 좌측 하단 */}
      <div className="hidden md:block">
        <GlobalComms />
      </div>

      {/* 우측 패널 — 지구본 위 overlay, 항상 full opacity */}
      <div className="absolute top-2 right-2 bottom-16 z-10 w-[280px] hidden md:flex flex-col gap-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <FlightStatusPanel  flight={flight} />
        <LiveTelemetryPanel flight={flight} />
      </div>

      {/* 하단 경로 바 — 중앙 카드 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[5]" style={{ width: "600px", maxWidth: "60%" }}>
        <RouteProgressBar flight={flight} />
      </div>

      {/* 항공편 검색 실패 시 ICN 도착 편 제안 모달 */}
      {suggestions.length > 0 && (
        <FlightSuggestionsModal
          suggestions={suggestions}
          userCountry={userCountry}
          onSelect={handleSearch}
          onClose={() => setSuggestions([])}
        />
      )}
    </div>
  )
}
