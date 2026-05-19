"use client"

// 상단 Early Access 배너 — 비로그인 사용자에게만 노출 (가입 유도).
// 로그인 사용자에겐 가입 push 가 노이즈라 미출력 — 세션 mount/auth 변화 모두 추적.
// 닫기 1회 후 같은 세션에서는 재노출 X (sessionStorage).
// HIDE_PREFIXES — admin·인증·결제 등 자체 레이아웃은 노출 안 함 (Header 동일 정책).

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Rocket, X } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { StartModal } from "@/components/start-modal"

const STORAGE_KEY = "ea-banner-dismissed"

// Header 와 동일한 prefix 가드. 인증/결제 페이지에서 배너 노출 시 시각적 충돌·UX 부담.
const HIDE_PREFIXES = [
  "/admin",
  "/login",
  "/signup",
  "/start",
  "/redeem",
  "/forgot-password",
  "/verify-email",
  "/payment",
]

export function EarlyAccessBanner() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  // null = 아직 확인 전 (SSR hydration · 마운트 직후). 결과 확정 후 true/false.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [startOpen, setStartOpen] = useState(false)

  // 마운트 시 sessionStorage dismiss 플래그 확인.
  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem(STORAGE_KEY) === "1"
      if (!dismissed) setVisible(true)
    } catch {
      // sessionStorage 차단 환경 — 안전 fallback (노출)
      setVisible(true)
    }
  }, [])

  // Supabase 세션 확인 + auth 변화 구독 — 로그인 직후 배너 자동 사라지게.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    let mounted = true

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!mounted) return
      setIsAuthenticated(!!user)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setIsAuthenticated(!!session?.user)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // 가드 — 인증/관리 페이지에서는 미노출
  if (pathname && HIDE_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null
  }

  // 인증 상태 확인 전엔 미노출 (flash-of-banner 방지).
  // 로그인 상태면 영구 미노출 (가입 유도 노이즈 제거).
  if (isAuthenticated !== false) return null
  if (!visible) return null

  const handleDismiss = () => {
    setVisible(false)
    try {
      sessionStorage.setItem(STORAGE_KEY, "1")
    } catch {
      // 차단 환경 — 무시
    }
  }

  return (
    <>
      <div
        className="w-full text-white"
        style={{
          background:
            "linear-gradient(90deg, rgba(255, 75, 110, 0.95), rgba(255, 75, 110, 0.7))",
        }}
        role="region"
        aria-label="Early Access announcement"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3">
          <Rocket className="w-4 h-4 flex-shrink-0" aria-hidden />
          <p className="text-xs sm:text-sm font-medium leading-tight flex-1 min-w-0">
            Track K-pop comebacks · Discover dramas · Learn Korean · Explore Korea
            <span className="hidden sm:inline"> | all in one place. Updated daily. Free to join.</span>
          </p>
          <button
            type="button"
            onClick={() => setStartOpen(true)}
            className="text-xs sm:text-sm font-semibold underline-offset-2 hover:underline whitespace-nowrap"
          >
            Start now
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss banner"
            className="text-white/80 hover:text-white -mr-1 p-1 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* OAuth/Email 시작 모달 — 같은 화면에서 진입, 완료 후 현재 경로 유지 */}
      <StartModal open={startOpen} onOpenChange={setStartOpen} />
    </>
  )
}
