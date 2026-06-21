import { NextRequest, NextResponse } from "next/server"
import { Polar } from "@polar-sh/sdk"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// orders:read 스코프 필요
const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN! })

export interface BillingEntry {
  id: string
  date: string        // ISO 문자열
  description: string
  amountCents: number
  currency: string    // e.g. "usd"
  status: string      // "paid" | "refunded" | "partially_refunded" | "pending" | "void" | "draft"
}

export async function GET(req: NextRequest) {
  // 1. Supabase JWT 검증
  const authHeader = req.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createSupabaseAdminClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. polar_customer_id 조회 — migration 0086 미적용 시 컬럼 없음 에러 → 빈 배열 반환
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("polar_customer_id")
    .eq("id", user.id)
    .single()

  if (profileError) {
    // 컬럼 미존재(migration 0086 미적용) 포함 모든 조회 실패 → 빈 내역
    console.warn("[polar/orders] polar_customer_id 조회 실패 (migration 0086 미적용?):", profileError.message, { userId: user.id })
    return NextResponse.json({ orders: [] })
  }

  const customerId = (profile as { polar_customer_id?: string | null } | null)?.polar_customer_id
  if (!customerId) {
    // polar_customer_id 미설정 (Free 플랜 또는 웹훅 처리 전)
    return NextResponse.json({ orders: [] })
  }

  // 3. Polar 주문 목록 조회 (최대 100건 per page)
  try {
    const pageIterator = await polar.orders.list({ customerId, limit: 100 })
    const orders: BillingEntry[] = []

    for await (const page of pageIterator) {
      for (const order of page.result.items) {
        orders.push({
          id: order.id,
          date: order.createdAt instanceof Date
            ? order.createdAt.toISOString()
            : String(order.createdAt),
          description: order.product?.name ?? "Hallyu Pass",
          amountCents: order.totalAmount,
          currency: order.currency,
          status: order.status,
        })
      }
    }

    // 최신순 정렬
    orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({ orders })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[polar/orders] Polar API 호출 실패:", message, { customerId })

    // orders:read 스코프 누락 시 명확한 메시지
    const isScope = message.includes("insufficient_scope") || message.includes("403")
    return NextResponse.json(
      { error: isScope ? "MISSING_SCOPE_ORDERS_READ" : "POLAR_API_ERROR", detail: message },
      { status: 502 }
    )
  }
}
