// KfoodKit — food_recipes 이미지 backfill (3단계)
//
// Phase 1 — MFDS COOKRCP01 매칭:
//   1) MFDS 전체 fetch → index 구축
//   2) image_url=null row 의 RECIPE_NM_KO 를 정규화 후 매칭 (exact → 양방향 contains)
//   3) 매칭 + 이미지 URL 추출 성공 시 image_url + image_source='mfds' UPDATE
//
// Phase 2 — Claude 정규화 후 MFDS 재매칭:
//   Phase 1 unmatched row 의 RECIPE_NM_KO 를 Claude Haiku 가 표준 한글로 정규화
//   (오타·띄어쓰기·축약형 통일) → 재매칭. 정규화 성공 row 만 retry, 변경 없으면 skip.
//
// Phase 3 — Unsplash fallback:
//   Phase 1+2 모두 unmatched row 에 대해 Claude 가 영문 검색어 생성 →
//   Unsplash search → 첫 결과 image_url + image_source='unsplash'.
//   rate-limit (free tier 50/hour) cap: 1회 run 당 MAX_UNSPLASH_PER_RUN.
//
// 이미 image_url 채워진 row 는 어느 phase 에서도 건드리지 않음 (수동 큐레이션 보존).

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  getAllCookRecipes,
  normalizeRecipeName,
  pickImageUrl,
  type MfdsCookRecipe,
} from "@/lib/api/mfds-recipe"
import { normalizeRecipeNames } from "@/lib/claude/recipe-name-normalize"
import { generateFoodImageQueries } from "@/lib/claude/food-image-query"
import { searchUnsplashImage, UnsplashError } from "@/lib/blog-gen/unsplash"

// Unsplash free tier: 50 req/hour. 보수적으로 1 run 당 40건 cap.
const MAX_UNSPLASH_PER_RUN = 40

export interface FoodImageBackfillResult {
  source: "food-image-backfill"
  fetched: number              // MFDS 응답 row 수
  candidates: number           // image_url=null row 수 (시작 시점)
  // Phase 1
  phase1_matched: number       // exact/contains 매칭 후보 hit
  phase1_updated: number       // 실제 UPDATE 성공 (mfds)
  // Phase 2
  phase2_attempted: number     // Claude 정규화 시도 row 수
  phase2_matched: number
  phase2_updated: number       // mfds 추가 UPDATE
  // Phase 3
  phase3_attempted: number     // Unsplash fallback 시도 (cap 이내)
  phase3_updated: number       // unsplash UPDATE 성공
  // 최종 unmatched (3단계 모두 실패)
  unmatched: number
  errors: string[]
}

interface MfdsIndexEntry {
  row: MfdsCookRecipe
  normalized: string
  rawTitle: string
}

