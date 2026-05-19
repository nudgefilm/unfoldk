// KfoodKit — food_recipes.title_en + description_en 배치 backfill
//
// 카드·모달이 "한글 (영문)" 병기 노출하려면 title_en 이 미리 채워져 있어야 함.
// 모달 lazy 생성은 첫 클릭만 처리해 카드 그리드 차원에선 한글만 보이는 문제 해소.
//
// cron 한 번 당 cap (MAX_TITLES_PER_RUN) 만큼만 처리 — 누적 backfill 패턴.
// 537 row × $0.00075 = $0.40 / 1회 완전 backfill. 2~3 cron 안에 완료.

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { translateRecipe } from "@/lib/claude/recipe-translate"

const MAX_TITLES_PER_RUN = 30

export interface FoodTitleBackfillResult {
  source: "food-title-backfill"
  pending: number              // 시작 시점 title_en=null row 수
  attempted: number            // 본 run 에서 처리 시도 (cap 이내)
  updated: number              // Claude 성공 + UPDATE 성공 수
  errors: string[]
}

interface NutritionShape {
  type?: unknown
  summary?: unknown
}

interface IngredientShape {
  name?: unknown
}

export async function runFoodTitleBackfill(): Promise<FoodTitleBackfillResult> {
  const result: FoodTitleBackfillResult = {
    source: "food-title-backfill",
    pending: 0,
    attempted: 0,
    updated: 0,
    errors: [],
  }

  const supabase = createSupabaseAdminClient()

  // title_en 비어있는 row — recipe-translate 가 title+description 동시 생성하므로
  // description_en 별도 체크 안 함 (title_en 채워지면 description_en 도 같이 채워짐).
  const { data, error } = await supabase
    .from("food_recipes")
    .select("id, title, nutrition, ingredients")
    .is("title_en", null)
    .limit(MAX_TITLES_PER_RUN)

  if (error) {
    result.errors.push(`pending 조회 실패: ${error.message}`)
    return result
  }

  type Row = {
    id: string
    title: string
    nutrition: unknown
    ingredients: unknown
  }
  const rows = (data ?? []) as Row[]
  result.pending = rows.length
  result.attempted = rows.length

  if (rows.length === 0) return result

  for (const row of rows) {
    const n = (row.nutrition && typeof row.nutrition === "object" ? row.nutrition : {}) as NutritionShape
    const summaryKo = typeof n.summary === "string" ? n.summary : null
    const categoryKo = typeof n.type === "string" ? n.type : null

    const ings = Array.isArray(row.ingredients) ? row.ingredients : []
    const mainNames = ings
      .map((i: unknown) => (i as IngredientShape).name)
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .slice(0, 5)

    try {
      const translated = await translateRecipe({
        title_ko: row.title,
        summary_ko: summaryKo,
        category_ko: categoryKo,
        main_ingredients: mainNames,
      })

      const { error: upErr } = await supabase
        .from("food_recipes")
        .update({
          title_en: translated.title_en,
          description_en: translated.description_en,
        })
        .eq("id", row.id)

      if (upErr) {
        result.errors.push(`update 실패 (${row.id}): ${upErr.message}`)
        continue
      }
      result.updated++
    } catch (err) {
      result.errors.push(
        `translate 실패 (${row.id}): ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  return result
}
