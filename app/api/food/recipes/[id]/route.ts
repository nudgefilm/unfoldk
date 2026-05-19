import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { translateRecipe } from "@/lib/claude/recipe-translate"

// /api/food/recipes/[id] — 레시피 상세
//
// 응답에 재료(jsonb) + 과정(jsonb) 포함. title_en/description_en 없으면 Claude Haiku 로
// lazy 생성 후 DB 캐싱. 다음 요청부터 즉시 응답.
//
// 공개 API — Pro 게이팅 없음.

export const dynamic = "force-dynamic"

const ParamsSchema = z.object({
  id: z.string().uuid("id must be uuid"),
})

interface NutritionShape {
  calorie_kcal?: unknown
  calorie_text?: unknown
  nation?: unknown
  type?: unknown
  level?: unknown
  qnt_text?: unknown
  cooking_time_text?: unknown
  summary?: unknown
  price_text?: unknown
  main_ingredient_type?: unknown
}

export interface RecipeDetail {
  id: string
  mafra_rcp_seq: string | null
  title: string
  title_en: string | null
  description_en: string | null
  image_url: string | null
  ready_in_minutes: number | null
  servings: number | null
  nutrition: NutritionShape | null
  ingredients: Array<{ name: string; capacity: string | null; type: string | null }>
  instructions: Array<{ step: number; instruction: string; tip: string | null }>
}

interface IngredientPayload {
  name?: unknown
  capacity?: unknown
  type?: unknown
}

interface InstructionPayload {
  step?: unknown
  instruction?: unknown
  tip?: unknown
}

function normalizeIngredients(raw: unknown): RecipeDetail["ingredients"] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((i: unknown) => {
      const o = i as IngredientPayload
      return {
        name: typeof o.name === "string" ? o.name : "",
        capacity: typeof o.capacity === "string" ? o.capacity : null,
        type: typeof o.type === "string" ? o.type : null,
      }
    })
    .filter((i) => i.name.length > 0)
}

function normalizeInstructions(raw: unknown): RecipeDetail["instructions"] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((s: unknown) => {
      const o = s as InstructionPayload
      return {
        step: typeof o.step === "number" ? o.step : 0,
        instruction: typeof o.instruction === "string" ? o.instruction : "",
        tip: typeof o.tip === "string" && o.tip.trim().length > 0 ? o.tip : null,
      }
    })
    .filter((s) => s.instruction.length > 0)
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const parsed = ParamsSchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("food_recipes")
    .select(
      "id, mafra_rcp_seq, title, title_en, description_en, image_url, ready_in_minutes, servings, nutrition, ingredients, instructions"
    )
    .eq("id", parsed.data.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  type Row = {
    id: string
    mafra_rcp_seq: string | null
    title: string
    title_en: string | null
    description_en: string | null
    image_url: string | null
    ready_in_minutes: number | null
    servings: number | null
    nutrition: NutritionShape | null
    ingredients: unknown
    instructions: unknown
  }
  const row = data as Row

  let title_en = row.title_en
  let description_en = row.description_en

  // title_en 비어있으면 Claude Haiku lazy 생성 — admin client 로 write back.
  // 실패해도 응답은 한글 원본으로 진행 (UX 회귀 방지).
  if (!title_en) {
    try {
      const ings = normalizeIngredients(row.ingredients)
      const summaryKo =
        typeof row.nutrition?.summary === "string" ? row.nutrition.summary : null
      const categoryKo =
        typeof row.nutrition?.type === "string" ? row.nutrition.type : null
      const result = await translateRecipe({
        title_ko: row.title,
        summary_ko: summaryKo,
        category_ko: categoryKo,
        main_ingredients: ings.slice(0, 5).map((i) => i.name),
      })
      title_en = result.title_en
      description_en = result.description_en

      // write back — admin client 로 RLS 우회. 실패해도 응답엔 영향 없음.
      const admin = createSupabaseAdminClient()
      await admin
        .from("food_recipes")
        .update({ title_en, description_en })
        .eq("id", row.id)
    } catch (err) {
      console.warn(
        "[food/recipes/[id]] translate 실패 — 한글 원본만 반환:",
        err instanceof Error ? err.message : String(err)
      )
    }
  }

  const detail: RecipeDetail = {
    id: row.id,
    mafra_rcp_seq: row.mafra_rcp_seq,
    title: row.title,
    title_en,
    description_en,
    image_url: row.image_url,
    ready_in_minutes: row.ready_in_minutes,
    servings: row.servings,
    nutrition: row.nutrition,
    ingredients: normalizeIngredients(row.ingredients),
    instructions: normalizeInstructions(row.instructions),
  }
  return NextResponse.json(detail)
}
