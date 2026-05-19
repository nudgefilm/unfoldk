// KfoodKit (M+4) — Spoonacular 한식 레시피 인제스트
//
// 수집 전략:
//   1) searchKoreanRecipes(offset, 50) 호출 — 한 번에 최대 50건 페치
//   2) 이미 food_recipes 에 있는 spoonacular_id 는 skip (불필요 update 회피)
//   3) 신규 항목만 SpoonacularRecipe → food_recipes row 매핑 후 upsert
//
// 쿼터·시간 가드레일:
//   - MAX_RECIPES_PER_RUN=50 — Spoonacular Cooking plan 일 150 points 기준 safe
//     (complexSearch addRecipeInformation=true 는 numResults 만큼 points 소비)
//   - weekly cron 으로만 호출 (vercel.json: 0 6 * * 1, 월 06:00 UTC)
//   - 응답 캐싱은 spoonacular.ts 의 24h revalidate 가 처리

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  searchKoreanRecipes,
  type SpoonacularRecipe,
} from "@/lib/api/spoonacular"

const MAX_RECIPES_PER_RUN = 50

export interface FoodRecipesIngestResult {
  source: "food-recipes"
  fetched: number       // Spoonacular 응답 항목 수
  upserted: number      // 실제 신규 insert 된 row 수 (이미 존재하는 spoonacular_id 는 제외)
  skipped: number       // 이미 존재해 skip 된 항목 수
  errors: string[]
}

// SpoonacularRecipe → food_recipes row 변환.
// ingredients / instructions / nutrition 은 jsonb 컬럼이라 원본 구조를 압축 보존.
interface UpsertRow {
  spoonacular_id: number
  title: string
  image_url: string | null
  ingredients: unknown   // jsonb — [{ name, amount, unit, original }]
  instructions: unknown  // jsonb — [{ step, instruction }]
  nutrition: unknown     // jsonb — Spoonacular nutrition.nutrients 그대로
  ready_in_minutes: number | null
  servings: number | null
  source_url: string | null
}

function toUpsertRow(recipe: SpoonacularRecipe): UpsertRow | null {
  if (!recipe.id || !recipe.title?.trim()) return null

  const ingredients =
    recipe.extendedIngredients?.map((ing) => ({
      name: ing.name,
      amount: ing.amount ?? null,
      unit: ing.unit ?? null,
      original: ing.original ?? null,
    })) ?? []

  // Spoonacular 는 instructions 를 grouped (analyzedInstructions[].steps) 로 반환.
  // 단일 그룹 가정으로 flatten — 다중 그룹 (예: "Marinade" + "Cook") 은 첫 그룹만 사용.
  const instructions =
    recipe.analyzedInstructions?.[0]?.steps?.map((s) => ({
      step: s.number,
      instruction: s.step,
    })) ?? []

  const nutrition = recipe.nutrition?.nutrients ?? null

  return {
    spoonacular_id: recipe.id,
    title: recipe.title.trim(),
    image_url: recipe.image?.trim() || null,
    ingredients,
    instructions,
    nutrition,
    ready_in_minutes: recipe.readyInMinutes ?? null,
    servings: recipe.servings ?? null,
    source_url: recipe.sourceUrl?.trim() || null,
  }
}

export async function runFoodRecipesIngest(): Promise<FoodRecipesIngestResult> {
  const result: FoodRecipesIngestResult = {
    source: "food-recipes",
    fetched: 0,
    upserted: 0,
    skipped: 0,
    errors: [],
  }

  // 1) Spoonacular 한식 레시피 페치 (한 번에 cap 만큼)
  let recipes: SpoonacularRecipe[] = []
  try {
    const res = await searchKoreanRecipes({ number: MAX_RECIPES_PER_RUN })
    recipes = res.results
    result.fetched = recipes.length
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.errors.push(`Spoonacular 검색 실패: ${msg}`)
    return result
  }

  if (recipes.length === 0) return result

  const supabase = createSupabaseAdminClient()

  // 2) 이미 존재하는 spoonacular_id 조회 — skip 처리용
  const ids = recipes.map((r) => r.id)
  const { data: existingRows, error: exErr } = await supabase
    .from("food_recipes")
    .select("spoonacular_id")
    .in("spoonacular_id", ids)

  if (exErr) {
    result.errors.push(`existing 조회 실패: ${exErr.message}`)
    // 계속 진행 — upsert onConflict 가 받아주지만, skip 카운트는 부정확해짐
  }

  const existingSet = new Set<number>(
    (existingRows ?? [])
      .map((r) => (r as { spoonacular_id: number }).spoonacular_id)
      .filter((id): id is number => typeof id === "number")
  )

  // 3) 신규만 매핑
  const rows: UpsertRow[] = []
  for (const recipe of recipes) {
    if (existingSet.has(recipe.id)) {
      result.skipped++
      continue
    }
    const row = toUpsertRow(recipe)
    if (!row) continue
    rows.push(row)
  }

  if (rows.length === 0) return result

  // 4) upsert — spoonacular_id 충돌키 (race 안전)
  const { error: upErr, count } = await supabase
    .from("food_recipes")
    .upsert(rows, { onConflict: "spoonacular_id", count: "exact" })

  if (upErr) {
    result.errors.push(`upsert 실패: ${upErr.message}`)
    return result
  }

  result.upserted = count ?? rows.length
  return result
}
