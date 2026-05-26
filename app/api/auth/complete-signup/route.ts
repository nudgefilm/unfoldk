import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { sendTrialStartedEmail } from "@/lib/email/send-trial-emails"

// 신규 가입 완료 처리 — /start 페이지에서 약관 동의 후 호출
// body: { plan_type: 'free', agreed_to_terms: true }
//
// 동작:
//   1. 인증된 유저 확인
//   2. 약관 동의 검증 (agreed_to_terms === true)
//   3. plan_type 'free' 만 허용 (화이트리스트)
//   4. public.users 업데이트 — plan_type='free', agreed_to_terms=true, agreed_at=now()
//
// ⚠️ plan_type 'monthly'/'annual' 은 의도적으로 거절.
//    유료 플랜 활성화는 LMS webhook(order_created) 또는 쿠폰(/api/auth/apply-coupon)
//    경로만 정당. 둘 다 subscription_status='active' 도 함께 set 해 RLS 통과 보장.
//    이 API 가 paid plan_type 을 받으면 status 가 미설정인 broken state 가 만들어져
//    캘린더 premium 이벤트 RLS 통과 못 하는 클래스 버그 발생 (2026-05-10 인시던트 회고).

const ALLOWED_PLANS = ["free"] as const
type PlanType = (typeof ALLOWED_PLANS)[number]

interface CompleteSignupBody {
  plan_type?: string
  agreed_to_terms?: boolean
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()

  // 1. 인증 검증
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  // 2. body 파싱
  let body: CompleteSignupBody
  try {
    body = (await request.json()) as CompleteSignupBody
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  // 3. 약관 동의 검증
  if (body.agreed_to_terms !== true) {
    return NextResponse.json({ error: "terms_not_agreed" }, { status: 400 })
  }

  // 4. plan_type 화이트리스트
  const planType = body.plan_type as PlanType
  if (!ALLOWED_PLANS.includes(planType)) {
    return NextResponse.json({ error: "invalid_plan_type" }, { status: 400 })
  }

  // 5. 국가 추출 — Vercel x-vercel-ip-country (ISO 3166-1 alpha-2, 대문자).
  //    로컬·미지정·헤더 없음 → null. 추후 변경 안 함 (가입 시 1회만).
  const rawCountry = request.headers.get("x-vercel-ip-country")
  const country =
    rawCountry && /^[A-Z]{2}$/.test(rawCountry.toUpperCase())
      ? rawCountry.toUpperCase()
      : null

  // 6. trial 중복 방지 — admin 클라이언트로 RLS 우회해 조회
  //    · trial_started_email_sent=true : 이미 trial 수령 이력 있음
  //    · trial_ends_at 이미 설정 : 이전 complete-signup 에서 부여됨
  //    · trial_used_emails 테이블 : 탈퇴 후 동일 이메일 재가입 차단
  const admin = createSupabaseAdminClient()

  const { data: existingUser } = await admin
    .from("users")
    .select("trial_started_email_sent, trial_ends_at")
    .eq("id", user.id)
    .single()

  let emailUsedTrial = false
  if (user.email) {
    const { data: usedEmail } = await admin
      .from("trial_used_emails")
      .select("email")
      .eq("email", user.email)
      .maybeSingle()
    emailUsedTrial = !!usedEmail
  }

  // 세 조건 중 하나라도 걸리면 trial 미부여
  const grantTrial =
    !existingUser?.trial_started_email_sent &&
    !existingUser?.trial_ends_at &&
    !emailUsedTrial

  const trialEndsAt = grantTrial
    ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    : null

  // 7. users 업데이트 — RLS "users_update_own" 정책으로 본인 행만 수정 가능
  const updatePayload: Record<string, unknown> = {
    plan_type: planType,
    agreed_to_terms: true,
    agreed_at: new Date().toISOString(),
    ...(country !== null ? { country } : {}),
    ...(grantTrial ? { trial_ends_at: trialEndsAt!.toISOString() } : {}),
  }

  const { error: updateError } = await supabase
    .from("users")
    .update(updatePayload)
    .eq("id", user.id)

  if (updateError) {
    console.error("[complete-signup] update 실패:", updateError.message)
    return NextResponse.json({ error: "update_failed" }, { status: 500 })
  }

  // 8. trial 부여 시: 이메일 기반 사용 이력 즉시 기록 (이메일 발송 실패와 무관하게)
  if (grantTrial && user.email) {
    await admin
      .from("trial_used_emails")
      .upsert({ email: user.email, first_trial_at: new Date().toISOString() })
  }

  // 9. "Trial 시작" 이메일 fire-and-forget — 실패해도 가입 완료에 영향 없음
  if (grantTrial && user.email) {
    const email = user.email
    void sendTrialStartedEmail({ to: email, trialEndsAt: trialEndsAt! })
      .then(async (result) => {
        if (result.ok) {
          await admin
            .from("users")
            .update({ trial_started_email_sent: true })
            .eq("id", user.id)
        }
      })
      .catch((err: unknown) => {
        console.error("[complete-signup] trial 이메일 발송 실패:", err)
      })
  }

  return NextResponse.json({ ok: true })
}
