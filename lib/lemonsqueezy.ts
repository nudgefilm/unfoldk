// Lemon Squeezy 클라이언트 초기화 + 체크아웃 URL 빌더
//
// 사용:
//   import { configureLemonSqueezy, buildCheckoutUrl } from "@/lib/lemonsqueezy"
//   configureLemonSqueezy()
//   const url = buildCheckoutUrl({ plan: "monthly", email, userId })
//
// 환경변수:
//   LEMONSQUEEZY_API_KEY        — 서버 측 API 호출용
//   LEMONSQUEEZY_STORE_ID       — store id (예: 369192)
//   NEXT_PUBLIC_LMS_MONTHLY_URL — monthly 플랜 체크아웃 URL
//   NEXT_PUBLIC_LMS_ANNUAL_URL  — annual 플랜 체크아웃 URL
//
// ⚠️ 현재는 pre-built 체크아웃 URL 에 ?checkout[email]=... 등 쿼리 파라미터를
//    덧붙여 redirect 하는 패턴 (SDK 호출 없이도 동작). lemonSqueezySetup 은
//    추후 구독 상태 동기화·refund 등 server-side 작업을 위해 미리 초기화.

import { lemonSqueezySetup } from "@lemonsqueezy/lemonsqueezy.js"

let configured = false

// SDK 1회 초기화 — 다중 호출 방지 (route 핸들러마다 불려도 안전)
export function configureLemonSqueezy(): void {
  if (configured) return
  const apiKey = process.env.LEMONSQUEEZY_API_KEY
  if (!apiKey) {
    console.warn("[lemonsqueezy] LEMONSQUEEZY_API_KEY 미설정 — SDK 초기화 skip")
    return
  }
  lemonSqueezySetup({
    apiKey,
    onError: (error: Error) => {
      console.error("[lemonsqueezy] SDK error:", error.message)
    },
  })
  configured = true
}

export type LmsPlan = "monthly" | "annual"

interface BuildCheckoutUrlInput {
  plan: LmsPlan
  email: string
  userId: string
}

// pre-built 체크아웃 URL 에 유저 정보·custom data 쿼리 파라미터를 덧붙임
//   ?checkout[email]=...
//   ?checkout[custom][user_id]=...      ← webhook meta.custom_data 로 보존됨
//   ?checkout[custom][plan_type]=...    ← order_created 시 plan_type 매핑용
export function buildCheckoutUrl(input: BuildCheckoutUrlInput): string {
  const baseUrl =
    input.plan === "annual"
      ? process.env.NEXT_PUBLIC_LMS_ANNUAL_URL
      : process.env.NEXT_PUBLIC_LMS_MONTHLY_URL

  if (!baseUrl) {
    throw new Error(
      `${input.plan} 플랜 체크아웃 URL 환경변수 미설정 ` +
        `(NEXT_PUBLIC_LMS_${input.plan === "annual" ? "ANNUAL" : "MONTHLY"}_URL)`
    )
  }

  const url = new URL(baseUrl)
  url.searchParams.set("checkout[email]", input.email)
  url.searchParams.set("checkout[custom][user_id]", input.userId)
  url.searchParams.set("checkout[custom][plan_type]", input.plan)
  return url.toString()
}
