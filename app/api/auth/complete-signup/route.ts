import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// 신규 가입 완료 처리 — /start 페이지에서 약관 동의 + 플랜 선택 후 호출
// body: { plan_type: 'free' | 'monthly' | 'annual', agreed_to_terms: true }
//
// 동작:
//   1. 인증된 유저 확인
//   2. 약관 동의 검증 (agreed_to_terms === true)
//   3. plan_type 화이트리스트 검증
//   4. public.users 업데이트 — plan_type, agreed_to_terms=true, agreed_at=now()
//
// ⚠️ 결제 연동 전 단계 — paid 플랜 선택 시에도 일단 plan_type 만 기록하고
//    실제 Stripe 결제는 별도 후속 단계에서 처리.

const ALLOWED_PLANS = ["free", "monthly", "annual"] as const
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

  // 5. users 업데이트 — RLS "users_update_own" 정책으로 본인 행만 수정 가능
  const { error: updateError } = await supabase
    .from("users")
    .update({
      plan_type: planType,
      agreed_to_terms: true,
      agreed_at: new Date().toISOString(),
    })
    .eq("id", user.id)

  if (updateError) {
    console.error("[complete-signup] update 실패:", updateError.message)
    return NextResponse.json({ error: "update_failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
