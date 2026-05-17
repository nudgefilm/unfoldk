import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  generateKoreanPack,
  MAX_PHRASES_PER_DRAMA,
} from "@/lib/claude/korean-pack-generator"
import { FAMOUS_DRAMAS, type FamousDrama } from "@/lib/korean/famous-dramas"
import { fetchTvDetail, searchTv, type TmdbTvShow } from "@/lib/api/tmdb"
import { buildDramaUpsertRow } from "@/lib/ingest/dramas"

export const maxDuration = 300
export const dynamic = "force-dynamic"

// /api/cron/ingest-korean-phrases — 매일 UTC 08:00 (한국 17:00)
//
// 흐름 (2026-05-18 famous-dramas 기반으로 전환):
//   1. lib/korean/famous-dramas.ts FAMOUS_DRAMAS 순회 — 학습 컨텐츠의 canonical 리스트
//   2. 각 famous drama 에 대해:
//      a. dramas DB 에서 title/title_ko/original_name ilike 매칭으로 존재 확인
//      b. 없으면 TMDB search/tv 로 검색 → KR origin 필터 → fetchTvDetail → dramas upsert
//      c. 자동 추가 실패 시 해당 famous 는 skip (로그만)
//   3. 매칭된 drama_id 에 기존 korean_phrases 가 MAX_PHRASES_PER_DRAMA (=5) 이상이면 skip
//   4. 부족하면 Claude Haiku tool_use 로 5개 생성 후 korean_phrases insert (drama_id 별 dedupe)
//   5. 결과: { total_dramas, scanned, generated, skipped, unknown_dramas, auto_added_dramas, errors }
//
// 비용/품질 통제:
//   - 한 run 처리 최대 MAX_DRAMAS_PER_RUN (=30) 으로 일일 비용 cap
//   - drama 자동 추가는 TMDB 검색 1회 + detail 1회 = 약 2 req/누락드라마 (24h 캐시)
//   - 동일 (drama_id, korean) 충돌 시 사전 dedupe — DB unique 없이 멱등성 확보
//   - famous-dramas 만 관리하면 dramas DB 가 자동 보충 (사용자 유지 부담 최소화)

const MAX_DRAMAS_PER_RUN = 30

interface IngestResult {
  source: "ingest-korean-phrases"
  total_dramas: number       // famous-dramas 목록 크기
  scanned: number            // generation 시도한 드라마 수
  generated: number          // 신규 phrase row 수
  skipped: number            // 이미 5개 이상 보유한 드라마 수
  unknown_dramas: number     // Claude 가 모른 (빈 배열 반환) 드라마 수
  auto_added_dramas: number  // 이번 run 에서 TMDB 검색으로 dramas 테이블에 새로 추가된 수
  auto_add_failures: number  // TMDB 검색·detail·upsert 어느 단계든 실패해 phrase 생성에서 제외된 수
  errors: string[]
  details: Array<{
    drama: string
    inserted: number
    auto_added?: boolean
  }>
}

export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  try {
    const result = await runKoreanPhrasesIngest()

    revalidatePath("/korean")
    revalidatePath("/api/korean/packs")

    const anyFailed = result.errors.length > 0
    await recordCronLog(
      "ingest-korean-phrases",
      anyFailed ? "failed" : "success",
      result
    )

    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown"
    const stack = err instanceof Error ? err.stack : undefined
    console.error("[cron/ingest-korean-phrases] 최상위 에러:", msg, stack)
    await recordCronLog("ingest-korean-phrases", "failed", { error: msg })
    return NextResponse.json(
      { source: "ingest-korean-phrases", error: msg, stack },
      { status: 500 }
    )
  }
}

interface ResolvedDrama {
  famous: FamousDrama
  dramaId: string
  title: string
  autoAdded: boolean
}

