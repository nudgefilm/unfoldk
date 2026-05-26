// Pro 플랜 잠금/해제 판별 유틸 (클라이언트·서버 공용 순수 함수)
//
// 사용 원칙:
//   1) plan_type 직접 비교 금지 — 항상 hasProAccess() 호출.
//      잘못된 예: planType === 'monthly' || planType === 'annual'
//      옳은 예  : hasProAccess({ planType, isAdmin })
//   2) is_admin = true 인 유저는 plan_type 무관하게 Pro 접근권 보장.
//   3) trial_ends_at 이 미래이면 Monthly 플랜과 동일한 Pro 접근권 부여.
//   4) Free / 비로그인 / null + 만료 trial → 잠금.
//
// 잠금/해제가 필요한 모든 곳(서비스 페이지, plan-based limit API, RLS 우회 분기)에서
// 이 모듈만 import 해 일관성 유지.

export type PlanType = "free" | "monthly" | "annual"

interface AccessInput {
  planType?: string | null
  isAdmin?: boolean | null
  trialEndsAt?: string | null
}

// plan_type 만으로 Pro 여부 판별 (admin·trial 무시) — 결제·관리 UI 분기 등 한정
export function isProPlan(planType: string | null | undefined): boolean {
  return planType === "monthly" || planType === "annual"
}

// trial 활성 여부 — trial_ends_at 이 현재 시각보다 미래이면 true
export function isInTrial(trialEndsAt?: string | null): boolean {
  if (!trialEndsAt) return false
  return new Date(trialEndsAt) > new Date()
}

// 남은 trial 일수 (소수점 올림). 만료 또는 없으면 0 이하.
export function trialDaysRemaining(trialEndsAt?: string | null): number {
  if (!trialEndsAt) return 0
  const ms = new Date(trialEndsAt).getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

// 종합 판별 — 어드민·활성 trial 이면 plan_type 무관 Pro
// 일반 서비스 잠금/해제 분기는 모두 이 함수로 통일
export function hasProAccess(input: AccessInput): boolean {
  if (input.isAdmin === true) return true
  if (isInTrial(input.trialEndsAt)) return true
  return isProPlan(input.planType)
}

// DB plan_type 값 → 안전한 union 정규화 (이상 값은 free 로 fallback)
export function normalizePlanType(value: string | null | undefined): PlanType {
  return value === "monthly" || value === "annual" ? value : "free"
}