function buildMfdsIndex(rows: MfdsCookRecipe[]): MfdsIndexEntry[] {
  const out: MfdsIndexEntry[] = []
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

// 정규화된 이름으로 MFDS 매칭. exact → contains.
function matchAgainstMfds(
  candidateNormalized: string,
  index: MfdsIndexEntry[]
): MfdsCookRecipe | null {
  if (candidateNormalized.length < 2) return null

  const exact = index.find((e) => e.normalized === candidateNormalized)
  if (exact) return exact.row

  const contains = index.find(
    (e) =>
      (e.normalized.length >= 2 && e.normalized.includes(candidateNormalized)) ||
      (e.normalized.length >= 2 && candidateNormalized.includes(e.normalized))
  )
  return contains?.row ?? null
}

// candidate row 의 매칭 시도 + UPDATE. 매칭 성공 + 이미지 추출 성공이면 updated=true.
async function tryMfdsUpdate(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  candidate: { id: string; normalized: string },
  index: MfdsIndexEntry[]
): Promise<{ matched: boolean; updated: boolean; error?: string }> {
  const mfdsRow = matchAgainstMfds(candidate.normalized, index)
  if (!mfdsRow) return { matched: false, updated: false }

  const imageUrl = pickImageUrl(mfdsRow)
  if (!imageUrl) return { matched: true, updated: false }

  const { error } = await supabase
    .from("food_recipes")
    .update({ image_url: imageUrl, image_source: "mfds" })
    .eq("id", candidate.id)

  if (error) {
    return { matched: true, updated: false, error: error.message }
  }
  return { matched: true, updated: true }
}

interface PendingRow {
  id: string
  title: string                // 원본 RECIPE_NM_KO
  normalized: string           // 정규화 후 (NFC + 공백·구두점 제거)
}

export async function runFoodImageBackfill(): Promise<FoodImageBackfillResult> {
  const result: FoodImageBackfillResult = {
    source: "food-image-backfill",
    fetched: 0,
    candidates: 0,
    phase1_matched: 0,
    phase1_updated: 0,
    phase2_attempted: 0,
    phase2_matched: 0,
    phase2_updated: 0,
    phase3_attempted: 0,
    phase3_updated: 0,
    unmatched: 0,
    errors: [],
  }

  const supabase = createSupabaseAdminClient()

  // ─── 0. image_url=null row 조회 ─────────────────────────────
  const { data: candData, error: candErr } = await supabase
    .from("food_recipes")
    .select("id, title")
    .is("image_url", null)

  if (candErr) {
    result.errors.push(`candidate 조회 실패: ${candErr.message}`)
    return result
  }
  type Row = { id: string; title: string }
  const candidates: PendingRow[] = ((candData ?? []) as Row[]).map((r) => ({
    id: r.id,
    title: r.title,
    normalized: normalizeRecipeName(r.title),
  }))
  result.candidates = candidates.length

  if (candidates.length === 0) {
    return result        // 더 채울 row 없음 — 조기 종료
  }

  // ─── 1. MFDS 전체 fetch + index 구축 ─────────────────────────
  let mfdsRows: MfdsCookRecipe[]
  try {
    mfdsRows = await getAllCookRecipes()
    result.fetched = mfdsRows.length
  } catch (err) {
    result.errors.push(
      `MFDS 페치 실패: ${err instanceof Error ? err.message : String(err)}`
    )
    // 페치 실패해도 Phase 3 (Unsplash) 는 별도 진행 가능 → unmatched 로 모아 fallback
    mfdsRows = []
  }
  const mfdsIndex = buildMfdsIndex(mfdsRows)

  // ─── Phase 1 — 정규화된 원본명으로 MFDS 매칭 ────────────────
  const stillPending: PendingRow[] = []
  for (const cand of candidates) {
    if (mfdsIndex.length === 0) {
      stillPending.push(cand)
      continue
    }
    const r = await tryMfdsUpdate(supabase, cand, mfdsIndex)
    if (r.error) result.errors.push(`P1 update (${cand.id}): ${r.error}`)
    if (r.matched) result.phase1_matched++
    if (r.updated) result.phase1_updated++
    else stillPending.push(cand)
  }

  // ─── Phase 2 — Claude 정규화 후 MFDS 재매칭 ──────────────────
  // mfdsIndex 없으면 의미 없음 — Phase 3 로 직행
  let afterPhase2: PendingRow[] = stillPending
  if (stillPending.length > 0 && mfdsIndex.length > 0) {
    result.phase2_attempted = stillPending.length
    let normalized: Awaited<ReturnType<typeof normalizeRecipeNames>> = []
    try {
      normalized = await normalizeRecipeNames(stillPending.map((c) => c.title))
    } catch (err) {
      result.errors.push(
        `Claude 정규화 단계 예외: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    // 정규화 결과를 candidate 별 새 normalized 키로 매핑
    const normMap = new Map<string, string>()
    for (const n of normalized) {
      if (n.canonical && n.canonical !== n.original) {
        normMap.set(n.original, normalizeRecipeName(n.canonical))
      }
    }

    const next: PendingRow[] = []
    for (const cand of stillPending) {
      const newNorm = normMap.get(cand.title)
      if (!newNorm || newNorm === cand.normalized) {
        // 정규화 변화 없음 — retry 의미 없음
        next.push(cand)
        continue
      }
      const r = await tryMfdsUpdate(
        supabase,
        { id: cand.id, normalized: newNorm },
        mfdsIndex
      )
      if (r.error) result.errors.push(`P2 update (${cand.id}): ${r.error}`)
      if (r.matched) result.phase2_matched++
      if (r.updated) result.phase2_updated++
      else next.push(cand)
    }
    afterPhase2 = next
  }

  // ─── Phase 3 — Unsplash fallback (cap) ──────────────────────
  if (afterPhase2.length > 0) {
    const phase3Targets = afterPhase2.slice(0, MAX_UNSPLASH_PER_RUN)
    result.phase3_attempted = phase3Targets.length

    let queries: Awaited<ReturnType<typeof generateFoodImageQueries>> = []
    try {
      queries = await generateFoodImageQueries(phase3Targets.map((c) => c.title))
    } catch (err) {
      result.errors.push(
        `Claude 영문 쿼리 단계 예외: ${err instanceof Error ? err.message : String(err)}`
      )
    }

    const queryMap = new Map<string, string>()
    for (const q of queries) {
      if (q.query) queryMap.set(q.original, q.query)
    }

    for (const cand of phase3Targets) {
      const q = queryMap.get(cand.title)
      if (!q) continue

      let img: Awaited<ReturnType<typeof searchUnsplashImage>>
      try {
        img = await searchUnsplashImage(q)
      } catch (err) {
        if (err instanceof UnsplashError) {
          // 0건 / rate limit / 키 오류 등 — log 만, 다음 row 진행
          result.errors.push(`P3 Unsplash "${cand.title}": ${err.message}`)
        } else {
          result.errors.push(
            `P3 Unsplash 예외 "${cand.title}": ${err instanceof Error ? err.message : String(err)}`
          )
        }
        continue
      }

      const { error: upErr } = await supabase
        .from("food_recipes")
        .update({ image_url: img.imageUrl, image_source: "unsplash" })
        .eq("id", cand.id)

      if (upErr) {
        result.errors.push(`P3 update (${cand.id}): ${upErr.message}`)
        continue
      }
      result.phase3_updated++
    }

    // cap 초과로 처리 못 한 row 는 다음 run 에서 재시도 — unmatched 로 카운트
    result.unmatched = afterPhase2.length - result.phase3_updated
  }

  return result
}
