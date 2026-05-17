import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { generateKoreanPhrase } from "@/lib/claude/korean-phrase"
import { pickFamousDramaByDayOfYear } from "@/lib/korean/famous-dramas"
import { getSeoulDateString, getSeoulDayOfYear } from "@/lib/korean/day-helpers"
import { mapKoreanPhraseRow, type KoreanPhraseApi } from "@/lib/korean/mapper"
import { buildFallbackKoreanPhrase } from "@/lib/korean/fallback-phrase"

// GET /api/korean/phrase-of-day — 오늘의 학습 표현 (비로그인 허용)
//
// 동작:
//   1. Asia/Seoul 기준 오늘 날짜 + dayOfYear 계산
//   2. korean_phrases.featured_date == 오늘 row 존재 시 즉시 반환 (DB 캐시 hit)
//   3. miss → 오늘의 드라마 선택 → Claude Haiku 생성 → DB INSERT/UPDATE → 반환
//   4. Claude 호출 실패 / API 키 누락 시 fallback 표현으로 DB write (sentinel id 가 아닌
//      실제 UUID 반환) → grammar / quiz / streak 등 phrase_id 가 UUID 라고 가정하는 API
//      가 정상 동작.
//   5. dramas 테이블에서 영문/한글 제목 일치 row 찾으면 drama_id 매핑
//
// 멱등성: 명시적 SELECT → INSERT/UPDATE 패턴 + race 시 UPDATE 재시도 (PostgREST upsert 는
//        partial unique index 와 호환되지 않아 사용 불가 — 본 파일 §4 주석 참조).

export const dynamic = "force-dynamic"

interface PhraseRowInsert {
  drama_id: string | null
  drama_name: string
  korean: string
  romanization: string | null
  english: string
  word_breakdown: Array<{ word: string; romanization: string; meaning: string }>
  synonyms: string[]
  antonyms: string[]
  difficulty: "beginner" | "intermediate" | "advanced"
  featured_date: string
}

const PHRASE_SELECT =
  "id, drama_id, drama_name, korean, romanization, english, word_breakdown, synonyms, antonyms, difficulty, audio_url, featured_date, created_at"

