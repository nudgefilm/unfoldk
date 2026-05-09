"use client"

// /start 페이지 — Google OAuth 후 신규 가입자 플랜·약관 동의 화면
// callback 라우트가 users.agreed_to_terms = false 인 경우 ?new=true 로 보낸다.
//
// 흐름:
//   1. (가드) 비로그인이면 / 로 복귀 (middleware 가 1차 가드, 페이지 진입 시 2차 확인)
//   2. 플랜 선택 (Free / Hallyu Pass monthly|annual)
//   3. 약관 동의 체크
//   4. POST /api/auth/complete-signup 호출 → /mypage 이동
//
// UI 패턴: 기존 signup/page.tsx 의 플랜 선택 + 약관 체크 컴포넌트를 거의 그대로 재활용
//   (className·style 그대로 가져옴 — 디자인 일관성 유지)

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

// useSearchParams() 는 Suspense boundary 안에서만 사용 가능 — Next.js 빌드 요구사항
export default function StartPage() {
  return (
    <Suspense fallback={null}>
      <StartPageInner />
    </Suspense>
  )
}

function StartPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // ?new=true 가 아니어도 진입 가능 — agreed_to_terms 가 이미 true 면 자동으로 /mypage 로 우회
  const _isNew = searchParams.get("new") === "true"
  // 가입 완료 후 복귀 경로 — callback 에서 forward 한 ?next 우선, 없으면 /mypage.
  // open redirect 방지 — 내부 경로만 허용 (callback 도 검증하지만 이중 가드)
  const nextRaw = searchParams.get("next")
  const nextPath =
    nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/mypage"

  const [selectedPlan, setSelectedPlan] = useState<"free" | "pro">("pro")
  const [isAnnual, setIsAnnual] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [authChecked, setAuthChecked] = useState(false)

  // 진입 가드 — 비로그인이면 / 로
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/")
        return
      }
      setAuthChecked(true)
    })
  }, [router])

  // 약관 동의 + 플랜 확정 → API 호출 → /mypage
  const handleComplete = async () => {
    setErrorMsg("")
    if (!agreedToTerms) {
      setErrorMsg("Please agree to the Terms and Privacy Policy")
      return
    }

    // 사용자가 선택한 플랜 (UI 매핑)
    const planChoice: "free" | "monthly" | "annual" =
      selectedPlan === "free" ? "free" : isAnnual ? "annual" : "monthly"

    // ⚠️ 약관 동의·가입 완료 처리는 plan_type='free' 로 락인 (결제 완료 전엔 무료 상태).
    //    유료 플랜 선택 시 LMS webhook(order_created) 이 결제 완료 후 plan_type 을
    //    monthly/annual 로 업그레이드. 결제 도중 이탈해도 유저는 free 로 사용 가능.
    setIsLoading(true)
    const res = await fetch("/api/auth/complete-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_type: "free",
        agreed_to_terms: true,
      }),
    })

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setErrorMsg(data.error ?? "Failed to complete signup. Please try again.")
      setIsLoading(false)
      return
    }

    if (planChoice === "free") {
      // 무료 플랜 — next 가 있으면 원래 경로, 없으면 /mypage
      router.push(nextPath)
      router.refresh()
      return
    }

    // 유료 플랜 — Lemon Squeezy 호스팅 체크아웃으로 redirect
    // (서버 라우트가 user.email + user.id 를 URL 에 임베드 후 LMS 로 302)
    window.location.href = `/api/lemonsqueezy/checkout?plan=${planChoice}`
  }

  // 인증 검사 전엔 빈 화면 (깜빡임 방지)
  if (!authChecked) return null

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
      style={{ backgroundColor: "#0d0d0f" }}
    >
      {/* Radial Gradient Glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(255, 75, 110, 0.05) 0%, transparent 50%)"
        }}
      />

      {/* Card */}
      <div
        className="w-full max-w-[420px] rounded-2xl p-8 relative z-10"
        style={{ backgroundColor: "#141418" }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <Link href="/" className="text-2xl font-semibold text-foreground mb-2 inline-block hover:opacity-80 transition-opacity">
            UnfoldK
          </Link>
          <p className="text-muted-foreground mt-2">One last step — choose your plan</p>
        </div>

        {/* Plan Selector */}
        <div className="mb-5">
          <p className="text-muted-foreground text-sm mb-3">Choose your plan</p>
          <div className="grid grid-cols-2 gap-3">
            {/* Free Plan */}
            <button
              type="button"
              onClick={() => setSelectedPlan("free")}
              className={`p-4 rounded-xl text-left transition-all ${
                selectedPlan === "free"
                  ? "bg-[#1a1a1a] border-2 border-muted-foreground"
                  : "bg-[#1a1a1a] border border-border/30 hover:border-border/60"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-foreground font-medium">Free</span>
                {selectedPlan === "free" && (
                  <div className="w-5 h-5 rounded-full bg-muted-foreground flex items-center justify-center">
                    <Check className="w-3 h-3 text-background" />
                  </div>
                )}
              </div>
              <p className="text-muted-foreground text-sm">$0/month</p>
              <p className="text-muted-foreground text-xs mt-1">Basic access</p>
            </button>

            {/* Pro Plan */}
            <button
              type="button"
              onClick={() => setSelectedPlan("pro")}
              className={`p-4 rounded-xl text-left transition-all ${
                selectedPlan === "pro"
                  ? "bg-[#1a1a1a] border-2"
                  : "bg-[#1a1a1a] border border-border/30 hover:border-border/60"
              }`}
              style={selectedPlan === "pro" ? { borderColor: "#FF4B6E" } : {}}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-foreground font-medium">Hallyu Pass</span>
                {selectedPlan === "pro" && (
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "#FF4B6E" }}
                  >
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <p className="font-medium" style={{ color: "#FF4B6E" }}>
                {isAnnual ? "$10/month" : "$15/month"}
              </p>
              <p className="text-muted-foreground text-xs mt-1">Full access to all 5 services</p>
            </button>
          </div>

          {/* Annual Toggle */}
          <div className="flex items-center justify-between mt-3 p-3 bg-[#1a1a1a] rounded-lg">
            <span className="text-muted-foreground text-sm">
              Pay annually and save 33%
            </span>
            <button
              type="button"
              onClick={() => setIsAnnual(!isAnnual)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                isAnnual ? "" : "bg-border/50"
              }`}
              style={isAnnual ? { backgroundColor: "#FF4B6E" } : {}}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  isAnnual ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Terms Checkbox */}
        <div className="flex items-start gap-3 mb-5">
          <button
            type="button"
            onClick={() => setAgreedToTerms(!agreedToTerms)}
            className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors mt-0.5 ${
              agreedToTerms ? "border-transparent" : "border-border/50 bg-[#1a1a1a]"
            }`}
            style={agreedToTerms ? { backgroundColor: "#FF4B6E" } : {}}
          >
            {agreedToTerms && <Check className="w-3 h-3 text-white" />}
          </button>
          <p className="text-muted-foreground text-sm">
            I agree to the{" "}
            <Link href="/terms" className="hover:underline" style={{ color: "#FF4B6E" }}>
              Terms of Use
            </Link>
            {" "}and{" "}
            <Link href="/privacy" className="hover:underline" style={{ color: "#FF4B6E" }}>
              Privacy Policy
            </Link>
          </p>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <p className="text-sm mb-3" style={{ color: "#FF4B6E" }}>
            {errorMsg}
          </p>
        )}

        {/* Complete Button */}
        <Button
          type="button"
          onClick={handleComplete}
          disabled={isLoading}
          className="w-full h-11 rounded-full font-medium text-white"
          style={{ backgroundColor: "#FF4B6E" }}
        >
          {isLoading ? "Setting up..." : "Continue"}
        </Button>
      </div>

      {/* Copyright */}
      <p className="text-muted-foreground text-xs mt-8 relative z-10">
        © 2026 UNFOLD LAB · unfoldk.com
      </p>
    </div>
  )
}
