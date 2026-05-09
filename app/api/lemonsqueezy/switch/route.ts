import { NextResponse } from "next/server"
import { z } from "zod"
import { updateSubscription } from "@lemonsqueezy/lemonsqueezy.js"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { configureLemonSqueezy, type LmsPlan } from "@/lib/lemonsqueezy"

export const dynamic = "force-dynamic"

// Lemon Squeezy 구독 변경 (Switch Plan) 라우트
// GET /api/lemonsqueezy/switch?plan=monthly|annual
//
// 동작:
//   1. 로그인 확인 — 없으면 / 로
//   2. users.lms_subscription_id 조회
//   3. 구독 ID 없음 → /api/lemonsqueezy/checkout 으로 위임 (신규 결제 흐름)
//   4. 구독 ID 있음 → LMS SDK updateSubscription 으로 variant 변경
//      (기존 구독을 새 variant 로 prorate — 이중 청구 없음)
//   5. 성공/실패 시 /mypage/subscription 으로 redirect
//
// 주의:
//   plan_type / plan_expires_at 동기화는 webhook 의 subscription_updated 가 처리.
//   이 라우트에서는 DB 를 직접 갱신하지 않음 (race condition 방지).
//
// 환경변수:
//   LEMONSQUEEZY_VARIANT_ID_MONTHLY
//   LEMONSQUEEZY_VARIANT_ID_ANNUAL

const QuerySchema = z.object({
  plan: z.enum(["monthly", "annual"]),
})

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    plan: searchParams.get("plan") ?? "",
  })
  if (!parsed.success) {
    return NextResponse.redirect(`${origin}/mypage/subscription?error=invalid_plan`)
  }
  const plan: LmsPlan = parsed.data.plan

  // 1. 로그인 확인
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/?next=/mypage/subscription`)
  }

  // 2. users.lms_subscription_id 조회
  const { data: profile } = await supabase
    .from("users")
    .select("lms_subscription_id")
    .eq("id", user.id)
    .single()
  const row = profile as { lms_subscription_id?: string | null } | null
  const subscriptionId = row?.lms_subscription_id ?? null

  // 3. 기존 구독 없음 → 신규 checkout 으로 위임
  if (!subscriptionId) {
    return NextResponse.redirect(`${origin}/api/lemonsqueezy/checkout?plan=${plan}`)
  }

  // 4. variant ID 환경변수 확인
  const variantIdStr =
    plan === "monthly"
      ? process.env.LEMONSQUEEZY_VARIANT_ID_MONTHLY
      : process.env.LEMONSQUEEZY_VARIANT_ID_ANNUAL
  const variantId = variantIdStr ? Number.parseInt(variantIdStr, 10) : Number.NaN
  if (!Number.isFinite(variantId) || variantId <= 0) {
    console.error(
      `[lms/switch] variant ID 환경변수 미설정: LEMONSQUEEZY_VARIANT_ID_${plan === "monthly" ? "MONTHLY" : "ANNUAL"}`
    )
    return NextResponse.redirect(`${origin}/mypage/subscription?error=switch_failed`)
  }

  // 5. LMS SDK 초기화 + updateSubscription
  configureLemonSqueezy()
  try {
    const { error } = await updateSubscription(subscriptionId, {
      variantId,
    })
    if (error) {
      console.error("[lms/switch] updateSubscription 실패:", error.message)
      return NextResponse.redirect(`${origin}/mypage/subscription?error=switch_failed`)
    }
  } catch (err) {
    console.error("[lms/switch] 예외:", err instanceof Error ? err.message : err)
    return NextResponse.redirect(`${origin}/mypage/subscription?error=switch_failed`)
  }

  // 6. 성공 — webhook 의 subscription_updated 가 plan_type 동기화
  return NextResponse.redirect(`${origin}/mypage/subscription?switched=1&plan=${plan}`)
}
