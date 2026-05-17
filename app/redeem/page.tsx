"use client"

// /redeem — 쿠폰 코드 입력 → Hallyu Pass 활성화
// 폼 로직은 components/redeem-coupon-form.tsx 로 분리 (모달 사용처와 공유).
// 본 페이지는 auth guard + 카드 wrapping + 브랜드 헤더만 책임.

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { RedeemCouponForm } from "@/components/redeem-coupon-form"

export default function RedeemPage() {
  const router = useRouter()
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

  if (!authChecked) return null

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

      <div className="w-full max-w-[420px] relative z-10">
        <div className="text-center mb-2">
          <Link
            href="/"
            className="text-2xl font-semibold text-foreground inline-block hover:opacity-80 transition-opacity"
          >
            UnfoldK
          </Link>
        </div>

        <RedeemCouponForm />
      </div>

      <p className="text-muted-foreground text-xs mt-8 relative z-10">
        © 2026 UNFOLD LAB · unfoldk.com
      </p>
    </div>
  )
}
