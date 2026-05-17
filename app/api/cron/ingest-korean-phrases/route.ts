import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  generateKoreanPack,
  MAX_PHRASES_PER_DRAMA,
} from "@/lib/claude/korean-pack-generator"

export const maxDuration = 300
export const dynamic = "force-dynamic"

// /api/cron/ingest-korean-phrases — 매일 UTC 08:00 (한국 17:00)
//
// 흐름:
//   1. dramas 테이블 활성 + 포스터 있는 드라마 전체 순회
//   2. 드라마당 기존 korean_phrases 가 MAX_PHRASES_PER_DRAMA (=5) 이상이면 skip
//   3. 부족하면 Claude Haiku tool_use 로 5개 생성 후 korean_phrases upsert
//   4. 결과: { total_dramas, generated, skipped, errors }
//
// 비용/품질 통제:
//   - 한 run 처리 최대 MAX_DRAMAS_PER_RUN (=20) 으로 일일 비용 cap
//   - drama_id + korean 텍스트 충돌 시 ON CONFLICT do nothing (멱등)
//   - Claude 가 모르는 드라마 → 빈 배열 → 별도 row 안 만들고 다음 run 재시도 허용

const MAX_DRAMAS_PER_RUN = 20

interface IngestResult {
  source: "ingest-korean-phrases"
  total_dramas: number
  scanned: number
  generated: number      // 신규 phrase row 수
  skipped: number        // 이미 5개 이상 보유한 드라마 수
  unknown_dramas: number // Claude 가 모른 (빈 배열 반환) 드라마 수
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

async function runKoreanPhrasesIngest(): Promise<IngestResult> {
  const admin = createSupabaseAdminClient()

  // 1. 활성 드라마 — 포스터 있는 것만 (학습 팩 카드 노출 대상)
  const { data: dramaRows, error: dramaErr } = await admin
    .from("dramas")
    .select("id, title, title_ko")
    .eq("is_active", true)
    .not("poster_url", "is", null)
    .order("popularity", { ascending: false, nullsFirst: false })

  if (dramaErr) {
    throw new Error(`dramas 조회 실패: ${dramaErr.message}`)
  }

  const dramas = (dramaRows ?? []) as Array<{
    id: string
    title: string
    title_ko: string | null
  }>

  if (dramas.length === 0) {
    return {
      source: "ingest-korean-phrases",
      total_dramas: 0,
      scanned: 0,
      generated: 0,
      skipped: 0,
      unknown_dramas: 0,
      errors: [],
      details: [],
    }
  }

  // 2. 드라마별 기존 phrase 카운트 조회 — drama_id 기준
  const dramaIds = dramas.map((d) => d.id)
  const { data: countRows, error: countErr } = await admin
    .from("korean_phrases")
    .select("drama_id")
    .in("drama_id", dramaIds)

  if (countErr) {
    throw new Error(`korean_phrases 카운트 조회 실패: ${countErr.message}`)
  }

  const phraseCountByDrama = new Map<string, number>()
  for (const row of (countRows ?? []) as Array<{ drama_id: string }>) {
    phraseCountByDrama.set(row.drama_id, (phraseCountByDrama.get(row.drama_id) ?? 0) + 1)
  }

  // 3. 후보 드라마 (5개 미만) 순회 — 비용 cap 으로 잘라냄
  const candidates = dramas
    .filter((d) => (phraseCountByDrama.get(d.id) ?? 0) < MAX_PHRASES_PER_DRAMA)
    .slice(0, MAX_DRAMAS_PER_RUN)

  const skipped = dramas.length - candidates.length

  let generated = 0
  let unknownDramas = 0
  const errors: string[] = []
  const details: IngestResult["details"] = []

  for (const drama of candidates) {
    try {
      const phrases = await generateKoreanPack({
        dramaKo: drama.title_ko,
        dramaEn: drama.title,
      })

      if (phrases.length === 0) {
        unknownDramas += 1
        details.push({ drama: drama.title, inserted: 0 })
        continue
      }

      // 4. 신규 phrase upsert — drama 별로 묶음 insert. featured_date 는 null (오늘의 표현 아님).
      //    동일 (drama_id, korean) 충돌 시 중복 row 회피 — DB 에 unique 가 없으므로 사전 select 로 dedupe.
      const existingKoreans = await fetchExistingKoreans(admin, drama.id)
      const toInsert = phrases
        .filter((p) => !existingKoreans.has(p.korean))
        .map((p) => ({
          drama_id: drama.id,
          drama_name: drama.title,
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
        details.push({ drama: drama.title, inserted: 0 })
        continue
      }

      const { error: insertErr } = await admin.from("korean_phrases").insert(toInsert)
      if (insertErr) {
        errors.push(`${drama.title}: ${insertErr.message}`)
        details.push({ drama: drama.title, inserted: 0 })
        continue
      }

      generated += toInsert.length
      details.push({ drama: drama.title, inserted: toInsert.length })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${drama.title}: ${msg}`)
      details.push({ drama: drama.title, inserted: 0 })
    }
  }

  return {
    source: "ingest-korean-phrases",
    total_dramas: dramas.length,
    scanned: candidates.length,
    generated,
    skipped,
    unknown_dramas: unknownDramas,
    errors,
    details,
  }
}

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
