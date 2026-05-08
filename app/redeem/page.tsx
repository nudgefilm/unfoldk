"use client"

// /redeem — 쿠폰 코드 입력 → Hallyu Pass 활성화
// signup·start 와 동일한 카드 디자인 패턴, 브랜드 컬러 #FF4B6E 유지

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

interface ApplyResponse {
  ok?: boolean
  error?: string
  plan_type?: string
  plan_expires_at?: string
}

// 서버 에러 코드 → 사용자에게 보여줄 영어 메시지 매핑
const ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: "Please log in first to redeem a coupon.",
  invalid_request: "Coupon code is required.",
  not_found: "We couldn't find that coupon code. Please double-check and try again.",
  already_used: "This coupon has already been redeemed.",
  expired: "This coupon has expired.",
  lookup_failed: "Something went wrong. Please try again in a moment.",
  lock_failed: "Something went wrong. Please try again in a moment.",
  user_update_failed: "Coupon was valid but we couldn't activate your plan. Contact support.",
}

export default function RedeemPage() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [success, setSuccess] = useState<{ planType: string; expiresAt: string } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  // 진입 가드 — 비로그인이면 / 로 (StartModal 통해 OAuth)
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

  const handleApply = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMsg("")
    if (!code.trim()) {
      setErrorMsg(ERROR_MESSAGES.invalid_request)
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/apply-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data = (await res.json().catch(() => ({}))) as ApplyResponse

      if (!res.ok || !data.ok) {
        const key = data.error ?? ""
        setErrorMsg(ERROR_MESSAGES[key] ?? "Couldn't apply this coupon. Please try again.")
        setIsLoading(false)
        return
      }

      setSuccess({
        planType: data.plan_type ?? "monthly",
        expiresAt: data.plan_expires_at ?? "",
      })
      setIsLoading(false)
    } catch (err) {
      console.error("[redeem] apply 실패:", err)
      setErrorMsg("Network error. Please try again.")
      setIsLoading(false)
    }
  }

  if (!authChecked) return null

  // 성공 화면
  if (success) {
    const expiresLabel = success.expiresAt
      ? new Date(success.expiresAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : ""

    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
        style={{ backgroundColor: "#0d0d0f" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(circle at 50% 50%, rgba(255, 75, 110, 0.05) 0%, transparent 50%)",
          }}
        />
        <div
          className="w-full max-w-[420px] rounded-2xl p-8 relative z-10 text-center"
          style={{ backgroundColor: "#141418" }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
          >
            <Check className="w-8 h-8" style={{ color: "#FF4B6E" }} />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">Hallyu Pass activated!</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Your{" "}
            <span className="font-medium text-foreground">{success.planType}</span> plan is now active
            {expiresLabel && (
              <>
                {" "}until <span className="font-medium text-foreground">{expiresLabel}</span>
              </>
            )}
            .
          </p>
          <Button
            type="button"
            onClick={() => router.push("/mypage/subscription")}
            className="w-full h-11 rounded-full font-medium text-white"
            style={{ backgroundColor: "#FF4B6E" }}
          >
            Go to my subscription
          </Button>
          <Link
            href="/mypage"
            className="inline-block mt-3 text-sm hover:underline"
            style={{ color: "#FF4B6E" }}
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  // 입력 화면
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
      style={{ backgroundColor: "#0d0d0f" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(255, 75, 110, 0.05) 0%, transparent 50%)",
        }}
      />

      <div
        className="w-full max-w-[420px] rounded-2xl p-8 relative z-10"
        style={{ backgroundColor: "#141418" }}
      >
        <div className="text-center mb-6">
          <Link
            href="/"
            className="text-2xl font-semibold text-foreground mb-2 inline-block hover:opacity-80 transition-opacity"
          >
            UnfoldK
          </Link>
          <div className="flex items-center justify-center gap-2 text-muted-foreground mt-2">
            <Sparkles className="w-4 h-4" style={{ color: "#FF4B6E" }} />
            <span className="text-sm">Redeem your Hallyu Pass</span>
          </div>
        </div>

        <form onSubmit={handleApply} className="space-y-4">
          <div>
            <label className="text-muted-foreground text-xs mb-1 block">Coupon code</label>
            <Input
              type="text"
              placeholder="XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="h-11 bg-[#1a1a1a] border-0 rounded-lg text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary uppercase tracking-wider"
            />
          </div>

          {errorMsg && (
            <p className="text-sm" style={{ color: "#FF4B6E" }}>
              {errorMsg}
            </p>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 rounded-full font-medium text-white"
            style={{ backgroundColor: "#FF4B6E" }}
          >
            {isLoading ? "Applying..." : "Apply"}
          </Button>
        </form>

        <p className="text-center text-muted-foreground text-xs mt-6 leading-relaxed">
          Coupons activate Hallyu Pass for the duration shown on the code.
          <br />
          Got your code via email after a fan event approval? Enter it above.
        </p>
      </div>

      <p className="text-muted-foreground text-xs mt-8 relative z-10">
        © 2026 UNFOLD LAB · unfoldk.com
      </p>
    </div>
  )
}
