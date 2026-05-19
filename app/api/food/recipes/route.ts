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

export const dynamic = "force-dynamic"

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  category: z.string().trim().max(40).optional(),
  search: z.string().trim().max(80).optional(),
})

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
  const offset = (page - 1) * pageSize

  const supabase = await createSupabaseServerClient()
  let q = supabase
    .from("food_recipes")
    .select(
      "id, mafra_rcp_seq, title, title_en, image_url, ready_in_minutes, servings, nutrition",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (search && search.length > 0) {
    // title 또는 title_en LIKE — Korean 검색은 title, 영문 검색은 title_en 매칭
    const pattern = `%${search.replace(/[%_]/g, "")}%`
    q = q.or(`title.ilike.${pattern},title_en.ilike.${pattern}`)
  }
  if (category && category.length > 0) {
    // nutrition.type 필터 — jsonb path 쿼리. PostgREST 가 ->> 와 함께 동작.
    q = q.eq("nutrition->>type", category)
  }

  const { data, error, count } = await q
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
  const rows = (data ?? []) as Row[]
  const items: RecipeListItem[] = rows.map((r) => {
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
    total: count ?? items.length,
    page,
    pageSize,
  })
}
