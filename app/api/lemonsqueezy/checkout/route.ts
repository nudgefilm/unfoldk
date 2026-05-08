import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { buildCheckoutUrl, type LmsPlan } from "@/lib/lemonsqueezy"

export const dynamic = "force-dynamic"

// Lemon Squeezy 체크아웃 진입 라우트
// GET /api/lemonsqueezy/checkout?plan=monthly  → LMS 체크아웃 URL 로 302
//
// 쿼리:
//   plan: 'monthly' | 'annual' (필수)
//
// 동작:
//   1. 로그인 유저 확인 — 없으면 / 로 (StartModal 통한 OAuth)
//   2. user.email + user.id 를 체크아웃 URL 에 임베드
//   3. 302 redirect (브라우저가 LMS 호스팅 결제 페이지로 이동)
//
// LMS 가 결제 완료 후 자동으로 /payment/success?... 로 redirect (Settings 의 Receipt URL).
// 실제 plan_type 활성화는 webhook (order_created) 에서 처리.

const QuerySchema = z.object({
  plan: z.enum(["monthly", "annual"]),
})

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    plan: searchParams.get("plan") ?? "",
  })
  if (!parsed.success) {
    return NextResponse.redirect(`${origin}/start?error=invalid_plan`)
  }

  // 1. 인증 확인
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !user.email) {
    return NextResponse.redirect(`${origin}/?next=/start`)
  }

  // 2. 체크아웃 URL 빌드
  let checkoutUrl: string
  try {
    checkoutUrl = buildCheckoutUrl({
      plan: parsed.data.plan as LmsPlan,
      email: user.email,
      userId: user.id,
    })
  } catch (err) {
    console.error("[lms/checkout] URL 빌드 실패:", err instanceof Error ? err.message : err)
    return NextResponse.redirect(`${origin}/start?error=checkout_unavailable`)
  }

  // 3. LMS 호스팅 결제 페이지로 이동
  return NextResponse.redirect(checkoutUrl)
}
