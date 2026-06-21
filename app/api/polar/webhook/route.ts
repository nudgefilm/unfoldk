import { Webhooks } from "@polar-sh/nextjs"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { HALLYU_PASS_PRODUCT_ID_SET } from "@/lib/polar/constants"
import type { Subscription } from "@polar-sh/sdk/models/components/subscription"

// ── 유저 식별 ─────────────────────────────────────────────────────────────────
// 우선순위: checkout 시 metadata 에 박은 userId → customer.email 역조회
async function resolveUserId(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  data: { metadata: Record<string, unknown>; customer: { email?: string | null } }
): Promise<string | null> {
  const fromMeta = data.metadata?.userId
  if (typeof fromMeta === "string" && fromMeta) return fromMeta

  const email = data.customer.email
  if (!email) return null

  const { data: row } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle()
  return (row as { id: string } | null)?.id ?? null
}

// ── Hallyu Pass 활성화 ────────────────────────────────────────────────────────
async function activateHallyuPass(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  sub: Subscription,
  userId: string
) {
  const periodEnd =
    sub.currentPeriodEnd instanceof Date
      ? sub.currentPeriodEnd.toISOString()
      : String(sub.currentPeriodEnd)

  // 1단계: plan_type / subscription_status — 핵심 권한 컬럼 (반드시 성공해야 함)
  const { error: planError } = await supabase
    .from("users")
    .update({ plan_type: "pro", subscription_status: "active", plan_expires_at: periodEnd })
    .eq("id", userId)

  if (planError) {
    console.error("[polar/webhook] plan_type 업데이트 실패:", planError.message, { userId, subId: sub.id })
    return
  }
  console.info("[polar/webhook] plan_type=pro 반영 완료", { userId, subId: sub.id })

  // 2단계: polar_* 컬럼 — migration 0086 적용 후 채워짐 (미적용 시 무시)
  const { error: polarError } = await supabase
    .from("users")
    .update({ polar_customer_id: sub.customerId, polar_subscription_id: sub.id })
    .eq("id", userId)

  if (polarError) {
    console.warn("[polar/webhook] polar_* 컬럼 업데이트 실패 (migration 0086 미적용?):", polarError.message, { userId })
  }
}

