import { Polar } from "@polar-sh/sdk"
import { POLAR_PRODUCT_IDS, type PolarPlan } from "@/lib/polar/constants"

// Polar SDK 인스턴스 — 서버 전용
const polar = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN! })

// 결제 완료 후 복귀 URL — {CHECKOUT_ID} 는 Polar 가 실제 checkout ID 로 치환
const SUCCESS_URL = "https://www.unfoldk.com/mypage/subscription?checkout_id={CHECKOUT_ID}"

// GET /api/polar/checkout?plan=monthly|annual&email=...&userId=...
// → Polar 호스팅 체크아웃 페이지로 리다이렉트
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const plan = searchParams.get("plan") as PolarPlan | null
  const customerEmail = searchParams.get("email") ?? undefined
  const userId = searchParams.get("userId") ?? undefined

  if (!plan || !POLAR_PRODUCT_IDS[plan]) {
    return new Response("Missing or invalid plan parameter (expected: monthly | annual)", { status: 400 })
  }

  const productId = POLAR_PRODUCT_IDS[plan]

  try {
    const checkout = await polar.checkouts.create({
      products: [productId],
      successUrl: SUCCESS_URL,
      customerEmail,
      // metadata.userId — 웹훅에서 유저 식별에 사용
      metadata: userId ? { userId } : undefined,
    })

    return Response.redirect(checkout.url, 302)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[polar/checkout] checkout 세션 생성 실패:", message, { plan, productId })
    return new Response("Checkout session creation failed", { status: 500 })
  }
}
