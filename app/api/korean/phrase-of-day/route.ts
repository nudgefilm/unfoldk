import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { generateKoreanPhrase } from "@/lib/claude/korean-phrase"
import { pickFamousDramaByDayOfYear } from "@/lib/korean/famous-dramas"
import { getSeoulDateString, getSeoulDayOfYear } from "@/lib/korean/day-helpers"
import { mapKoreanPhraseRow, type KoreanPhraseApi } from "@/lib/korean/mapper"

// GET /api/korean/phrase-of-day — 오늘의 학습 표현 (비로그인 허용)
//
// 동작:
//   1. Asia/Seoul 기준 오늘 날짜 + dayOfYear 계산
//   2. korean_phrases.featured_date == 오늘 row 존재 시 즉시 반환 (DB 캐시 hit)
//   3. miss → 오늘의 드라마 선택 → Claude Haiku 생성 → DB insert (featured_date=오늘) → 반환
//   4. dramas 테이블에서 영문/한글 제목 일치 row 찾으면 drama_id 매핑
//
// 멱등성: featured_date UNIQUE partial index 로 동시 요청 시 ON CONFLICT 처리.

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const today = getSeoulDateString()

  // 1. 캐시 hit
  const { data: cached, error: cacheErr } = await supabase
    .from("korean_phrases")
    .select(
      "id, drama_id, drama_name, korean, romanization, english, word_breakdown, synonyms, antonyms, difficulty, audio_url, featured_date, created_at"
    )
    .eq("featured_date", today)
    .maybeSingle()
  if (cacheErr) {
    console.warn("[/api/korean/phrase-of-day] 캐시 조회 실패:", cacheErr.message)
  }
  if (cached) {
    const phrase: KoreanPhraseApi = mapKoreanPhraseRow(cached)
    return NextResponse.json({ phrase, cached: true })
  }

  // 2. miss → 오늘의 드라마 선택 + Claude 생성
  const dayOfYear = getSeoulDayOfYear()
  const drama = pickFamousDramaByDayOfYear(dayOfYear)

  const generated = await generateKoreanPhrase({
    dramaKo: drama.ko,
    dramaEn: drama.en,
  })
  if (!generated) {
    return NextResponse.json(
      { error: "generation_failed", message: "Could not generate today's phrase." },
      { status: 500 }
    )
  }

  // 3. dramas 테이블에서 매칭 — title / title_ko / original_name 순차 ilike
  // .or() string syntax 는 apostrophe·comma 가 들어간 드라마명 (What's Wrong...) 에 취약
  // → 개별 쿼리로 안전 매칭 (실패 시 dramaId=null 허용)
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

  // 4. insert — ON CONFLICT featured_date 시 기존 row 사용 (race condition 방어)
  const insertRow = {
    drama_id: dramaId,
    drama_name: drama.en,
    korean: generated.korean,
    romanization: generated.romanization,
    english: generated.english,
    word_breakdown: generated.word_breakdown,
    synonyms: generated.synonyms,
    antonyms: generated.antonyms,
    difficulty: generated.difficulty,
    featured_date: today,
  }

  const { data: inserted, error: insertErr } = await admin
    .from("korean_phrases")
    .upsert(insertRow, { onConflict: "featured_date", ignoreDuplicates: false })
    .select(
      "id, drama_id, drama_name, korean, romanization, english, word_breakdown, synonyms, antonyms, difficulty, audio_url, featured_date, created_at"
    )
    .single()

  if (insertErr || !inserted) {
    console.error("[/api/korean/phrase-of-day] insert 실패:", insertErr)
    return NextResponse.json(
      { error: "insert_failed", message: insertErr?.message ?? "unknown" },
      { status: 500 }
    )
  }

  const phrase: KoreanPhraseApi = mapKoreanPhraseRow(inserted)
  return NextResponse.json({ phrase, cached: false })
}