// ── Hallyu Pass 비활성화 ──────────────────────────────────────────────────────
async function deactivateHallyuPass(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  reason: string
) {
  const { error } = await supabase
    .from("users")
    .update({ plan_type: "free", subscription_status: "canceled" })
    .eq("id", userId)

  if (error) {
    console.error(`[polar/webhook] ${reason} — users 업데이트 실패:`, error.message, { userId })
  }
}

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,

  // ── subscription.active ────────────────────────────────────────────────────
  // 구독 첫 결제 완료 또는 연체 후 결제 복구 → Pro 활성화
  onSubscriptionActive: async ({ data }) => {
    if (!HALLYU_PASS_PRODUCT_ID_SET.has(data.productId)) {
      console.warn("[polar/webhook] subscription.active — 미등록 productId (env var 미설정?):", {
        productId: data.productId,
        knownIds: [...HALLYU_PASS_PRODUCT_ID_SET],
      })
      return
    }

    const supabase = createSupabaseAdminClient()
    const userId = await resolveUserId(supabase, data)
    if (!userId) {
      console.error("[polar/webhook] subscription.active — userId 미확인:", {
        subId: data.id,
        email: data.customer.email,
      })
      return
    }

    await activateHallyuPass(supabase, data, userId)
  },

  // ── subscription.updated ───────────────────────────────────────────────────
  // 플랜 변경(월간→연간 등) 또는 갱신 주기 변경 → plan_expires_at 동기화
  onSubscriptionUpdated: async ({ data }) => {
    if (!HALLYU_PASS_PRODUCT_ID_SET.has(data.productId)) return
    // status 가 active 가 아니면 무시 (pending/canceled 등)
    if (data.status !== "active") return

    const supabase = createSupabaseAdminClient()
    // subscription ID 기준 역조회 (metadata.userId 가 없을 수 있음)
    const userId = await resolveUserId(supabase, data)
    if (!userId) return

    const periodEnd =
      data.currentPeriodEnd instanceof Date
        ? data.currentPeriodEnd.toISOString()
        : String(data.currentPeriodEnd)

    const { error } = await supabase
      .from("users")
      .update({ plan_expires_at: periodEnd })
      .eq("id", userId)

    if (error) {
      console.error("[polar/webhook] subscription.updated — plan_expires_at 업데이트 실패:", error.message, { userId })
    } else {
      console.info("[polar/webhook] subscription.updated — plan_expires_at 갱신:", { userId, periodEnd })
    }
  },

  // ── subscription.canceled ──────────────────────────────────────────────────
  // 기간말 취소 예약 상태 (cancel_at_period_end=true, 아직 active)
  // 실제 접근 차단은 subscription.revoked 에서 처리 — 여기서는 로그만 남김
  onSubscriptionCanceled: async ({ data }) => {
    if (!HALLYU_PASS_PRODUCT_ID_SET.has(data.productId)) return
    console.info("[polar/webhook] subscription.canceled — 기간말 취소 예약:", {
      subId: data.id,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
      currentPeriodEnd: data.currentPeriodEnd,
    })
    // 접근은 currentPeriodEnd 까지 유지 — 다운그레이드 처리 안 함
  },

  // ── subscription.revoked ───────────────────────────────────────────────────
  // 구독 실제 종료 (기간 만료 또는 즉시 취소) → Free 다운그레이드
  onSubscriptionRevoked: async ({ data }) => {
    if (!HALLYU_PASS_PRODUCT_ID_SET.has(data.productId)) return

    const supabase = createSupabaseAdminClient()
    let userId = await resolveUserId(supabase, data)

    if (!userId) {
      // metadata.userId 미확인 → polar_subscription_id 역조회
      const { data: row } = await supabase
        .from("users")
        .select("id")
        .eq("polar_subscription_id", data.id)
        .maybeSingle()
      userId = (row as { id: string } | null)?.id ?? null
    }

    if (!userId) {
      console.error("[polar/webhook] subscription.revoked — userId 미확인:", {
        subId: data.id,
        email: data.customer.email,
      })
      return
    }

    await deactivateHallyuPass(supabase, userId, "subscription.revoked")
  },

  // ── subscription.uncanceled ────────────────────────────────────────────────
  // 취소 예약 철회 (기간 종료 전 재활성화) → 상태 active 유지 확인
  onSubscriptionUncanceled: async ({ data }) => {
    if (!HALLYU_PASS_PRODUCT_ID_SET.has(data.productId)) return
    console.info("[polar/webhook] subscription.uncanceled — 취소 철회:", { subId: data.id })
    // 이미 active 상태 유지 중 → 별도 DB 변경 불필요
  },

  // ── order.paid ─────────────────────────────────────────────────────────────
  // 구독 갱신 결제 완료 → plan_expires_at 동기화
  // subscription.updated 이벤트와 중복될 수 있으나, order 레벨 확인 목적으로 유지
  onOrderPaid: async ({ data }) => {
    // 구독 갱신 주문만 처리 (일회성 주문 제외)
    if (!data.subscriptionId) return

    const supabase = createSupabaseAdminClient()
    const { data: row } = await supabase
      .from("users")
      .select("id")
      .eq("polar_subscription_id", data.subscriptionId)
      .maybeSingle()

    const userId = (row as { id: string } | null)?.id
    if (!userId) return

    console.info("[polar/webhook] order.paid — 구독 갱신 결제 확인:", {
      subscriptionId: data.subscriptionId,
      userId,
    })
    // plan_expires_at 은 subscription.updated 에서 이미 업데이트됨 — 여기서는 로그만
  },

  // ── Polar 에 없는 이벤트 안내 ──────────────────────────────────────────────
  // Paddle: subscription.paused — Polar 에는 일시정지(pause) 개념 없음.
  // past_due 상태는 Polar 가 자동 재시도하며, 결제 성공 시 subscription.active 재발생.
  // 별도 처리 불필요.
})
