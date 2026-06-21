"use client"

// PolarProvider — Polar 체크아웃 유틸 hook
//
// Paddle과 달리 Polar는 클라이언트 SDK 초기화 불필요.
// 체크아웃은 /api/polar/checkout GET 라우트를 통해 Polar 호스팅 페이지로 리다이렉트.
// 상품 ID는 서버에서만 관리 (lib/polar/constants.ts) — 클라이언트는 plan 이름만 전달.

export type PolarPlan = "monthly" | "annual"

interface OpenCheckoutOptions {
  email?: string
  userId?: string
}

export function usePolar() {
  function openCheckout(plan: PolarPlan, opts?: OpenCheckoutOptions): void {
    const params = new URLSearchParams({ plan })
    if (opts?.email) params.set("email", opts.email)
    if (opts?.userId) params.set("userId", opts.userId)
    window.location.href = `/api/polar/checkout?${params.toString()}`
  }

  return { openCheckout }
}
