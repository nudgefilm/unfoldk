// Polar 상품 ID — 서버 전용 (NEXT_PUBLIC_ 불필요, 클라이언트에 노출 금지)
export const POLAR_PRODUCT_IDS = {
  monthly: process.env.POLAR_PRODUCT_ID_MONTHLY ?? "",
  annual: process.env.POLAR_PRODUCT_ID_ANNUAL ?? "",
} as const

export type PolarPlan = keyof typeof POLAR_PRODUCT_IDS

// 웹훅에서 Hallyu Pass 상품 여부 판별용 Set
export const HALLYU_PASS_PRODUCT_ID_SET = new Set<string>(
  Object.values(POLAR_PRODUCT_IDS).filter(Boolean)
)
