// KfoodKit — food_recipes 이미지 backfill (식약처 COOKRCP01 매칭)
//
// 흐름:
//   1) MFDS COOKRCP01 전체 fetch
//   2) food_recipes 중 image_url=null row 조회
//   3) RECIPE_NM_KO ↔ RCP_NM 매칭 (exact → contains)
//   4) 매칭된 row UPDATE image_url
//
// 매칭 우선순위:
//   1) 정규화 후 완전일치 (공백·구두점 제거 + NFC)
//   2) MAFRA 명이 MFDS 명을 포함 OR MFDS 명이 MAFRA 명을 포함 (substring 양방향)
//   exact 매칭이 있으면 partial 은 무시 — 동일 row 가 양쪽에 다 잡힐 때 정확도 우선.
//
// 이미 image_url 있는 row 는 건드리지 않음 — 수동 큐레이션 보존.

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  getAllCookRecipes,
  normalizeRecipeName,
  pickImageUrl,
  type MfdsCookRecipe,
} from "@/lib/api/mfds-recipe"

export interface FoodImageBackfillResult {
  source: "food-image-backfill"
  fetched: number          // MFDS 응답 row 수
  candidates: number       // image_url=null 인 food_recipes row 수
  matched: number          // 매칭 시도에서 후보 찾은 수 (exact+contains 합)
  updated: number          // 실제 DB update 성공 수 (이미지 URL 정상 추출된 케이스)
  unmatched: number        // 후보 row 중 매칭 실패 수
  errors: string[]
}

interface CandidateRow {
  id: string
  title: string            // RECIPE_NM_KO 원본
  normalized: string       // normalize 결과 — 매칭 키
}

// MFDS row 를 (normalized title → row) 맵으로 인덱싱. 양방향 contains 매칭 위해
// 원본도 같이 저장.
interface IndexEntry {
  row: MfdsCookRecipe
  normalized: string
  rawTitle: string
}

function buildMfdsIndex(rows: MfdsCookRecipe[]): IndexEntry[] {
  const out: IndexEntry[] = []
  for (const r of rows) {
    const title = r.RCP_NM?.trim()
    if (!title) continue
    out.push({
      row: r,
      normalized: normalizeRecipeName(title),
      rawTitle: title,
    })
  }
  return out
}

// 매칭 — exact (정규화) 우선 → contains (양방향) fallback.
// 동일 정규화에 여러 MFDS row 가 있을 수 있으나 (예: 재시도된 동일 메뉴) 첫 hit 사용.
function findMatch(
  candidate: CandidateRow,
  index: IndexEntry[]
): MfdsCookRecipe | null {
  // 1) exact (정규화) 매칭
  const exact = index.find((e) => e.normalized === candidate.normalized)
  if (exact) return exact.row

  // 2) contains 매칭 — 짧은 쪽이 긴 쪽에 포함
  const candNorm = candidate.normalized
  if (candNorm.length < 2) return null   // 너무 짧으면 의미 없음
  const contains = index.find(
    (e) =>
      (e.normalized.length >= 2 && e.normalized.includes(candNorm)) ||
      (e.normalized.length >= 2 && candNorm.includes(e.normalized))
  )
  return contains?.row ?? null
}

export async function runFoodImageBackfill(): Promise<FoodImageBackfillResult> {
  const result: FoodImageBackfillResult = {
    source: "food-image-backfill",
    fetched: 0,
    candidates: 0,
    matched: 0,
    updated: 0,
    unmatched: 0,
    errors: [],
  }

  // 1) MFDS 전체 fetch
  let mfdsRows: MfdsCookRecipe[]
  try {
    mfdsRows = await getAllCookRecipes()
    result.fetched = mfdsRows.length
  } catch (err) {
    result.errors.push(
      `MFDS 페치 실패: ${err instanceof Error ? err.message : String(err)}`
    )
    return result
  }

  if (mfdsRows.length === 0) {
    result.errors.push("MFDS 응답 0건 — 매칭 후보 없음")
    return result
  }

  const index = buildMfdsIndex(mfdsRows)

  // 2) food_recipes 중 image_url=null row 조회
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("food_recipes")
    .select("id, title")
    .is("image_url", null)

  if (error) {
    result.errors.push(`food_recipes 조회 실패: ${error.message}`)
    return result
  }

  type Row = { id: string; title: string }
  const candidates: CandidateRow[] = ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    title: r.title,
    normalized: normalizeRecipeName(r.title),
  }))
  result.candidates = candidates.length

  // 3) 매칭 + 4) UPDATE
  for (const cand of candidates) {
    const mfdsRow = findMatch(cand, index)
    if (!mfdsRow) {
      result.unmatched++
      continue
    }
    result.matched++

    const imageUrl = pickImageUrl(mfdsRow)
    if (!imageUrl) {
      // 매칭은 됐지만 이미지 URL 없음 — 보통 ATT_FILE_NO_MAIN/MK 양쪽 빈 케이스
      result.unmatched++
      continue
    }

    const { error: upErr } = await supabase
      .from("food_recipes")
      .update({ image_url: imageUrl })
      .eq("id", cand.id)

    if (upErr) {
      result.errors.push(`update 실패 (${cand.id}): ${upErr.message}`)
      continue
    }
    result.updated++
  }

  return result
}
