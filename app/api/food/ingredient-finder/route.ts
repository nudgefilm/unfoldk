import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { hasProAccess } from "@/lib/auth/plan"
import {
  findDishIngredients,
  IngredientFinderError,
  SUPPORTED_COUNTRIES,
  type CountryCode,
} from "@/lib/claude/ingredient-finder"

export const dynamic = "force-dynamic"
export const maxDuration = 30

// /api/food/ingredient-finder — Pro 전용 AI Dish-to-Ingredients Finder
//
// body: { dish: string, country: ISO 2-letter code }
// 흐름:
//   1. 로그인 + Pro 가드 (admin 포함)
//   2. zod 검증 (country enum, dish 1~80자)
//   3. Claude Haiku 호출 → 음식 핵심 재료 5~10개 + 현지 대체품/구매처/난이도
//
// 인증 정책: 결제 연동 전 임시 Free 확대 정책 (CLAUDE.md §6) 에서 AI 기능은
// Pro 유지로 명시됨. 본 라우트도 Pro 유지 — 결제 가동 후 동일하게 유지.

const BodySchema = z.object({
  dish: z.string().trim().min(1, "dish 필수").max(80),
  country: z.enum(SUPPORTED_COUNTRIES),
})

export async function POST(request: Request) {
  // 1. 인증·플랜 가드
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("plan_type, is_admin")
    .eq("id", user.id)
    .maybeSingle()
  const row = profile as { plan_type?: string; is_admin?: boolean } | null
  if (!hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin })) {
    return NextResponse.json({ error: "pro_required" }, { status: 403 })
  }

  // 2. body 파싱·검증
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 }
    )
  }

  // 3. Claude 호출
  try {
    const result = await findDishIngredients({
      dish: parsed.data.dish,
      country: parsed.data.country as CountryCode,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    if (err instanceof IngredientFinderError) {
      console.error("[food/ingredient-finder] 처리 실패:", err.message)
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    const msg = err instanceof Error ? err.message : "unknown"
    console.error("[food/ingredient-finder] 예외:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
