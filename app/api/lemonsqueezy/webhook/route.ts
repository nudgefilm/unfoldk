import { NextResponse } from "next/server"
import crypto from "node:crypto"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { sendPaymentFailedEmail } from "@/lib/email/send-payment-failed-email"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"                                    // node:crypto 사용

// Lemon Squeezy webhook 수신 라우트
//
// 처리 이벤트:
//   - order_created               → users.plan_type 활성화 + LMS ID 저장
//   - subscription_created        → 보강용 로그만 (order_created 가 이미 처리)
//   - subscription_updated        → variant_id → plan_type 재매핑 + plan_expires_at 갱신
//   - subscription_resumed        → cancel 후 재구독 시 plan_type 복구
//   - subscription_cancelled      → users.plan_type = 'free'
//   - subscription_payment_failed → 결제 실패 안내 이메일
//
// 보안:
//   - X-Signature 헤더에 HMAC-SHA256(rawBody, secret) hex 가 들어옴
//   - timingSafeEqual 로 비교 (timing attack 방지)
//   - 검증 실패 시 401 — Lemon Squeezy 가 추후 자동 retry
//
// ⚠️ 반드시 raw body (text) 로 읽어야 서명 검증 가능.
//    Next.js Route Handler 는 default 가 stream 이라 await request.text() 면 OK.
//    JSON 파싱은 검증 통과 후 별도로 수행.
//
// ⚠️ 어떤 단계에서 처리 실패해도 valid 이벤트면 200 ack 권장 — 그러지 않으면
//    Lemon Squeezy 가 무한 retry. 처리 실패는 로그·warning 으로 추적.

interface WebhookCustomData {
  user_id?: string
  plan_type?: string
}

interface WebhookMeta {
  event_name?: string
  custom_data?: WebhookCustomData
}

interface OrderAttributes {
  customer_id?: number
  user_email?: string
  status?: string
  first_subscription_item?: { subscription_id?: number }
}

interface SubscriptionAttributes {
  customer_id?: number
  user_email?: string
  status?: string
  variant_id?: number
  renews_at?: string | null
  ends_at?: string | null
}

// LMS variant_id → 우리 plan_type 매핑 (env 기반, 코드 하드코딩 금지)
function variantIdToPlan(variantId: number | undefined): "monthly" | "annual" | null {
  if (!variantId) return null
  const monthlyId = Number.parseInt(process.env.LEMONSQUEEZY_VARIANT_ID_MONTHLY ?? "0", 10)
  const annualId = Number.parseInt(process.env.LEMONSQUEEZY_VARIANT_ID_ANNUAL ?? "0", 10)
  if (variantId === monthlyId) return "monthly"
  if (variantId === annualId) return "annual"
  return null
}

interface WebhookData {
  type?: string
  id?: string
  attributes?: OrderAttributes & SubscriptionAttributes
}

interface WebhookPayload {
  meta?: WebhookMeta
  data?: WebhookData
}

