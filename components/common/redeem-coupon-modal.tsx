"use client"

// 쿠폰 적용 모달 — /redeem 페이지의 폼·검증 로직을 인플레이스 모달로 이식.
// 성공 시 호출자에게 토스트는 위임(useToast 사용), 실패는 모달 내 인라인 에러.
// /api/auth/apply-coupon 엔드포인트는 그대로 재사용.

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

interface ApplyResponse {
  ok?: boolean
  error?: string
  plan_type?: string
  plan_expires_at?: string
}

// 서버 에러 코드 → 사용자 노출 영문 메시지 (redeem/page.tsx 와 동일 매핑)
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

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  // 적용 성공 후 부모에서 후속 동작이 필요할 때 (예: 플랜 캐시 무효화)
  onApplied?: () => void
}

export function RedeemCouponModal({ open, onOpenChange, onApplied }: Props) {
  const { toast } = useToast()
  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  // 모달 닫힐 때 폼 상태 초기화 — 다음 오픈 시 깨끗한 상태로
  useEffect(() => {
    if (!open) {
      setCode("")
      setErrorMsg("")
      setIsLoading(false)
    }
  }, [open])

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
      // 성공: 토스트 + 모달 닫기 + 부모 콜백
      toast({
        title: "Coupon applied!",
        description: "Your Hallyu Pass is now active.",
      })
      onOpenChange(false)
      onApplied?.()
    } catch (err) {
      console.error("[redeem-modal] apply 실패:", err)
      setErrorMsg("Network error. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141418] border-[#2a2a2a] text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: "#FF4B6E" }} />
            Redeem your Hallyu Pass
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Enter the coupon code you received after a fan event approval.
          </DialogDescription>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  )
}