// PostgrestError 의 모든 필드를 단일 문자열로 압축 — 디버깅 정보 손실 없이
// console + response detail 양쪽에 동일 포맷으로 노출.
function formatPgError(
  err: { code?: string; message?: string; details?: string | null; hint?: string | null }
): string {
  return [
    `code=${err.code ?? "?"}`,
    `message=${err.message ?? "?"}`,
    err.details ? `details=${err.details}` : null,
    err.hint ? `hint=${err.hint}` : null,
  ]
    .filter(Boolean)
    .join(" ")
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const today = getSeoulDateString()

  // 1. 캐시 hit
  const { data: cached, error: cacheErr } = await supabase
    .from("korean_phrases")
    .select(PHRASE_SELECT)
    .eq("featured_date", today)
    .maybeSingle()
  if (cacheErr) {
    console.warn(
      `[/api/korean/phrase-of-day] 캐시 조회 실패 code=${cacheErr.code} message=${cacheErr.message}`
    )
  }
  if (cached) {
    const phrase: KoreanPhraseApi = mapKoreanPhraseRow(cached)
    return NextResponse.json({ phrase, cached: true })
  }

  // 2. miss → 오늘의 드라마 선택 + Claude 생성
  const dayOfYear = getSeoulDayOfYear()
  const drama = pickFamousDramaByDayOfYear(dayOfYear)

  let insertRow: PhraseRowInsert
  let fallback = false
  let reason: string | null = null
  let detail: string | null = null
  let generatedPayload: Awaited<ReturnType<typeof generateKoreanPhrase>> | null = null

  const hasApiKey = !!process.env.ANTHROPIC_API_KEY
  if (!hasApiKey) {
    console.error(
      "[/api/korean/phrase-of-day] ANTHROPIC_API_KEY 누락 — fallback 표현으로 upsert"
    )
    fallback = true
    reason = "missing_api_key"
  } else {
    generatedPayload = await generateKoreanPhrase({ dramaKo: drama.ko, dramaEn: drama.en })
    if (!generatedPayload.ok) {
      console.error(
        `[/api/korean/phrase-of-day] generation_failed reason=${generatedPayload.reason} detail=${generatedPayload.detail ?? "(none)"} dramaKo=${drama.ko} dramaEn=${drama.en} — fallback 표현으로 upsert`
      )
      fallback = true
      reason = generatedPayload.reason
      detail = generatedPayload.detail ?? null
    }
  }

  if (fallback) {
    // fallback 표현을 DB upsert — phrase_id 가 실제 UUID 가 되도록.
    // drama 컬럼은 빈 값으로 두어 추후 cron / 어드민이 정상 표현으로 교체할 수 있게.
    const fb = buildFallbackKoreanPhrase(today)
    insertRow = {
      drama_id: null,
      drama_name: fb.dramaName ?? "K-drama",
      korean: fb.korean,
      romanization: fb.romanization,
      english: fb.english,
      word_breakdown: fb.wordBreakdown,
      synonyms: fb.synonyms,
      antonyms: fb.antonyms,
      difficulty: fb.difficulty ?? "beginner",
      featured_date: today,
    }
  } else {
    // 3. dramas 테이블에서 매칭 — title / title_ko / original_name 순차 ilike
    //    .or() string syntax 는 apostrophe·comma 가 들어간 드라마명에 취약 → 개별 쿼리.
    const admin = createSupabaseAdminClient()
    let dramaId: string | null = null
    const tryMatch = async (col: "title" | "title_ko" | "original_name", value: string) => {
      if (dramaId) return
      const { data } = await admin.from("dramas").select("id").ilike(col, value).limit(1)
      if (Array.isArray(data) && data.length > 0) {
        dramaId = (data[0] as { id: string }).id
      }
    }
    await tryMatch("title", drama.en)
    await tryMatch("title_ko", drama.ko)
    await tryMatch("original_name", drama.ko)

    // generatedPayload.ok = true 가 보장됨 (위 branch 에서 fallback=false 인 경우만 도달)
    if (!generatedPayload || !generatedPayload.ok) {
      // 도달 불가 — 타입 가드용
      throw new Error("unreachable: generated payload missing in non-fallback branch")
    }
    const g = generatedPayload.payload
    insertRow = {
      drama_id: dramaId,
      drama_name: drama.en,
      korean: g.korean,
      romanization: g.romanization,
      english: g.english,
      word_breakdown: g.word_breakdown,
      synonyms: g.synonyms,
      antonyms: g.antonyms,
      difficulty: g.difficulty,
      featured_date: today,
    }
  }

  // 4. INSERT or UPDATE — 명시적 SELECT → INSERT/UPDATE 패턴 (service_role 로 RLS 우회).
  //
  // ⚠️ upsert(onConflict: "featured_date") 사용 금지:
  //    featured_date 의 unique index 가 partial (WHERE featured_date IS NOT NULL) 인데,
  //    PostgREST 의 on_conflict 는 WHERE 절을 spell out 못 함 → PG 가 매칭 index 못 찾아
  //    42P10 "no unique or exclusion constraint matching the ON CONFLICT specification" 에러.
  //    (첫 INSERT 는 충돌 없어 통과, 두 번째 이후만 실패하던 silent 버그)
  const admin = createSupabaseAdminClient()

  const { data: existing, error: existingErr } = await admin
    .from("korean_phrases")
    .select("id")
    .eq("featured_date", today)
    .maybeSingle()
  if (existingErr) {
    const errDetail = formatPgError(existingErr)
    console.error(
      `[/api/korean/phrase-of-day] existing row 조회 실패 ${errDetail} — sentinel fallback 응답`
    )
    return NextResponse.json({
      phrase: buildFallbackKoreanPhrase(today),
      cached: false,
      fallback: true,
      reason: "select_failed",
      detail: errDetail,
    })
  }

  let inserted: unknown = null
  let insertErr: { code?: string; message?: string; details?: string | null; hint?: string | null } | null = null

  if (existing) {
    // 기존 row 있음 → UPDATE (콘텐츠 갱신)
    const { data, error } = await admin
      .from("korean_phrases")
      .update(insertRow)
      .eq("id", (existing as { id: string }).id)
      .select(PHRASE_SELECT)
      .single()
    inserted = data
    insertErr = error
    if (!error) {
      console.log(
        `[/api/korean/phrase-of-day] UPDATE 경로 id=${(existing as { id: string }).id} korean=${insertRow.korean}`
      )
    }
  } else {
    // 신규 → INSERT
    const insertResult = await admin
      .from("korean_phrases")
      .insert(insertRow)
      .select(PHRASE_SELECT)
      .single()
    inserted = insertResult.data
    insertErr = insertResult.error

    // 동시 요청 race — 다른 트랜잭션이 이미 같은 featured_date 로 insert 한 경우 (23505).
    // 이 경우 UPDATE 로 재시도해 최신 콘텐츠로 갱신.
    if (insertErr && insertErr.code === "23505") {
      console.warn(
        `[/api/korean/phrase-of-day] INSERT race detected (23505) — UPDATE 재시도`
      )
      const retry = await admin
        .from("korean_phrases")
        .update(insertRow)
        .eq("featured_date", today)
        .select(PHRASE_SELECT)
        .single()
      inserted = retry.data
      insertErr = retry.error
    }

    if (!insertErr) {
      console.log(`[/api/korean/phrase-of-day] INSERT 경로 korean=${insertRow.korean}`)
    }
  }

  if (insertErr || !inserted) {
    // DB write 마저 실패하면 마지막 안전망: sentinel id 로 응답 (grammar/quiz 는 sentinel
    // 가드로 skip 됨). 빈 화면만은 막는다.
    const errDetail = insertErr ? formatPgError(insertErr) : "no row returned"
    console.error(
      `[/api/korean/phrase-of-day] write 실패 ${errDetail} insertRow.featured_date=${insertRow.featured_date} — sentinel fallback 응답`
    )
    return NextResponse.json({
      phrase: buildFallbackKoreanPhrase(today),
      cached: false,
      fallback: true,
      reason: "upsert_failed",
      detail: errDetail,
    })
  }

  const phrase: KoreanPhraseApi = mapKoreanPhraseRow(inserted)
  return NextResponse.json({
    phrase,
    cached: false,
    ...(fallback ? { fallback: true, reason, detail } : {}),
  })
}
