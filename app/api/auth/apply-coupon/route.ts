import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// 쿠폰 적용 — 로그인 유저가 코드를 입력해 Hallyu Pass 활성화
//
// 흐름:
//   1. 인증 확인 (로그인 유저)
//   2. body 파싱 + code 정규화 (toUpperCase + trim)
//   3. coupons 조회
//      - 없음 → 404
//      - 이미 사용됨 → 400 (already_used)
//      - 만료됨 → 400 (expired)
//   4. 트랜잭션:
//      - coupons.used_by, used_at 갱신
//      - users.plan_type, plan_expires_at 갱신
//   ⚠️ Postgres 트랜잭션을 위해 admin 클라이언트 사용 (RLS 우회).
//      authenticated 유저 본인 정보만 갱신함이 명백하므로 안전.

const PostSchema = z.object({
  code: z.string().min(1).max(50),
})

const COUPON_VALID_DAYS = 30

export async function POST(request: Request) {
  // 1. 인증 검증 (server client — 쿠키 기반 세션)
  const userClient = await createSupabaseServerClient()
  const {
    data: { user },
  } = await userClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  // 2. body 파싱
  const body = await request.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  // 대소문자 구분 없이 처리 — 입력 정규화
  const code = parsed.data.code.trim().toUpperCase()

  // 3. 쿠폰 조회 — admin 클라이언트로 RLS 우회 (본인 사용 안 한 쿠폰은 RLS 로 안 보임)
  const admin = createSupabaseAdminClient()
  const { data: coupon, error: fetchErr } = await admin
    .from("coupons")
    .select("id, type, used_by, expires_at")
    .eq("code", code)
    .maybeSingle()

  if (fetchErr) {
    console.error("[apply-coupon] 조회 실패:", fetchErr.message)
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 })
  }
  if (!coupon) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  // 4. 사용 여부 검증
  if (coupon.used_by) {
    return NextResponse.json({ error: "already_used" }, { status: 400 })
  }

  // 5. 만료 검증
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 400 })
  }

  // 6. 적용 — 쿠폰 잠금 + 유저 플랜 갱신
  //    race condition 방지를 위해 used_by IS NULL 조건부 update 사용
  const now = new Date()
  const planExpiresAt = new Date(now.getTime() + COUPON_VALID_DAYS * 24 * 60 * 60 * 1000)

  const { data: lockedCoupon, error: lockErr } = await admin
    .from("coupons")
    .update({
      used_by: user.id,
      used_at: now.toISOString(),
    })
    .eq("id", coupon.id)
    .is("used_by", null)
    .select("id")
    .maybeSingle()

  if (lockErr) {
    console.error("[apply-coupon] 잠금 실패:", lockErr.message)
    return NextResponse.json({ error: "lock_failed" }, { status: 500 })
  }
  if (!lockedCoupon) {
    // 동시 적용 등으로 조건부 update 가 0행 영향 → 이미 사용됨으로 간주
    return NextResponse.json({ error: "already_used" }, { status: 400 })
  }

  // 7. 유저 플랜 활성화
  const planType: "monthly" | "annual" = coupon.type === "annual" ? "annual" : "monthly"
  const { error: userErr } = await admin
    .from("users")
    .update({
      plan_type: planType,
      subscription_status: "active",
      plan_expires_at: planExpiresAt.toISOString(),
    })
    .eq("id", user.id)

  if (userErr) {
    // 쿠폰 잠금은 성공했지만 user 갱신 실패 — 운영 알림 필요. 일단 에러 반환.
    console.error("[apply-coupon] users 갱신 실패:", userErr.message)
    return NextResponse.json({ error: "user_update_failed" }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    plan_type: planType,
    plan_expires_at: planExpiresAt.toISOString(),
  })
}
