import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { generateKoreanPack } from "@/lib/claude/korean-pack-generator"
import { generateDramaPhrases } from "@/lib/claude/korean-phrase"

export const maxDuration = 300
export const dynamic = "force-dynamic"

// /api/cron/ingest-korean-phrases — 매일 UTC 08:00 (한국 17:00)
//
// 2026-05-19 전환: FAMOUS_DRAMAS 20편 하드코딩 → dramas 테이블 전체 순회.
//
// 흐름:
//   1. dramas 테이블에서 is_active=true 인 row 를 popularity desc 정렬로 fetch
//   2. korean_phrases 가 1건이라도 있는 drama_id 집합 build → skip 대상
//   3. 미커버 드라마 상위 MAX_DRAMAS_PER_RUN (=30) 만 generation 대상
//   4. 각 드라마에 대해 Claude Haiku tool_use 로 표현 5개 생성 → korean_phrases insert
//   5. 결과: { total_dramas, scanned, generated, skipped, unknown_dramas, errors, details }
//
// 비용/품질 통제:
//   - 한 run 처리 최대 30 → 일일 비용 cap
//   - 표현 1건이라도 보유 drama 는 skip (top-up 안 함). 신규 드라마 우선 커버.
//   - 새로 추가되는 dramas (TMDB cron 이 채우는) 도 자동으로 다음 run 에서 커버.

const MAX_DRAMAS_PER_RUN = 30

interface IngestResult {
  source: "ingest-korean-phrases"
  total_dramas: number       // dramas 테이블 활성 row 수
  scanned: number            // generation 시도한 드라마 수
  generated: number          // 신규 phrase row 수
  skipped: number            // 이미 표현 보유로 skip 한 드라마 수
  unknown_dramas: number     // Claude 가 모른 (빈 배열 반환) 드라마 수
  errors: string[]
  details: Array<{
    drama: string
    inserted: number
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

interface DramaRow {
  id: string
  title: string
  title_ko: string | null
}

async function runKoreanPhrasesIngest(): Promise<IngestResult> {
  const admin = createSupabaseAdminClient()
  const errors: string[] = []

  // 1) 활성 드라마 popularity desc 정렬로 fetch.
  //    PostgREST 기본 1000-row limit — 페이지네이션으로 전체 수집.
  const allDramas: DramaRow[] = []
  const PAGE = 1000
  const MAX_PAGES = 20 // 안전 cap (최대 20,000 드라마)
  for (let p = 0; p < MAX_PAGES; p++) {
    const from = p * PAGE
    const to = from + PAGE - 1
    const { data, error } = await admin
      .from("dramas")
      .select("id, title, title_ko")
      .eq("is_active", true)
      .order("popularity", { ascending: false, nullsFirst: false })
      .range(from, to)

    if (error) {
      throw new Error(`dramas 조회 실패 (page ${p}): ${error.message}`)
    }
    const rows = (data ?? []) as DramaRow[]
    allDramas.push(...rows)
    if (rows.length < PAGE) break
  }

  // 2) 이미 표현이 1건이라도 있는 drama_id 집합 — skip 대상.
  const dramasWithPhrases = new Set<string>()
  for (let p = 0; p < MAX_PAGES; p++) {
    const from = p * PAGE
    const to = from + PAGE - 1
    const { data, error } = await admin
      .from("korean_phrases")
      .select("drama_id")
      .not("drama_id", "is", null)
      .range(from, to)

    if (error) {
      throw new Error(`korean_phrases 조회 실패 (page ${p}): ${error.message}`)
    }
    const rows = (data ?? []) as Array<{ drama_id: string | null }>
    for (const r of rows) {
      if (r.drama_id) dramasWithPhrases.add(r.drama_id)
    }
    if (rows.length < PAGE) break
  }

  // 3) 미커버 드라마 → cap 으로 자르기
  const candidates = allDramas.filter((d) => !dramasWithPhrases.has(d.id))
  const targets = candidates.slice(0, MAX_DRAMAS_PER_RUN)
  const skipped = allDramas.length - candidates.length

  // 4) 각 후보 generation + insert
  let generated = 0
  let unknownDramas = 0
  const details: IngestResult["details"] = []

  for (const target of targets) {
    const dramaKo = target.title_ko?.trim() || target.title
    const dramaEn = target.title

    try {
      // 1) beginner/mixed pack (기존)
      const packPhrases = await generateKoreanPack({ dramaKo, dramaEn })

      if (packPhrases.length === 0) {
        unknownDramas += 1
        details.push({ drama: target.title, inserted: 0 })
        continue
      }

      // 2) intermediate 3개
      const interResult = await generateDramaPhrases({ dramaKo, dramaEn, difficulty: "intermediate" })
      const interPhrases = interResult.ok ? interResult.payloads : []
      if (!interResult.ok) {
        errors.push(`${target.title} [intermediate]: ${interResult.reason}`)
      }

      // 3) advanced 3개
      const advResult = await generateDramaPhrases({ dramaKo, dramaEn, difficulty: "advanced" })
      const advPhrases = advResult.ok ? advResult.payloads : []
      if (!advResult.ok) {
        errors.push(`${target.title} [advanced]: ${advResult.reason}`)
      }

      // 4) 전체 합치기 + korean 텍스트 기준 dedupe
      const allPhrases = [...packPhrases, ...interPhrases, ...advPhrases]
      const seen = new Set<string>()
      const toInsert = allPhrases
        .filter((p) => {
          if (seen.has(p.korean)) return false
          seen.add(p.korean)
          return true
        })
        .map((p) => ({
          drama_id: target.id,
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
        details.push({ drama: target.title, inserted: 0 })
        continue
      }

      const { error: insertErr } = await admin
        .from("korean_phrases")
        .insert(toInsert)

      if (insertErr) {
        errors.push(`${target.title}: ${insertErr.message}`)
        details.push({ drama: target.title, inserted: 0 })
        continue
      }

      generated += toInsert.length
      details.push({ drama: target.title, inserted: toInsert.length })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${target.title}: ${msg}`)
      details.push({ drama: target.title, inserted: 0 })
    }
  }

  return {
    source: "ingest-korean-phrases",
    total_dramas: allDramas.length,
    scanned: targets.length,
    generated,
    skipped,
    unknown_dramas: unknownDramas,
    errors,
    details,
  }
}
