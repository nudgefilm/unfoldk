// KfoodKit (M+4) — 농림수산식품교육문화정보원 한식 레시피 인제스트
//
// 데이터 소스: data.go.kr 농림수산식품교육문화정보원 레시피 API (3종 엔드포인트).
// 응답은 한국어 — 영문 설명은 별도 단계 (Claude Haiku enrichment) 에서 사후 생성.
//
// 수집 전략:
//   1) getRecipeList(pageNo, 50) — 한 번에 최대 50건 기본정보 페치
//   2) 이미 food_recipes 에 있는 mafra_rcp_seq 는 skip
//   3) 신규 항목만 재료·과정 추가 호출 후 → food_recipes row 매핑 → upsert
//
// 쿼터·시간 가드레일:
//   - MAX_RECIPES_PER_RUN=50 — 일일 1,000 쿼터의 5% (재료·과정 포함 시 3 쿼터/레시피)
//   - weekly cron 만 호출 (vercel.json: 0 6 * * 1, 월 06:00 UTC)
//   - 응답 캐싱은 mafra-recipe.ts 의 24h revalidate 가 처리

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  getRecipeList,
  getRecipeIngredients,
  getRecipeProcess,
  type MafraRecipeBasic,
  type MafraRecipeIngredient,
  type MafraRecipeStep,
} from "@/lib/api/mafra-recipe"

const MAX_RECIPES_PER_RUN = 50

export interface FoodRecipesIngestResult {
  source: "food-recipes"
  fetched: number       // MAFRA 응답 기본정보 항목 수
  upserted: number      // 신규 insert 된 row 수
  skipped: number       // 이미 존재해 skip 된 항목 수
  errors: string[]
}

// MAFRA 응답 → food_recipes row 변환.
// title 은 한글 원본 (rcpNm) — 영문 번역은 후속 Claude enrichment 단계.
interface UpsertRow {
  mafra_rcp_seq: string
  title: string
  image_url: string | null
  ingredients: unknown   // jsonb — [{ raw: string }] (rcpPartsDtls 그대로 보존)
  instructions: unknown  // jsonb — [{ step, instruction, image_url? }]
  nutrition: unknown     // jsonb — { calories, carbs, protein, fat, sodium, low_sodium_tip }
  ready_in_minutes: number | null
  servings: number | null
  source_url: string | null
}

// 영양 문자열 → number (단위·공백 제거). 비숫자/빈값은 null.
function parseNum(s: string | undefined): number | null {
  if (!s) return null
  const m = s.replace(/[^\d.]/g, "")
  if (!m) return null
  const n = Number(m)
  return Number.isFinite(n) ? n : null
}

function toUpsertRow(
  basic: MafraRecipeBasic,
  ingredients: MafraRecipeIngredient[],
  steps: MafraRecipeStep[]
): UpsertRow | null {
  if (!basic.rcpSeq || !basic.rcpNm?.trim()) return null

  // 재료: rcpPartsDtls 가 자유 텍스트라 그대로 보존. 후속 단계에서 파싱·번역.
  const ingredientPayload = ingredients
    .map((i) => i.rcpPartsDtls?.trim())
    .filter((s): s is string => !!s)
    .map((raw) => ({ raw }))

  // 과정: cookingNo 정렬 + 각 단계 텍스트/이미지 함께 저장
  const stepsPayload = steps
    .slice()
    .sort((a, b) => {
      const ai = Number(a.cookingNo ?? 0)
      const bi = Number(b.cookingNo ?? 0)
      return ai - bi
    })
    .map((s) => ({
      step: Number(s.cookingNo ?? 0),
      instruction: s.cookingDc?.trim() ?? "",
      image_url: s.stepFileUrl?.trim() || null,
    }))
    .filter((s) => s.instruction.length > 0)

  const nutrition = {
    calories: parseNum(basic.infoEng),
    carbs: parseNum(basic.infoCar),
    protein: parseNum(basic.infoPro),
    fat: parseNum(basic.infoFat),
    sodium: parseNum(basic.infoNa),
    low_sodium_tip: basic.rcpNaTip?.trim() || null,
    way: basic.rcpWay2?.trim() || null,        // 조리방법 (굽기·끓이기 등)
    pat: basic.rcpPat2?.trim() || null,        // 요리종류 (반찬·국&찌개 등)
  }

  const imageUrl = basic.attFileNoMk?.trim() || basic.attFileNoMain?.trim() || null

  return {
    mafra_rcp_seq: basic.rcpSeq,
    title: basic.rcpNm.trim(),
    image_url: imageUrl,
    ingredients: ingredientPayload,
    instructions: stepsPayload,
    nutrition,
    // MAFRA 응답은 조리시간·인분수 미제공 — 후속 단계에서 보강 (현재는 null)
    ready_in_minutes: null,
    servings: null,
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

  // 1) MAFRA 기본정보 목록 페치 (한 번에 cap 만큼)
  let basics: MafraRecipeBasic[] = []
  try {
    const res = await getRecipeList({ pageNo: 1, numOfRows: MAX_RECIPES_PER_RUN })
    basics = res.items
    result.fetched = basics.length
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.errors.push(`MAFRA 기본정보 페치 실패: ${msg}`)
    return result
  }

  if (basics.length === 0) return result

  const supabase = createSupabaseAdminClient()

  // 2) 이미 존재하는 mafra_rcp_seq 조회 — skip 처리용
  const seqs = basics.map((b) => b.rcpSeq).filter((s): s is string => !!s)
  const { data: existingRows, error: exErr } = await supabase
    .from("food_recipes")
    .select("mafra_rcp_seq")
    .in("mafra_rcp_seq", seqs)

  if (exErr) {
    result.errors.push(`existing 조회 실패: ${exErr.message}`)
    // 계속 진행 — onConflict 가 받아주지만, skip 카운트는 부정확해짐
  }

  const existingSet = new Set<string>(
    (existingRows ?? [])
      .map((r) => (r as { mafra_rcp_seq: string }).mafra_rcp_seq)
      .filter((s): s is string => typeof s === "string")
  )

  // 3) 신규만 재료·과정 페치 후 매핑
  const rows: UpsertRow[] = []
  for (const basic of basics) {
    if (!basic.rcpSeq) continue
    if (existingSet.has(basic.rcpSeq)) {
      result.skipped++
      continue
    }

    let ingredients: MafraRecipeIngredient[] = []
    let steps: MafraRecipeStep[] = []
    try {
      ingredients = await getRecipeIngredients(basic.rcpSeq)
    } catch (err) {
      result.errors.push(
        `재료 페치 실패 (${basic.rcpSeq}): ${err instanceof Error ? err.message : String(err)}`
      )
      // 재료 실패해도 row 는 생성 (instructions 빈 배열로 진행 가능)
    }
    try {
      steps = await getRecipeProcess(basic.rcpSeq)
    } catch (err) {
      result.errors.push(
        `과정 페치 실패 (${basic.rcpSeq}): ${err instanceof Error ? err.message : String(err)}`
      )
    }

    const row = toUpsertRow(basic, ingredients, steps)
    if (!row) continue
    rows.push(row)
  }

  if (rows.length === 0) return result

  // 4) upsert — mafra_rcp_seq 충돌키 (race 안전)
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
