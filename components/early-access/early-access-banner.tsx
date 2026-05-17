"use client"

// 상단 Early Access 배너 — 모든 페이지 (Header 위) 노출.
// 닫기 1회 후 같은 세션에서는 재노출 X (sessionStorage).
// HIDE_PREFIXES — admin·인증·결제 등 자체 레이아웃은 노출 안 함 (Header 동일 정책).

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Rocket, X } from "lucide-react"
import { RoadmapModal } from "@/components/early-access/roadmap-modal"

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
  const [roadmapOpen, setRoadmapOpen] = useState(false)

  // 마운트 시 sessionStorage 확인. SSR 일관성 위해 클라이언트 mount 후 visible 결정.
  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem(STORAGE_KEY) === "1"
      if (!dismissed) setVisible(true)
    } catch {
      // sessionStorage 차단된 환경 — 매 페이지 노출 (안전 fallback)
      setVisible(true)
    }
  }, [])

  // 가드 — 인증/관리 페이지에서는 미노출
  if (pathname && HIDE_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null
  }

  if (!visible) return null

  const handleDismiss = () => {
    setVisible(false)
    try {
      sessionStorage.setItem(STORAGE_KEY, "1")
    } catch {
      // localStorage·sessionStorage 차단 환경 — 무시
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
            <span className="font-semibold">Early Access</span>
            <span className="hidden sm:inline"> — KfoodKit launching soon. Join free and get notified!</span>
            <span className="sm:hidden"> — KfoodKit soon.</span>
          </p>
          <button
            type="button"
            onClick={() => setRoadmapOpen(true)}
            className="text-xs sm:text-sm font-semibold underline-offset-2 hover:underline whitespace-nowrap"
          >
            See what&apos;s coming
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

      <RoadmapModal open={roadmapOpen} onOpenChange={setRoadmapOpen} />
    </>
  )
}
