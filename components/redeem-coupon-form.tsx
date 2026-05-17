"use client"

// RedeemCouponForm — 쿠폰 코드 입력 + 결과 화면 (재사용 컴포넌트)
//
// 사용처:
//   - /redeem 페이지 (전체 화면 카드)
//   - /mypage/subscription 의 Dialog (모달)
//
// 인증 가드는 호출자가 책임진다 (이 컴포넌트는 로그인 상태 가정).
// onSuccess 콜백으로 다이얼로그 close + 페이지 refresh 등 외부 동작을 위임.

import { useState } from "react"
import Link from "next/link"
import { Check, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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

interface RedeemCouponFormProps {
  // 성공 시 호출 — 모달에서는 닫기·새로고침, 페이지에서는 단순 noop 후 success view 가 떠 있음
  onSuccess?: (planType: string, expiresAt: string) => void
  // 모달 컨텍스트에서 "Go to my subscription" 버튼 노출 안 할 때 (이미 /mypage/subscription 에서 띄움)
  hideGoToSubscription?: boolean
  // 모달일 때는 카드 wrapper(`bg-[#141418]` + 라운드 + 패딩) 와 헤더(브랜드 로고) 를 호출자가 제공할 수 있음
  hideOuterCard?: boolean
}

export function RedeemCouponForm({
  onSuccess,
  hideGoToSubscription,
  hideOuterCard,
}: RedeemCouponFormProps) {
  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [success, setSuccess] = useState<{ planType: string; expiresAt: string } | null>(null)

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

      const planType = data.plan_type ?? "monthly"
      const expiresAt = data.plan_expires_at ?? ""
      setSuccess({ planType, expiresAt })
      setIsLoading(false)
      onSuccess?.(planType, expiresAt)
    } catch (err) {
      console.error("[redeem] apply 실패:", err)
      setErrorMsg("Network error. Please try again.")
      setIsLoading(false)
    }
  }

  // 성공 화면
  if (success) {
    const expiresLabel = success.expiresAt
      ? new Date(success.expiresAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : ""

    const successInner = (
      <div className="text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
        >
          <Check className="w-8 h-8" style={{ color: "#FF4B6E" }} />
        </div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">Hallyu Pass activated!</h2>
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
        {!hideGoToSubscription && (
          <Link
            href="/mypage/subscription"
            className="block w-full h-11 rounded-full font-medium text-white text-center leading-[44px]"
            style={{ backgroundColor: "#FF4B6E" }}
          >
            Go to my subscription
          </Link>
        )}
      </div>
    )

    return hideOuterCard ? (
      successInner
    ) : (
      <div
        className="w-full max-w-[420px] rounded-2xl p-8"
        style={{ backgroundColor: "#141418" }}
      >
        {successInner}
      </div>
    )
  }

  // 입력 화면
  const formInner = (
    <>
      {!hideOuterCard && (
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground mt-2">
            <Sparkles className="w-4 h-4" style={{ color: "#FF4B6E" }} />
            <span className="text-sm">Redeem your Hallyu Pass</span>
          </div>
        </div>
      )}

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
    </>
  )

  return hideOuterCard ? (
    formInner
  ) : (
    <div
      className="w-full max-w-[420px] rounded-2xl p-8"
      style={{ backgroundColor: "#141418" }}
    >
      {formInner}
    </div>
  )
}
