// KfoodKit (M+4) — 농림수산식품교육문화정보원 한식 레시피 인제스트
//
// 데이터 소스: 농림부 별도 호스트 (211.237.50.150:7080) 의 3 grid:
//   - 226 기본정보 (총 537 레시피, 거의 영구 고정)
//   - 227 재료정보 (총 6,104 행 — RECIPE_ID 로 join)
//   - 228 과정정보 (총 3,022 행 — RECIPE_ID 로 join)
//
// 전략 (cap 없음 — 데이터셋이 소규모 고정이라 매번 전체 처리):
//   1) 기본정보 전체 fetch (537건, 1 페이지로 충분하지만 fetchAll 로 안전 처리)
//   2) 신규 RECIPE_ID 만 식별 (이미 DB 에 있는 mafra_rcp_seq 는 skip)
//   3) 신규가 있으면 재료·과정 전체 fetch (각 7/4 페이지)
//   4) RECIPE_ID 별 메모리 join 후 food_recipes upsert
//
// cron: 월 1회 (vercel.json "0 6 1 * *"). 데이터가 거의 변하지 않아 주간 → 월간 회귀.
// 영문 변환은 별도 enrichment 단계 (Claude Haiku) 사후 처리.

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  getAllRecipeBasics,
  getAllRecipeIngredients,
  getAllRecipeProcess,
  type MafraRecipeBasic,
  type MafraRecipeIngredient,
  type MafraRecipeStep,
} from "@/lib/api/mafra-recipe"

export interface FoodRecipesIngestResult {
  source: "food-recipes"
  fetched: number       // 기본정보 응답 항목 수
  upserted: number      // 신규 insert 된 row 수
  skipped: number       // 이미 존재해 skip 된 항목 수
  errors: string[]
}

interface UpsertRow {
  mafra_rcp_seq: string
  title: string
  image_url: string | null
  ingredients: unknown   // jsonb — [{ name, capacity, type, sn }]
  instructions: unknown  // jsonb — [{ step, instruction, tip }]
  nutrition: unknown     // jsonb — { calorie, calorie_kcal, nation, type, level, qnt, servings, cooking_time_text, summary, price, main_ingredient_type }
  ready_in_minutes: number | null
  servings: number | null
  source_url: string | null
}

