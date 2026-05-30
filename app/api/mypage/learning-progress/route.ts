import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// GET /api/mypage/learning-progress
// 유저가 "Save phrase" / "Got it" 클릭한 (mastered) 표현 목록
// 로직: user_learning_progress (status=mastered) → korean_phrases 개별 조회 (2단계)

export const dynamic = "force-dynamic"

export interface LearnedPhrase {
  phrase_id: string
  korean: string
  romanization: string | null
  english: string
  difficulty: string | null
  drama_name: string | null
  last_studied_at: string
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  const admin = createSupabaseAdminClient()

  // Step 1: 유저의 mastered 진도 행 전체
  const { data: progressRows, error: progressError } = await admin
    .from("user_learning_progress")
    .select("phrase_id, last_studied_at")
    .eq("user_id", user.id)
    .eq("status", "mastered")
    .order("last_studied_at", { ascending: false })

  if (progressError) {
    console.error("[/api/mypage/learning-progress] step1 실패:", progressError.message)
    return NextResponse.json({ phrases: [], _debug: { step: 1, error: progressError.message } })
  }

  const rows = (progressRows ?? []) as { phrase_id: string; last_studied_at: string }[]

  // 진도 0건 → 빈 목록 즉시 반환
  if (rows.length === 0) {
    return NextResponse.json({ phrases: [], _debug: { step: 1, count: 0 } })
  }

  const phraseIds = rows.map((r) => r.phrase_id)

  // Step 2: phrase_id 로 korean_phrases 배치 조회
  const { data: phraseRows, error: phraseError } = await admin
    .from("korean_phrases")
    .select("id, korean, romanization, english, difficulty, drama_name")
    .in("id", phraseIds)

  if (phraseError) {
    console.error("[/api/mypage/learning-progress] step2 실패:", phraseError.message)
    return NextResponse.json({ phrases: [], _debug: { step: 2, error: phraseError.message } })
  }

  type PhraseRow = {
    id: string
    korean: string
    romanization: string | null
    english: string
    difficulty: string | null
    drama_name: string | null
  }

  const phraseMap = new Map(
    ((phraseRows ?? []) as PhraseRow[]).map((p) => [p.id, p])
  )

  // Step 1 순서(last_studied_at desc) 유지하며 병합
  const phrases: LearnedPhrase[] = rows
    .map((r) => {
      const p = phraseMap.get(r.phrase_id)
      if (!p) return null
      return {
        phrase_id: r.phrase_id,
        korean: p.korean,
        romanization: p.romanization,
        english: p.english,
        difficulty: p.difficulty,
        drama_name: p.drama_name,
        last_studied_at: r.last_studied_at,
      }
    })
    .filter((x): x is LearnedPhrase => x !== null)

  return NextResponse.json({
    phrases,
    _debug: {
      userId: user.id,
      progressCount: rows.length,
      phraseCount: phraseRows?.length ?? 0,
      returnedCount: phrases.length,
    },
  })
}
