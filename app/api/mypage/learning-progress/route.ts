import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// GET /api/mypage/learning-progress
// 유저가 "Got it" 클릭한 (mastered) 표현 목록
// 로직: user_learning_progress (status=mastered) → korean_phrases 조인

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

  const { data, error } = await supabase
    .from("user_learning_progress")
    .select("phrase_id, last_studied_at, korean_phrases!inner(korean, romanization, english, difficulty, drama_name)")
    .eq("user_id", user.id)
    .eq("status", "mastered")
    .order("last_studied_at", { ascending: false })

  if (error) {
    console.error("[/api/mypage/learning-progress] 조회 실패:", error.message)
    return NextResponse.json({ phrases: [] })
  }

  type Row = {
    phrase_id: string
    last_studied_at: string
    korean_phrases: {
      korean: string
      romanization: string | null
      english: string
      difficulty: string | null
      drama_name: string | null
    } | null
  }

  const phrases: LearnedPhrase[] = ((data ?? []) as Row[])
    .filter((r) => r.korean_phrases)
    .map((r) => ({
      phrase_id: r.phrase_id,
      korean: r.korean_phrases!.korean,
      romanization: r.korean_phrases!.romanization,
      english: r.korean_phrases!.english,
      difficulty: r.korean_phrases!.difficulty,
      drama_name: r.korean_phrases!.drama_name,
      last_studied_at: r.last_studied_at,
    }))

  return NextResponse.json({ phrases })
}
