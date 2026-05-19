import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { translateRecipe } from "@/lib/claude/recipe-translate"
import { translateRecipeContent } from "@/lib/claude/recipe-content-translate"

// /api/food/recipes/[id] — 레시피 상세
//
// 응답에 재료(jsonb) + 과정(jsonb) 포함. lazy 번역:
//   - title_en / description_en  → Claude Haiku translateRecipe
//   - ingredients_en[]            → translateRecipeContent (재료 영문명, 같은 인덱스)
//   - instructions_en[]           → translateRecipeContent (단계 영문 텍스트, 같은 인덱스)
// 없으면 첫 GET 에서 생성·DB 캐싱. 다음 요청부터 즉시 응답.
//
// 두 번역 호출은 parallel — 첫 응답 ~1-2s 추가 (캐싱 후 0ms).
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
  image_source: "mfds" | "unsplash" | null
  ready_in_minutes: number | null
  servings: number | null
  nutrition: NutritionShape | null
  // 재료·조리법 한글 원본 + 같은 인덱스의 영문 (있으면).
  ingredients: Array<{
    name: string
    name_en: string | null
    capacity: string | null
    type: string | null
  }>
  instructions: Array<{
    step: number
    instruction: string
    instruction_en: string | null
    tip: string | null
  }>
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

interface IngredientCore {
  name: string
  capacity: string | null
  type: string | null
}

interface InstructionCore {
  step: number
  instruction: string
  tip: string | null
}

function normalizeIngredients(raw: unknown): IngredientCore[] {
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

function normalizeInstructions(raw: unknown): InstructionCore[] {
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

// 영문 배열 (저장된 jsonb) 정규화 — string[] 가정. 길이는 호출자가 매칭.
function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((v) => (typeof v === "string" ? v : ""))
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
      "id, mafra_rcp_seq, title, title_en, description_en, image_url, image_source, ready_in_minutes, servings, nutrition, ingredients, ingredients_en, instructions, instructions_en"
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
    image_source: "mfds" | "unsplash" | null
    ready_in_minutes: number | null
    servings: number | null
    nutrition: NutritionShape | null
    ingredients: unknown
    ingredients_en: unknown
    instructions: unknown
    instructions_en: unknown
  }
  const row = data as Row

  const ingredients = normalizeIngredients(row.ingredients)
  const instructions = normalizeInstructions(row.instructions)

  let title_en = row.title_en
  let description_en = row.description_en
  let ingredients_en = row.ingredients_en === null ? null : normalizeStringArray(row.ingredients_en)
  let instructions_en = row.instructions_en === null ? null : normalizeStringArray(row.instructions_en)

  // ─── lazy 번역 단계 ──────────────────────────────────────────
  // (1) title/description, (2) ingredients/instructions — 각각 누락 시 병렬 호출.
  const admin = createSupabaseAdminClient()
  const updatePayload: Record<string, unknown> = {}

  const tasks: Promise<unknown>[] = []

  if (!title_en) {
    tasks.push(
      (async () => {
        try {
          const summaryKo =
            typeof row.nutrition?.summary === "string" ? row.nutrition.summary : null
          const categoryKo =
            typeof row.nutrition?.type === "string" ? row.nutrition.type : null
          const result = await translateRecipe({
            title_ko: row.title,
            summary_ko: summaryKo,
            category_ko: categoryKo,
            main_ingredients: ingredients.slice(0, 5).map((i) => i.name),
          })
          title_en = result.title_en
          description_en = result.description_en
          updatePayload.title_en = title_en
          updatePayload.description_en = description_en
        } catch (err) {
          console.warn(
            "[food/recipes/[id]] title translate 실패:",
            err instanceof Error ? err.message : String(err)
          )
        }
      })()
    )
  }

  if (ingredients_en === null || instructions_en === null) {
    tasks.push(
      (async () => {
        try {
          const result = await translateRecipeContent({
            ingredients_ko: ingredients.map((i) => i.name),
            instructions_ko: instructions.map((s) => s.instruction),
          })
          ingredients_en = result.ingredients_en
          instructions_en = result.instructions_en
          updatePayload.ingredients_en = ingredients_en
          updatePayload.instructions_en = instructions_en
        } catch (err) {
          console.warn(
            "[food/recipes/[id]] content translate 실패:",
            err instanceof Error ? err.message : String(err)
          )
        }
      })()
    )
  }

  if (tasks.length > 0) {
    await Promise.all(tasks)
    if (Object.keys(updatePayload).length > 0) {
      const { error: upErr } = await admin
        .from("food_recipes")
        .update(updatePayload)
        .eq("id", row.id)
      if (upErr) {
        console.warn("[food/recipes/[id]] cache write back 실패:", upErr.message)
      }
    }
  }

  // ─── 응답 조립 — 영문 배열을 한글 배열과 인덱스 매칭 ────────
  const ingredientsWithEn: RecipeDetail["ingredients"] = ingredients.map((i, idx) => ({
    name: i.name,
    name_en: ingredients_en?.[idx]?.trim() || null,
    capacity: i.capacity,
    type: i.type,
  }))
  const instructionsWithEn: RecipeDetail["instructions"] = instructions.map((s, idx) => ({
    step: s.step,
    instruction: s.instruction,
    instruction_en: instructions_en?.[idx]?.trim() || null,
    tip: s.tip,
  }))

  const detail: RecipeDetail = {
    id: row.id,
    mafra_rcp_seq: row.mafra_rcp_seq,
    title: row.title,
    title_en,
    description_en,
    image_url: row.image_url,
    image_source: row.image_source,
    ready_in_minutes: row.ready_in_minutes,
    servings: row.servings,
    nutrition: row.nutrition,
    ingredients: ingredientsWithEn,
    instructions: instructionsWithEn,
  }
  return NextResponse.json(detail)
}
