export const PADDLE_PRICE_IDS = {
  hallyu_pass_monthly:    'pri_01ktebkanjcsepdyyxvwytrf8d',
  hallyu_pass_annual:     'pri_01ktebj6hyamex3akb7f5v103d',
  sourcing_sniper_monthly:'pri_01ktebgv96rjxqr68r71k907xh',
  sourcing_sniper_onetime:'pri_01kteb4mv2rykv41w4z9eww0fg',
} as const

export const PADDLE_ENV = (
  process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT ?? 'sandbox'
) as 'sandbox' | 'production'

export const HALLYU_PASS_PRICE_IDS = new Set([
  PADDLE_PRICE_IDS.hallyu_pass_monthly,
  PADDLE_PRICE_IDS.hallyu_pass_annual,
])

export const SOURCING_SNIPER_PRICE_IDS = new Set([
  PADDLE_PRICE_IDS.sourcing_sniper_monthly,
  PADDLE_PRICE_IDS.sourcing_sniper_onetime,
])
