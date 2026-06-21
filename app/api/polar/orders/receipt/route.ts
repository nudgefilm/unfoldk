import { NextRequest, NextResponse } from "next/server"
import { Polar } from "@polar-sh/sdk"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN! })

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

  // 2. orderId 파라미터 검증
  const orderId = req.nextUrl.searchParams.get("orderId")
  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 })
  }

  // 3. Polar 영수증 presigned URL 조회
  try {
    const receipt = await polar.orders.receipt({ id: orderId })
    if (!receipt?.url) {
      return NextResponse.json({ error: "Receipt not available" }, { status: 404 })
    }
    return NextResponse.json({ url: receipt.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[polar/orders/receipt] 영수증 조회 실패:", message, { orderId })
    return NextResponse.json({ error: "Failed to fetch receipt", detail: message }, { status: 502 })
  }
}
