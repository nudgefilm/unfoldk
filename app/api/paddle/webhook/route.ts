import { createHmac } from "crypto"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { HALLYU_PASS_PRICE_IDS, SOURCING_SNIPER_PRICE_IDS } from "@/lib/paddle/constants"

// Paddle webhook 서명 검증
function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const parts: Record<string, string> = {}
  for (const segment of signature.split(";")) {
    const idx = segment.indexOf("=")
    if (idx !== -1) parts[segment.slice(0, idx)] = segment.slice(idx + 1)
  }
  const ts = parts.ts
  const h1 = parts.h1
  if (!ts || !h1) return false
  const payload = `${ts}:${rawBody}`
  const expected = createHmac("sha256", secret).update(payload).digest("hex")
  return expected === h1
}

// Paddle 이벤트 타입
interface PaddleEvent {
  event_type: string
  data: {
    id: string
    customer_id?: string
    status?: string
    custom_data?: { userId?: string }
    items?: Array<{ price?: { id?: string } }>
  }
}

export async function POST(req: Request) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET
  if (!secret) return new Response("Server config error", { status: 500 })

  const rawBody = await req.text()
  const signature = req.headers.get("Paddle-Signature") ?? ""

  if (!verifySignature(rawBody, signature, secret)) {
    return new Response("Unauthorized", { status: 401 })
  }

  let event: PaddleEvent
  try {
    event = JSON.parse(rawBody) as PaddleEvent
  } catch {
    return new Response("Invalid JSON", { status: 400 })
  }

  const { event_type, data } = event
  const supabase = createSupabaseAdminClient()

  // userId는 checkout 시 customData에 박아서 보냄
  const userId = data.custom_data?.userId
  const priceId = data.items?.[0]?.price?.id ?? ""
  const customerId = data.customer_id

  // ── 구독 활성화 / 일회성 결제 완료 ────────────────────────────────────────
  if (
    event_type === "subscription.activated" ||
    event_type === "transaction.completed"
  ) {
    if (!userId || !priceId) {
      // custom_data 없으면 처리 불가 — 200 반환으로 Paddle 재시도 차단
      console.warn("[paddle/webhook] missing userId or priceId", { event_type, userId, priceId })
      return new Response("OK", { status: 200 })
    }

    if (HALLYU_PASS_PRICE_IDS.has(priceId)) {
      // Hallyu Pass 활성화
      await supabase
        .from("users")
        .update({
          plan_type: "pro",
          subscription_status: "active",
          ...(customerId ? { paddle_customer_id: customerId } : {}),
          ...(event_type === "subscription.activated" ? { paddle_subscription_id: data.id } : {}),
        })
        .eq("id", userId)
    }

    if (SOURCING_SNIPER_PRICE_IDS.has(priceId)) {
      // Sourcing Sniper 활성화
      await supabase
        .from("beauty_sellers")
        .update({ sourcing_sniper_active: true })
        .eq("user_id", userId)
    }
  }

  // ── 구독 취소 / 일시정지 ──────────────────────────────────────────────────
  if (
    event_type === "subscription.canceled" ||
    event_type === "subscription.paused"
  ) {
    // userId가 없으면 paddle_subscription_id로 역조회
    let targetUserId = userId

    if (!targetUserId && data.id) {
      const { data: row } = await supabase
        .from("users")
        .select("id")
        .eq("paddle_subscription_id", data.id)
        .maybeSingle()
      targetUserId = (row as { id: string } | null)?.id
    }

    if (!targetUserId) {
      console.warn("[paddle/webhook] cannot resolve userId for", event_type)
      return new Response("OK", { status: 200 })
    }

    if (HALLYU_PASS_PRICE_IDS.has(priceId) || !priceId) {
      // 구독ID 기준으로 취소 → Hallyu Pass 다운그레이드
      await supabase
        .from("users")
        .update({
          plan_type: "free",
          subscription_status: "canceled",
        })
        .eq("id", targetUserId)
    }

    if (SOURCING_SNIPER_PRICE_IDS.has(priceId)) {
      await supabase
        .from("beauty_sellers")
        .update({ sourcing_sniper_active: false })
        .eq("user_id", targetUserId)
    }
  }

  return new Response("OK", { status: 200 })
}
