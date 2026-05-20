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
//
// 캐시 정책: force-dynamic + 응답 헤더 no-store.
// 첫 호출에서 번역 실패 또는 진행 중 시점 응답이 브라우저에 캐싱되면
// DB 백필 후에도 클라이언트가 stale 응답을 재사용하는 회귀가 발생.
//
// 임시 진단: 응답에 `debug` 필드 포함 — 번역 실행 여부·에러·write-back 상태.
// 브라우저 Network 탭에서 바로 확인. 동작 안정화 후 제거 예정.

export const dynamic = "force-dynamic"

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" }

interface DebugInfo {
  ingredientsEnRaw: string                  // SELECT 후 row 원본 형태 (typeof + null/array/length)
  instructionsEnRaw: string
  needsContentTranslate: boolean            // ingredients_en/instructions_en 둘 중 하나라도 null 이면 true
  contentTranslateRan: boolean
  contentTranslateError: string | null
  contentTranslateOutputLen: { ing: number; ins: number } | null
  needsTitleTranslate: boolean
  titleTranslateRan: boolean
  titleTranslateError: string | null
  writeBackKeys: string[]
  writeBackError: string | null
  finalIngredientsEnSample: string | null   // 응답 직전 첫 항목 (확정값 확인용)
  finalInstructionsEnSample: string | null
}

function describeRaw(v: unknown): string {
  if (v === null) return "null"
  if (v === undefined) return "undefined"
  if (Array.isArray(v)) return `array(${v.length})`
  return `${typeof v}:${String(v).slice(0, 40)}`
}

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
    return NextResponse.json({ error: "invalid_id" }, { status: 400, headers: NO_STORE_HEADERS })
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
    // 0035 마이그레이션 미적용이면 PostgREST 가 'column "ingredients_en" does not exist' 류 메시지 반환.
    const msg = error.message.toLowerCase()
    const isColumnMissing =
      msg.includes("column") &&
      (msg.includes("ingredients_en") || msg.includes("instructions_en"))
    console.error("[food/recipes/[id]] SELECT 실패", {
      id: parsed.data.id,
      message: error.message,
      isColumnMissing,
    })
    return NextResponse.json(
      {
        error: error.message,
        hint: isColumnMissing ? "migration_0035_not_applied" : null,
      },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE_HEADERS })
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

  const debug: DebugInfo = {
    ingredientsEnRaw: describeRaw(row.ingredients_en),
    instructionsEnRaw: describeRaw(row.instructions_en),
    needsContentTranslate: ingredients_en === null || instructions_en === null,
    contentTranslateRan: false,
    contentTranslateError: null,
    contentTranslateOutputLen: null,
    needsTitleTranslate: !title_en,
    titleTranslateRan: false,
    titleTranslateError: null,
    writeBackKeys: [],
    writeBackError: null,
    finalIngredientsEnSample: null,
    finalInstructionsEnSample: null,
  }

  console.log("[food/recipes/[id]] GET 진입", {
    id: row.id,
    title: row.title,
    ingredientsEnRaw: debug.ingredientsEnRaw,
    instructionsEnRaw: debug.instructionsEnRaw,
    needsTitleTranslate: debug.needsTitleTranslate,
    needsContentTranslate: debug.needsContentTranslate,
    ingredientCount: ingredients.length,
    instructionCount: instructions.length,
  })

  // ─── lazy 번역 단계 ──────────────────────────────────────────
  // (1) title/description, (2) ingredients/instructions — 각각 누락 시 병렬 호출.
  const admin = createSupabaseAdminClient()
  const updatePayload: Record<string, unknown> = {}

  const tasks: Promise<unknown>[] = []

  if (!title_en) {
    tasks.push(
      (async () => {
        debug.titleTranslateRan = true
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
          const msg = err instanceof Error ? err.message : String(err)
          debug.titleTranslateError = msg
          console.error("[food/recipes/[id]] title translate 실패:", msg)
        }
      })()
    )
  }

  if (ingredients_en === null || instructions_en === null) {
    tasks.push(
      (async () => {
        debug.contentTranslateRan = true
        try {
          console.log("[food/recipes/[id]] content translate 시작", {
            id: row.id,
            ingredientCount: ingredients.length,
            instructionCount: instructions.length,
          })
          const result = await translateRecipeContent({
            ingredients_ko: ingredients.map((i) => i.name),
            instructions_ko: instructions.map((s) => s.instruction),
          })
          ingredients_en = result.ingredients_en
          instructions_en = result.instructions_en
          updatePayload.ingredients_en = ingredients_en
          updatePayload.instructions_en = instructions_en
          debug.contentTranslateOutputLen = {
            ing: result.ingredients_en.length,
            ins: result.instructions_en.length,
          }
          console.log("[food/recipes/[id]] content translate 성공", {
            id: row.id,
            ...debug.contentTranslateOutputLen,
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          debug.contentTranslateError = msg
          console.error("[food/recipes/[id]] content translate 실패:", msg)
        }
      })()
    )
  }

  if (tasks.length > 0) {
    await Promise.all(tasks)
    if (Object.keys(updatePayload).length > 0) {
      debug.writeBackKeys = Object.keys(updatePayload)
      const { error: upErr } = await admin
        .from("food_recipes")
        .update(updatePayload)
        .eq("id", row.id)
      if (upErr) {
        debug.writeBackError = upErr.message
        console.error("[food/recipes/[id]] cache write back 실패:", upErr.message)
      } else {
        console.log("[food/recipes/[id]] cache write back 성공", {
          id: row.id,
          keys: debug.writeBackKeys,
        })
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

  debug.finalIngredientsEnSample =
    ingredientsWithEn.find((i) => i.name_en)?.name_en ?? null
  debug.finalInstructionsEnSample =
    instructionsWithEn.find((s) => s.instruction_en)?.instruction_en ?? null

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
  // detail 와 debug 를 같은 응답에 합쳐 반환. 클라이언트 (recipe-detail-dialog)
  // 는 debug 필드를 무시하므로 schema 영향 없음.
  return NextResponse.json({ ...detail, debug }, { headers: NO_STORE_HEADERS })
}
