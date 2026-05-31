"use client"

// Trial 배너 — 로그인한 free 플랜 유저 중 trial 활성인 경우에만 표시.
// 클릭 시 /pricing 이동. D-7 이하에서 색상 강조.
// Header 내부에 EarlyAccessBanner 다음에 위치 (비로그인용 배너와 상호 배제).

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Clock } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { isInTrial, trialDaysRemaining } from "@/lib/auth/plan"

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

export function TrialBanner() {
  const pathname = usePathname()
  // isLoggedIn: 명시적 로그인 확인 — false(초기값)이면 절대 배너 미노출
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    let mounted = true

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!mounted) return

      if (!user) {
        // 비로그인 — isLoggedIn false 유지, ready만 true
        setReady(true)
        return
      }

      setIsLoggedIn(true)

      const { data } = await supabase
        .from("users")
        .select("trial_ends_at, plan_type")
        .eq("id", user.id)
        .maybeSingle()

      if (!mounted) return

      // 이미 유료 플랜이면 trial 배너 불필요
      if (data?.plan_type === "monthly" || data?.plan_type === "annual") {
        setReady(true)
        return
      }

      setTrialEndsAt(data?.trial_ends_at ?? null)
      setReady(true)
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  // auth/결제/어드민 페이지에서는 미노출 (Header 가드와 동일)
  if (pathname && HIDE_PREFIXES.some((p) => pathname.startsWith(p))) return null

  // 비로그인 또는 데이터 준비 전 → 렌더 없음
  if (!ready || !isLoggedIn || !trialEndsAt) return null
  if (!isInTrial(trialEndsAt)) return null

  const days = trialDaysRemaining(trialEndsAt)
  const isUrgent = days <= 7

  return (
    <Link
      href="/mypage/subscription"
      className="block w-full text-white text-center py-2 text-xs sm:text-sm font-medium transition-opacity hover:opacity-90"
      style={{
        background: isUrgent
          ? "linear-gradient(90deg, rgba(255,100,0,0.95), rgba(220,70,0,0.9))"
          : "linear-gradient(90deg, rgba(255,75,110,0.85), rgba(200,45,80,0.8))",
      }}
    >
      <Clock className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" aria-hidden />
      {isUrgent ? (
        <>
          <strong>Trial D-{days}</strong> — only {days} day{days !== 1 ? "s" : ""} left.{" "}
          <span className="underline underline-offset-2">Upgrade to keep access →</span>
        </>
      ) : (
        <>
          Free Trial · <strong>D-{days}</strong> remaining ·{" "}
          <span className="underline underline-offset-2">Upgrade to Hallyu Pass →</span>
        </>
      )}
    </Link>
  )
}
