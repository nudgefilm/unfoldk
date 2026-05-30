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
// 두 가지 모드:
//   A. 기본 (쿼리 파라미터 없음) — 오늘의 featured 표현 반환
//      1. Asia/Seoul 기준 오늘 날짜 + dayOfYear 계산
//      2. korean_phrases.featured_date == 오늘 row 존재 시 즉시 반환 (DB 캐시 hit)
//      3. 로그인 유저 + 오늘 featured 가 user_learning_progress.status='mastered' 면
//         자동으로 모드 B (mastered 제외 랜덤) 로 우회 — 같은 표현 재노출 방지.
//      4. miss → 오늘의 드라마 선택 → Claude Haiku 생성 → DB INSERT/UPDATE → 반환
//      5. Claude 호출 실패 / API 키 누락 시 fallback 표현으로 DB write (sentinel id 가 아닌
//         실제 UUID 반환) → grammar / quiz / streak 등 phrase_id 가 UUID 라고 가정하는 API
//         가 정상 동작.
//
//   B. 랜덤 (?exclude_ids=uuid1,uuid2,...) — 세션 이력에 없는 임의 표현 1건 반환
//      1. 로그인 유저면 본인 mastered phrase id 도 exclude_ids 에 자동 머지
//      2. korean_phrases 전체에서 exclude_ids 제외 후 50개 풀 fetch
//      3. JS 측에서 랜덤 1개 picker
//      4. 모두 소진 시 { phrase: null, exhausted: true } 응답 — 프론트가 이력 리셋
//
// 멱등성: 모드 A 는 명시적 SELECT → INSERT/UPDATE 패턴 + race 시 UPDATE 재시도
//        (PostgREST upsert 는 partial unique index 와 호환되지 않아 사용 불가 — 본 파일 §4 주석 참조).

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
  "id, drama_id, drama_name, korean, romanization, english, word_breakdown, synonyms, antonyms, difficulty, audio_url, image_url, scene_description, featured_date, created_at"

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

// UUID v4 형식 검증 — exclude_ids 에서 fallback sentinel ("fallback-...") 같은 비-UUID 제거 용도.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 로그인 유저 플랜 판정 — plan_type·subscription_status·is_admin 조회.
// 비로그인 또는 DB 조회 실패 시 { isPro: false } 안전 처리.
async function getUserPlan(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<{ isPro: boolean }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { isPro: false }
  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from("users")
    .select("plan_type, subscription_status, is_admin")
    .eq("id", user.id)
    .maybeSingle()
  if (!data) return { isPro: false }
  const row = data as {
    plan_type: string | null
    subscription_status: string | null
    is_admin: boolean | null
  }
  return {
    isPro:
      row.is_admin === true ||
      ((row.plan_type === "monthly" || row.plan_type === "annual") &&
        row.subscription_status === "active"),
  }
}

// 로그인 유저의 mastered phrase id 목록을 조회.
// 비로그인이면 빈 배열. user_learning_progress 미존재 / RLS 차단 시도 빈 배열로 안전 처리.
async function getMasteredPhraseIds(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<string[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from("user_learning_progress")
    .select("phrase_id")
    .eq("user_id", user.id)
    .eq("status", "mastered")
  if (error) {
    console.warn(
      `[/api/korean/phrase-of-day] mastered 조회 실패 code=${error.code} message=${error.message}`
    )
    return []
  }
  return (data ?? [])
    .map((r) => (r as { phrase_id: string }).phrase_id)
    .filter((id) => UUID_REGEX.test(id))
}

// 모드 B — exclude_ids 제외 랜덤 1건 반환. 풀 limit 50 → JS Math.random pick.
// extraExcludeIds: 호출자가 추가로 제외할 id 목록 (로그인 유저의 mastered 등).
async function pickRandomPhrase(
  excludeIdsParam: string,
  extraExcludeIds: string[] = []
): Promise<NextResponse> {
  const explicit = excludeIdsParam
    .split(",")
    .map((s) => s.trim())
    .filter((s) => UUID_REGEX.test(s))
  const excludeIds = Array.from(
    new Set([...explicit, ...extraExcludeIds.filter((s) => UUID_REGEX.test(s))])
  )

  const supabase = await createSupabaseServerClient()
  let query = supabase
    .from("korean_phrases")
    .select(PHRASE_SELECT)
    .limit(50)
  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`)
  }

  const { data, error } = await query
  if (error) {
    console.error(
      `[/api/korean/phrase-of-day random] 조회 실패 ${formatPgError(error)}`
    )
    return NextResponse.json(
      { error: "query_failed", message: error.message },
      { status: 500 }
    )
  }

  const rows = (data ?? []) as unknown[]
  if (rows.length === 0) {
    return NextResponse.json({ phrase: null, exhausted: true, random: true })
  }

  const picked = rows[Math.floor(Math.random() * rows.length)]
  const phrase: KoreanPhraseApi = mapKoreanPhraseRow(picked)
  return NextResponse.json({ phrase, cached: false, random: true })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const excludeIdsParam = url.searchParams.get("exclude_ids")
  const forcedPhraseId = url.searchParams.get("phrase_id")

  const supabase = await createSupabaseServerClient()
  // 로그인 유저의 mastered 목록은 모드 A·B 양쪽에서 사용 — 한 번 조회.
  const masteredIds = await getMasteredPhraseIds(supabase)

  // 모드 C: phrase_id 지정 — 마이페이지 "Continue Learning" 딥링크용.
  // UUID 검증 통과 시 해당 표현만 반환. 없으면 일반 모드로 fallthrough.
  if (forcedPhraseId && UUID_REGEX.test(forcedPhraseId)) {
    const { data } = await supabase
      .from("korean_phrases")
      .select(PHRASE_SELECT)
      .eq("id", forcedPhraseId)
      .maybeSingle()
    if (data) {
      return NextResponse.json({ phrase: mapKoreanPhraseRow(data as unknown), forced: true })
    }
  }

  // exclude_ids 파라미터가 있으면 (빈 문자열 포함) 랜덤 모드 — 명시적 opt-in.
  if (excludeIdsParam !== null) {
    // 결제 연동 후 아래 주석 해제 — Free 유저 하루 1개 게이팅 // 2026-05-16 임시 정책
    // const { isPro } = await getUserPlan(supabase)
    // if (!isPro) return NextResponse.json({ limited: true })
    return pickRandomPhrase(excludeIdsParam, masteredIds)
  }

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
    const cachedId = (cached as { id: string }).id
    // 로그인 유저 + 오늘 featured 가 이미 mastered → 미학습 랜덤 1건으로 자동 우회.
    // 페이지 재진입 시 같은 표현이 다시 노출되는 것을 막는다.
    if (masteredIds.includes(cachedId)) {
      return pickRandomPhrase("", masteredIds)
    }
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