export async function POST(request: Request) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  if (!secret) {
    console.error("[lms/webhook] LEMONSQUEEZY_WEBHOOK_SECRET 미설정")
    // 500 → LMS 가 retry 시도하므로 환경변수 추가 후 자동 복구 가능
    return NextResponse.json({ error: "no_secret" }, { status: 500 })
  }

  // 1. raw body 읽기 (서명 검증을 위해 필수)
  const rawBody = await request.text()

  // 2. 서명 검증 — HMAC-SHA256 hex
  const signature = request.headers.get("x-signature")
  if (!signature) {
    return NextResponse.json({ error: "no_signature" }, { status: 401 })
  }

  const computed = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")

  let isValid = false
  try {
    const sigBuf = Buffer.from(signature, "hex")
    const compBuf = Buffer.from(computed, "hex")
    if (sigBuf.length === compBuf.length) {
      isValid = crypto.timingSafeEqual(sigBuf, compBuf)
    }
  } catch {
    isValid = false
  }

  if (!isValid) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 })
  }

  // 3. JSON 파싱
  let payload: WebhookPayload
  try {
    payload = JSON.parse(rawBody) as WebhookPayload
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const eventName = payload.meta?.event_name
  console.log("[lms/webhook] received:", eventName, "for", payload.data?.id)

  const supabase = createSupabaseAdminClient()

  switch (eventName) {
    case "order_created": {
      const userId = payload.meta?.custom_data?.user_id
      const planType = payload.meta?.custom_data?.plan_type
      const customerId = payload.data?.attributes?.customer_id?.toString()
      const orderId = payload.data?.id
      const subscriptionId =
        payload.data?.attributes?.first_subscription_item?.subscription_id?.toString() ?? null

      if (!userId) {
        console.warn("[lms/webhook] order_created — custom_data.user_id 없음")
        return NextResponse.json({ ok: true, warning: "no_user_id" })
      }

      const validPlan: "monthly" | "annual" | null =
        planType === "monthly" || planType === "annual" ? planType : null

      const update: Record<string, string> = {
        subscription_status: "active",
      }
      if (validPlan) update.plan_type = validPlan
      if (customerId) update.lms_customer_id = customerId
      if (subscriptionId) update.lms_subscription_id = subscriptionId
      if (orderId) update.lms_order_id = orderId

      const { error } = await supabase.from("users").update(update).eq("id", userId)
      if (error) {
        console.error("[lms/webhook] order_created — update 실패:", error.message)
      }
      break
    }

    case "subscription_cancelled": {
      // 유저 식별 우선순위: custom_data.user_id → lms_subscription_id
      const userId = payload.meta?.custom_data?.user_id
      const subId = payload.data?.id

      const cancelUpdate = {
        plan_type: "free",
        subscription_status: "canceled",
      }

      let error: { message: string } | null = null
      if (userId) {
        const res = await supabase.from("users").update(cancelUpdate).eq("id", userId)
        error = res.error
      } else if (subId) {
        const res = await supabase
          .from("users")
          .update(cancelUpdate)
          .eq("lms_subscription_id", subId)
        error = res.error
      } else {
        console.warn("[lms/webhook] subscription_cancelled — user 식별 불가")
        return NextResponse.json({ ok: true, warning: "no_user_lookup" })
      }

      if (error) {
        console.error("[lms/webhook] subscription_cancelled — update 실패:", error.message)
      }
      break
    }

    case "subscription_payment_failed": {
      // 이메일 우선: payload.data.attributes.user_email → custom_data.user_id 로 lookup
      const userId = payload.meta?.custom_data?.user_id
      let targetEmail = payload.data?.attributes?.user_email ?? null

      if (!targetEmail && userId) {
        const { data } = await supabase
          .from("users")
          .select("email")
          .eq("id", userId)
          .maybeSingle()
        const row = data as { email?: string } | null
        targetEmail = row?.email ?? null
      }

      if (!targetEmail) {
        console.warn("[lms/webhook] payment_failed — 이메일 조회 실패")
        return NextResponse.json({ ok: true, warning: "no_email" })
      }

      const res = await sendPaymentFailedEmail({ to: targetEmail })
      if (!res.ok) {
        console.warn("[lms/webhook] payment_failed — 이메일 발송 실패:", res.error)
      }
      break
    }

    case "subscription_created": {
      // order_created 에서 이미 lms_subscription_id 캡처 + plan_type 활성화 처리됨.
      // 이 이벤트는 보강용 로그만 남기고 끝.
      console.log("[lms/webhook] subscription_created (handled via order_created):", payload.data?.id)
      break
    }

    case "subscription_updated": {
      // Switch Plan / 관리자 변경 / variant 교체 등 — variant_id 로 plan_type 재매핑
      const userId = payload.meta?.custom_data?.user_id
      const subId = payload.data?.id
      const variantId = payload.data?.attributes?.variant_id
      const renewsAt = payload.data?.attributes?.renews_at ?? null
      const endsAt = payload.data?.attributes?.ends_at ?? null
      const status = payload.data?.attributes?.status

      const newPlan = variantIdToPlan(variantId)

      const update: Record<string, string | null> = {}
      if (newPlan) update.plan_type = newPlan
      if (status === "active" || status === "on_trial") update.subscription_status = "active"
      // 만료일: ends_at(취소 예정) 우선, 없으면 renews_at(다음 결제일)
      const expiresAt = endsAt ?? renewsAt
      if (expiresAt) update.plan_expires_at = expiresAt

      if (Object.keys(update).length === 0) {
        console.log("[lms/webhook] subscription_updated — 갱신할 필드 없음")
        break
      }

      let error: { message: string } | null = null
      if (userId) {
        const res = await supabase.from("users").update(update).eq("id", userId)
        error = res.error
      } else if (subId) {
        const res = await supabase
          .from("users")
          .update(update)
          .eq("lms_subscription_id", subId)
        error = res.error
      } else {
        console.warn("[lms/webhook] subscription_updated — user 식별 불가")
        return NextResponse.json({ ok: true, warning: "no_user_lookup" })
      }

      if (error) {
        console.error("[lms/webhook] subscription_updated — update 실패:", error.message)
      }
      break
    }

    case "subscription_resumed": {
      // cancel 후 재구독 — plan_type 복구 (subscription_cancelled 가 'free' 로 깎아둔 상태)
      const userId = payload.meta?.custom_data?.user_id
      const subId = payload.data?.id
      const variantId = payload.data?.attributes?.variant_id
      const renewsAt = payload.data?.attributes?.renews_at ?? null

      const newPlan = variantIdToPlan(variantId)
      const update: Record<string, string | null> = {
        subscription_status: "active",
      }
      if (newPlan) update.plan_type = newPlan
      if (renewsAt) update.plan_expires_at = renewsAt

      let error: { message: string } | null = null
      if (userId) {
        const res = await supabase.from("users").update(update).eq("id", userId)
        error = res.error
      } else if (subId) {
        const res = await supabase
          .from("users")
          .update(update)
          .eq("lms_subscription_id", subId)
        error = res.error
      } else {
        console.warn("[lms/webhook] subscription_resumed — user 식별 불가")
        return NextResponse.json({ ok: true, warning: "no_user_lookup" })
      }

      if (error) {
        console.error("[lms/webhook] subscription_resumed — update 실패:", error.message)
      }
      break
    }

    default:
      // 등록은 했으나 우리가 처리 안 하는 이벤트 — 200 ack 로 retry 방지
      console.log("[lms/webhook] unhandled event:", eventName)
  }

  return NextResponse.json({ ok: true })
}
