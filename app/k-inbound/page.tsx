"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { Lock } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { hasProAccess } from "@/lib/auth/plan"
import { FlightInfoPanel } from "@/components/k-inbound/flight-info-panel"
import { FlightStatusPanel } from "@/components/k-inbound/flight-status-panel"
import { FlightSearchBar } from "@/components/k-inbound/search-bar"
import type { GlobeHandle } from "@/components/k-inbound/globe"
import type { FlightData } from "@/app/api/k-inbound/flight/route"

// Three.js는 SSR 불가 — 클라이언트 전용 동적 로드
const KInboundGlobe = dynamic(
  () => import("@/components/k-inbound/globe"),
  { ssr: false, loading: () => <div className="w-full h-full bg-[#020c1b]" /> },
)

type AuthState = "loading" | "unauthenticated" | "free" | "pro"

export default function KInboundPage() {
  const [authState, setAuthState] = useState<AuthState>("loading")
  const [flight, setFlight] = useState<FlightData | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const globeRef = useRef<GlobeHandle>(null)

  // 인증 + Pro 상태 확인
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
      const isPro = hasProAccess({
        planType: user.plan_type as string,
        isAdmin: user.is_admin as boolean,
        trialEndsAt: user.trial_ends_at as string | null,
      })
      setAuthState(isPro ? "pro" : "free")
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
      // 출발지와 도착지 사이 중간 지점으로 카메라 이동
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

  // ── Pro 전용 모달 ─────────────────────────────────────────────────
  if (authState === "unauthenticated" || authState === "free") {
    return (
      <div className="fixed inset-0 bg-[#020c1b] flex flex-col">
        {/* 뒷배경 — 흐릿한 지구 */}
        <KInboundGlobe className="absolute inset-0 opacity-30 pointer-events-none" />

        {/* 잠금 모달 */}
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
                <Link
                  href="/signup"
                  className="block w-full py-3 rounded-xl bg-[#FF4B6E] hover:bg-[#ff6080] text-white font-semibold text-sm transition-colors mb-2"
                >
                  Sign up — it's free
                </Link>
                <Link
                  href="/login"
                  className="block w-full py-2.5 rounded-xl border border-[#1a4a7a]/60 hover:bg-[#0a1e30] text-[#4da6ff] text-sm transition-colors"
                >
                  Already have an account
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/pricing"
                  className="block w-full py-3 rounded-xl bg-[#FF4B6E] hover:bg-[#ff6080] text-white font-semibold text-sm transition-colors mb-2"
                >
                  Get Hallyu Pass
                </Link>
                <p className="text-[11px] text-[#aac4e0]/40">
                  Unlock all 5 Hallyu services for $9/month
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Pro 메인 ──────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-[#020c1b] overflow-hidden">
      {/* 지구본 전체화면 */}
      <KInboundGlobe ref={globeRef} className="absolute inset-0 w-full h-full" />

      {/* 상단 검색 바 */}
      <FlightSearchBar onSearch={handleSearch} loading={searching} error={searchError} />

      {/* 좌측 패널 */}
      {flight && <FlightInfoPanel flight={flight} />}

      {/* 우측 패널 */}
      {flight && <FlightStatusPanel flight={flight} />}

      {/* 하단 진행바 */}
      {flight && (
        <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
          <div className="bg-[#020c1b]/60 backdrop-blur-sm border-t border-[#1a4a7a]/40 px-6 py-3">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-1.5 text-[11px] text-[#aac4e0]/60">
                <span className="font-mono">{flight.departure.iata}</span>
                <span className="font-semibold text-white/80 tabular-nums">
                  {Math.round(flight.progressRatio * 100)}% — {flight.number}
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
        </div>
      )}

      {/* 좌상단 브랜드 / 홈 링크 */}
      <div className="absolute top-5 left-4 z-10 pointer-events-auto">
        <Link
          href="/"
          className="text-[11px] font-bold tracking-widest uppercase text-[#4da6ff]/60 hover:text-[#4da6ff]/90 transition-colors"
        >
          ← UnfoldK
        </Link>
      </div>
    </div>
  )
}