async function runKoreanPhrasesIngest(): Promise<IngestResult> {
  const admin = createSupabaseAdminClient()

  // 1. FAMOUS_DRAMAS 순회 — 매칭 / 자동 추가
  const resolved: ResolvedDrama[] = []
  const errors: string[] = []
  let autoAddedCount = 0
  let autoAddFailures = 0

  for (const famous of FAMOUS_DRAMAS) {
    const existing = await findExistingDrama(admin, famous)
    if (existing) {
      resolved.push({
        famous,
        dramaId: existing.id,
        title: existing.title,
        autoAdded: false,
      })
      continue
    }

    // dramas DB 에 없음 → TMDB 검색 + 자동 추가
    try {
      const added = await autoAddDramaFromTmdb(admin, famous)
      if (added) {
        autoAddedCount += 1
        console.log(
          `[ingest-korean-phrases] auto-added drama_id=${added.id} title=${added.title} (famous=${famous.en})`
        )
        resolved.push({
          famous,
          dramaId: added.id,
          title: added.title,
          autoAdded: true,
        })
      } else {
        autoAddFailures += 1
        console.warn(
          `[ingest-korean-phrases] TMDB 자동 추가 실패 — ${famous.en} / ${famous.ko}`
        )
      }
    } catch (err) {
      autoAddFailures += 1
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`auto-add ${famous.en}: ${msg}`)
      console.error(`[ingest-korean-phrases] auto-add 예외 ${famous.en}: ${msg}`)
    }
  }

  // 2. 후보 별 기존 phrase 카운트
  const dramaIds = resolved.map((r) => r.dramaId)
  let phraseCountByDrama = new Map<string, number>()
  if (dramaIds.length > 0) {
    const { data: countRows, error: countErr } = await admin
      .from("korean_phrases")
      .select("drama_id")
      .in("drama_id", dramaIds)
    if (countErr) {
      throw new Error(`korean_phrases 카운트 조회 실패: ${countErr.message}`)
    }
    for (const row of (countRows ?? []) as Array<{ drama_id: string }>) {
      phraseCountByDrama.set(
        row.drama_id,
        (phraseCountByDrama.get(row.drama_id) ?? 0) + 1
      )
    }
  }

  // 3. generation 대상 — phrase < 5 인 드라마, 비용 cap 으로 잘라냄
  const generationTargets = resolved
    .filter((r) => (phraseCountByDrama.get(r.dramaId) ?? 0) < MAX_PHRASES_PER_DRAMA)
    .slice(0, MAX_DRAMAS_PER_RUN)
  const skipped = resolved.length - generationTargets.length

  // 4. 각 후보 generation + insert
  let generated = 0
  let unknownDramas = 0
  const details: IngestResult["details"] = []

  for (const target of generationTargets) {
    try {
      const phrases = await generateKoreanPack({
        dramaKo: target.famous.ko,
        dramaEn: target.famous.en,
      })

      if (phrases.length === 0) {
        unknownDramas += 1
        details.push({
          drama: target.title,
          inserted: 0,
          ...(target.autoAdded ? { auto_added: true } : {}),
        })
        continue
      }

      const existingKoreans = await fetchExistingKoreans(admin, target.dramaId)
      const toInsert = phrases
        .filter((p) => !existingKoreans.has(p.korean))
        .map((p) => ({
          drama_id: target.dramaId,
          drama_name: target.title,
          korean: p.korean,
          romanization: p.romanization,
          english: p.english,
          word_breakdown: p.word_breakdown,
          synonyms: p.synonyms,
          antonyms: p.antonyms,
          difficulty: p.difficulty,
          featured_date: null as string | null,
        }))

      if (toInsert.length === 0) {
        details.push({
          drama: target.title,
          inserted: 0,
          ...(target.autoAdded ? { auto_added: true } : {}),
        })
        continue
      }

      const { error: insertErr } = await admin
        .from("korean_phrases")
        .insert(toInsert)
      if (insertErr) {
        errors.push(`${target.title}: ${insertErr.message}`)
        details.push({
          drama: target.title,
          inserted: 0,
          ...(target.autoAdded ? { auto_added: true } : {}),
        })
        continue
      }

      generated += toInsert.length
      details.push({
        drama: target.title,
        inserted: toInsert.length,
        ...(target.autoAdded ? { auto_added: true } : {}),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${target.title}: ${msg}`)
      details.push({
        drama: target.title,
        inserted: 0,
        ...(target.autoAdded ? { auto_added: true } : {}),
      })
    }
  }

  return {
    source: "ingest-korean-phrases",
    total_dramas: FAMOUS_DRAMAS.length,
    scanned: generationTargets.length,
    generated,
    skipped,
    unknown_dramas: unknownDramas,
    auto_added_dramas: autoAddedCount,
    auto_add_failures: autoAddFailures,
    errors,
    details,
  }
}

// ─── helpers ────────────────────────────────────────────────────

// 드라마의 기존 korean 텍스트 집합 — 중복 insert 방지용. 같은 드라마에 같은 표현 재생성 시 skip.
async function fetchExistingKoreans(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  dramaId: string
): Promise<Set<string>> {
  const { data } = await admin
    .from("korean_phrases")
    .select("korean")
    .eq("drama_id", dramaId)
  const set = new Set<string>()
  for (const row of (data ?? []) as Array<{ korean: string }>) {
    set.add(row.korean)
  }
  return set
}

// dramas 테이블에서 famous 드라마 매칭 — title / title_ko / original_name 순차 ilike.
// phrase-of-day 의 tryMatch 패턴 재사용. apostrophe·comma 포함된 제목도 안전.
async function findExistingDrama(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  famous: FamousDrama
): Promise<{ id: string; title: string } | null> {
  const tryCol = async (
    col: "title" | "title_ko" | "original_name",
    value: string
  ): Promise<{ id: string; title: string } | null> => {
    const { data } = await admin
      .from("dramas")
      .select("id, title")
      .ilike(col, value)
      .limit(1)
    if (Array.isArray(data) && data.length > 0) {
      return data[0] as { id: string; title: string }
    }
    return null
  }

  return (
    (await tryCol("title", famous.en)) ??
    (await tryCol("title_ko", famous.ko)) ??
    (await tryCol("original_name", famous.ko))
  )
}

// TMDB 검색 → KR origin 필터 → 가장 적합한 후보 1건 → detail fetch → dramas upsert.
// 실패 단계 어디서든 null 반환 (호출부가 skip 처리).
async function autoAddDramaFromTmdb(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  famous: FamousDrama
): Promise<{ id: string; title: string } | null> {
  // 1. EN 으로 먼저 검색 (TMDB 응답이 영문이라 매칭 정확도 높음). KR 결과 없으면 KO 로 재시도.
  let candidates = filterKoreanResults(await searchTv(famous.en))
  if (candidates.length === 0) {
    candidates = filterKoreanResults(await searchTv(famous.ko))
  }
  if (candidates.length === 0) {
    console.warn(
      `[ingest-korean-phrases] TMDB 검색 결과 0건 — ${famous.en} / ${famous.ko}`
    )
    return null
  }

  // 2. 정확 매치 우선 — 그 다음 popularity 최대값.
  const best = pickBestMatch(candidates, famous)

  // 3. detail fetch (genre / cast / providers 등 풍부한 메타 확보)
  const detail = await fetchTvDetail(best.id, { expanded: true })
  if (!detail) {
    console.warn(
      `[ingest-korean-phrases] TMDB detail null tmdb_id=${best.id} famous=${famous.en}`
    )
    return null
  }

  // 4. upsert — 기존 ingest pattern (buildDramaUpsertRow + on_conflict=tmdb_id)
  const row = buildDramaUpsertRow(best, detail)
  const { data: upserted, error } = await admin
    .from("dramas")
    .upsert(row, { onConflict: "tmdb_id", ignoreDuplicates: false })
    .select("id, title")
    .single()

  if (error || !upserted) {
    console.warn(
      `[ingest-korean-phrases] dramas upsert 실패 famous=${famous.en} message=${error?.message ?? "no row"}`
    )
    return null
  }
  return upserted as { id: string; title: string }
}

function filterKoreanResults(results: TmdbTvShow[]): TmdbTvShow[] {
  return results.filter(
    (r) => Array.isArray(r.origin_country) && r.origin_country.includes("KR")
  )
}

// 정확 매치 (name / original_name 동일) > popularity 최댓값.
function pickBestMatch(candidates: TmdbTvShow[], famous: FamousDrama): TmdbTvShow {
  const exact = candidates.find(
    (c) =>
      c.name.toLowerCase().trim() === famous.en.toLowerCase().trim() ||
      c.original_name === famous.ko
  )
  if (exact) return exact
  return candidates.slice().sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))[0]
}
