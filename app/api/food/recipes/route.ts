import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// /api/food/recipes — KfoodKit 레시피 카탈로그 목록
//
// 쿼리:
//   page      1~500 (기본 1)
//   pageSize  1~50 (기본 20)
//   category  TY_NM (예: "밥", "국&찌개", "반찬"...) — nutrition.type 으로 필터
//   search    title 또는 title_en LIKE 매칭
//
// 응답: { items[], total, page, pageSize }
//
// 공개 API — Pro 게이팅 없음. Free 5건 cap 등은 UI 측 정책.
//
// 랜덤 노출: Supabase JS 클라이언트가 ORDER BY random() 미지원이므로
// 전체 매칭 레코드를 fetch 후 서버 측 Fisher-Yates shuffle 처리.
// MAX_POOL 상한으로 네트워크 비용 제어.

export const dynamic = "force-dynamic"
export const revalidate = 0

const MAX_POOL = 1000   // 레시피 전체 상한 — 초과 시 이 범위 안에서만 랜덤

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  category: z.string().trim().max(40).optional(),
  search: z.string().trim().max(80).optional(),
})

// Fisher-Yates shuffle — Math.random() 이 매 서버 요청마다 다른 시드로 동작
function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export interface RecipeListItem {
  id: string
  mafra_rcp_seq: string | null
  title: string                              // 한글 원본 (RECIPE_NM_KO)
  title_en: string | null                    // Claude 영문 (lazy)
  image_url: string | null
  ready_in_minutes: number | null
  servings: number | null
  category: string | null                    // nutrition.type (예: "밥")
  level: string | null                       // nutrition.level (보통/쉬움/어려움)
  calorie_kcal: number | null                // nutrition.calorie_kcal
}

interface NutritionShape {
  calorie_kcal?: unknown
  type?: unknown
  level?: unknown
}

function pickNutrition(raw: unknown): { type: string | null; level: string | null; calorie_kcal: number | null } {
  if (!raw || typeof raw !== "object") return { type: null, level: null, calorie_kcal: null }
  const n = raw as NutritionShape
  return {
    type: typeof n.type === "string" ? n.type : null,
    level: typeof n.level === "string" ? n.level : null,
    calorie_kcal: typeof n.calorie_kcal === "number" ? n.calorie_kcal : null,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_query", issues: parsed.error.issues },
      { status: 400 }
    )
  }
  const { page, pageSize, category, search } = parsed.data

  const supabase = await createSupabaseServerClient()
  // 전체 매칭 레코드를 fetch 후 shuffle → 서버 요청마다 다른 순서 보장.
  // Supabase JS 클라이언트가 ORDER BY random() 미지원이므로 JS 단 처리.
  let q = supabase
    .from("food_recipes")
    .select("id, mafra_rcp_seq, title, title_en, image_url, ready_in_minutes, servings, nutrition")
    .limit(MAX_POOL)

  if (search && search.length > 0) {
    // title 또는 title_en LIKE — Korean 검색은 title, 영문 검색은 title_en 매칭
    const pattern = `%${search.replace(/[%_]/g, "")}%`
    q = q.or(`title.ilike.${pattern},title_en.ilike.${pattern}`)
  }
  if (category && category.length > 0) {
    // nutrition.type 필터 — jsonb path 쿼리. PostgREST 가 ->> 와 함께 동작.
    q = q.eq("nutrition->>type", category)
  }

  const { data, error } = await q
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type Row = {
    id: string
    mafra_rcp_seq: string | null
    title: string
    title_en: string | null
    image_url: string | null
    ready_in_minutes: number | null
    servings: number | null
    nutrition: unknown
  }
  const allRows = shuffleArray((data ?? []) as Row[])
  const total = allRows.length
  const offset = (page - 1) * pageSize
  const pageRows = allRows.slice(offset, offset + pageSize)

  const items: RecipeListItem[] = pageRows.map((r) => {
    const n = pickNutrition(r.nutrition)
    return {
      id: r.id,
      mafra_rcp_seq: r.mafra_rcp_seq,
      title: r.title,
      title_en: r.title_en,
      image_url: r.image_url,
      ready_in_minutes: r.ready_in_minutes,
      servings: r.servings,
      category: n.type,
      level: n.level,
      calorie_kcal: n.calorie_kcal,
    }
  })

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
  })
}
