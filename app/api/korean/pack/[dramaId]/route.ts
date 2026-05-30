import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { mapKoreanPhraseRow, type KoreanPhraseApi } from "@/lib/korean/mapper"

// GET /api/korean/pack/[dramaId] — 드라마별 학습 표현 목록 (Drama Learning Pack 모달용)
//
// 응답: { drama: { id, title, titleKo, posterUrl } | null, phrases: KoreanPhraseApi[] }
//   - phrases 가 빈 배열이면 프론트에서 "Expressions coming soon" 표시
//   - drama row 가 없으면 drama=null + phrases=[]

export const dynamic = "force-dynamic"

const PHRASE_SELECT =
  "id, drama_id, drama_name, korean, romanization, english, word_breakdown, synonyms, antonyms, difficulty, audio_url, image_url, scene_description, featured_date, created_at"

interface DramaApi {
  id: string
  title: string
  titleKo: string | null
  posterUrl: string | null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dramaId: string }> }
) {
  const { dramaId } = await params
  if (!dramaId || dramaId.length < 1) {
    return NextResponse.json({ error: "invalid_drama_id" }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()

  // 1. 드라마 메타 조회 — 모달 헤더용
  const { data: dramaRow, error: dramaErr } = await supabase
    .from("dramas")
    .select("id, title, title_ko, poster_url")
    .eq("id", dramaId)
    .maybeSingle()

  if (dramaErr) {
    console.error("[/api/korean/pack] dramas 조회 실패:", dramaErr)
    return NextResponse.json(
      { error: "query_failed", message: dramaErr.message },
      { status: 500 }
    )
  }

  const drama: DramaApi | null = dramaRow
    ? {
        id: (dramaRow as { id: string }).id,
        title: (dramaRow as { title: string }).title,
        titleKo: (dramaRow as { title_ko: string | null }).title_ko,
        posterUrl: (dramaRow as { poster_url: string | null }).poster_url,
      }
    : null

  // 2. 표현 목록 조회 — drama_id 매칭. 난이도 → 생성순으로 정렬.
  const { data: phraseRows, error: phraseErr } = await supabase
    .from("korean_phrases")
    .select(PHRASE_SELECT)
    .eq("drama_id", dramaId)
    .order("difficulty", { ascending: true })
    .order("created_at", { ascending: true })

  if (phraseErr) {
    console.error("[/api/korean/pack] korean_phrases 조회 실패:", phraseErr)
    return NextResponse.json(
      { error: "query_failed", message: phraseErr.message },
      { status: 500 }
    )
  }

  const phrases: KoreanPhraseApi[] = ((phraseRows ?? []) as unknown[]).map(
    (row) => mapKoreanPhraseRow(row)
  )

  return NextResponse.json({ drama, phrases })
}