// "60분" → 60
function parseMinutes(s: string | undefined): number | null {
  if (!s) return null
  const m = s.match(/(\d+)/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

// "580Kcal" → 580
function parseCalorie(s: string | undefined): number | null {
  if (!s) return null
  const m = s.match(/(\d+(?:\.\d+)?)/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

// "4인분" → 4
function parseServings(s: string | undefined): number | null {
  if (!s) return null
  const m = s.match(/(\d+)/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

function toUpsertRow(
  basic: MafraRecipeBasic,
  ingredients: MafraRecipeIngredient[],
  steps: MafraRecipeStep[]
): UpsertRow | null {
  if (basic.RECIPE_ID == null || !basic.RECIPE_NM_KO?.trim()) return null

  // 재료: IRDNT_SN 정렬 후 최소 필드만 보존
  const ingredientPayload = ingredients
    .slice()
    .sort((a, b) => (a.IRDNT_SN ?? 0) - (b.IRDNT_SN ?? 0))
    .map((i) => ({
      sn: i.IRDNT_SN ?? null,
      name: i.IRDNT_NM?.trim() ?? "",
      capacity: i.IRDNT_CPCTY?.trim() ?? null,
      type: i.IRDNT_TY_NM?.trim() ?? null,
    }))
    .filter((i) => i.name.length > 0)

  // 과정: COOKING_NO 정렬
  const stepsPayload = steps
    .slice()
    .sort((a, b) => (a.COOKING_NO ?? 0) - (b.COOKING_NO ?? 0))
    .map((s) => ({
      step: s.COOKING_NO ?? 0,
      instruction: s.COOKING_DC?.trim() ?? "",
      tip: s.STEP_TIP?.trim() || null,
    }))
    .filter((s) => s.instruction.length > 0)

  const nutrition = {
    calorie_kcal: parseCalorie(basic.CALORIE),
    calorie_text: basic.CALORIE?.trim() || null,
    nation: basic.NATION_NM?.trim() || null,
    type: basic.TY_NM?.trim() || null,
    level: basic.LEVEL_NM?.trim() || null,
    qnt_text: basic.QNT?.trim() || null,
    cooking_time_text: basic.COOKING_TIME?.trim() || null,
    summary: basic.SUMRY?.trim() || null,
    price_text: basic.PC_NM?.trim() || null,
    main_ingredient_type: basic.IRDNT_CODE?.trim() || null,
  }

  return {
    mafra_rcp_seq: String(basic.RECIPE_ID),
    title: basic.RECIPE_NM_KO.trim(),
    image_url: null,                                   // grid 226 에 이미지 필드 없음
    ingredients: ingredientPayload,
    instructions: stepsPayload,
    nutrition,
    ready_in_minutes: parseMinutes(basic.COOKING_TIME),
    servings: parseServings(basic.QNT),
    source_url: null,
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

  // 1) 기본정보 전체 fetch (총 537건, 1 페이지로 끝나지만 fetchAll 로 안전)
  let basics: MafraRecipeBasic[] = []
  try {
    basics = await getAllRecipeBasics()
    result.fetched = basics.length
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.errors.push(`MAFRA 기본정보 페치 실패: ${msg}`)
    return result
  }

  if (basics.length === 0) return result

  const supabase = createSupabaseAdminClient()

  // 2) 기존 RECIPE_ID 조회 — skip 처리용
  const seqs = basics
    .map((b) => (b.RECIPE_ID != null ? String(b.RECIPE_ID) : null))
    .filter((s): s is string => !!s)
  const { data: existingRows, error: exErr } = await supabase
    .from("food_recipes")
    .select("mafra_rcp_seq")
    .in("mafra_rcp_seq", seqs)

  if (exErr) {
    result.errors.push(`existing 조회 실패: ${exErr.message}`)
  }
  const existingSet = new Set<string>(
    (existingRows ?? [])
      .map((r) => (r as { mafra_rcp_seq: string }).mafra_rcp_seq)
      .filter((s): s is string => typeof s === "string")
  )

  // 3) 신규 RECIPE_ID 필터
  const newBasics = basics.filter(
    (b) => b.RECIPE_ID != null && !existingSet.has(String(b.RECIPE_ID))
  )
  result.skipped = basics.length - newBasics.length

  if (newBasics.length === 0) return result

  // 4) 재료·과정 전체 fetch (데이터셋 작아 부담 없음)
  let allIngredients: MafraRecipeIngredient[] = []
  let allSteps: MafraRecipeStep[] = []
  try {
    allIngredients = await getAllRecipeIngredients()
  } catch (err) {
    result.errors.push(
      `재료 전체 페치 실패: ${err instanceof Error ? err.message : String(err)}`
    )
  }
  try {
    allSteps = await getAllRecipeProcess()
  } catch (err) {
    result.errors.push(
      `과정 전체 페치 실패: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  // 5) RECIPE_ID 별 메모리 join
  const ingredientMap = new Map<number, MafraRecipeIngredient[]>()
  for (const i of allIngredients) {
    if (i.RECIPE_ID == null) continue
    const arr = ingredientMap.get(i.RECIPE_ID) ?? []
    arr.push(i)
    ingredientMap.set(i.RECIPE_ID, arr)
  }
  const stepMap = new Map<number, MafraRecipeStep[]>()
  for (const s of allSteps) {
    if (s.RECIPE_ID == null) continue
    const arr = stepMap.get(s.RECIPE_ID) ?? []
    arr.push(s)
    stepMap.set(s.RECIPE_ID, arr)
  }

  const rows: UpsertRow[] = []
  for (const basic of newBasics) {
    const ings = ingredientMap.get(basic.RECIPE_ID) ?? []
    const steps = stepMap.get(basic.RECIPE_ID) ?? []
    const row = toUpsertRow(basic, ings, steps)
    if (!row) continue
    rows.push(row)
  }

  if (rows.length === 0) return result

  // 6) upsert — mafra_rcp_seq 충돌키
  const { error: upErr, count } = await supabase
    .from("food_recipes")
    .upsert(rows, { onConflict: "mafra_rcp_seq", count: "exact" })

  if (upErr) {
    result.errors.push(`upsert 실패: ${upErr.message}`)
    return result
  }

  result.upserted = count ?? rows.length
  return result
}
