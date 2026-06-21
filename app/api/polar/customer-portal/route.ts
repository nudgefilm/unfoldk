import { NextRequest, NextResponse } from "next/server"
import { Polar } from "@polar-sh/sdk"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// customerSessions:write 스코프 필요
const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN! })

export async function GET(req: NextRequest) {
  // 1. Supabase JWT 검증
  const authHeader = req.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createSupabaseAdminClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // 2. polar_customer_id 조회 — migration 0086 미적용 시 컬럼 없음 에러
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("polar_customer_id")
    .eq("id", user.id)
    .single()

  if (profileError) {
    console.warn("[polar/customer-portal] polar_customer_id 조회 실패 (migration 0086 미적용?):", profileError.message, { userId: user.id })
    return NextResponse.json({ error: "POLAR_ID_UNAVAILABLE" }, { status: 404 })
  }

  const customerId = (profile as { polar_customer_id?: string | null } | null)?.polar_customer_id
  if (!customerId) {
    return NextResponse.json({ error: "POLAR_ID_NOT_SET" }, { status: 404 })
  }

  // 3. Customer Session 생성 → customerPortalUrl 획득
  try {
    const session = await polar.customerSessions.create({ customerId })
    return NextResponse.json({ url: session.customerPortalUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[polar/customer-portal] CustomerSession 생성 실패:", message, { customerId })

    const isScope = message.includes("insufficient_scope") || message.includes("403")
    return NextResponse.json(
      { error: isScope ? "MISSING_SCOPE_CUSTOMER_SESSIONS_WRITE" : "PORTAL_ERROR", detail: message },
      { status: 502 }
    )
  }
}
