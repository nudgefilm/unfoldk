import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getSeoulDateString } from "@/lib/korean/day-helpers"

// /api/korean/quiz — 오늘의 표현 기준 4지선다 퀴즈
//
// GET:
//   1. 오늘 featured phrase 조회 (정답)
//   2. korean_phrases 중 정답 외 3개 랜덤 선택 (오답)
//   3. 4개 옵션 셔플 + 정답 인덱스 박제
//   4. 응답: { question, phraseId, options: [{label, english}], correctLabel }
// POST body: { phraseId, isCorrect }
//   - 로그인 유저만 — user_quiz_results insert

export const dynamic = "force-dynamic"

interface QuizOption {
  label: "A" | "B" | "C" | "D"
  english: string
}

interface QuizApi {
  phraseId: string
  korean: string
  options: QuizOption[]
  correctLabel: "A" | "B" | "C" | "D"
}

// 퀴즈 정답이 부족할 때 사용할 fallback 영문 의미 (DB 에 phrase 3개 미만일 때만)
const FALLBACK_DISTRACTORS = [
  "I love you",
  "Thank you",
  "Goodbye",
  "I'm sorry",
  "See you tomorrow",
  "Good morning",
  "How are you?",
  "It's beautiful",
]

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const today = getSeoulDateString()

  // 1. 오늘 phrase
  const { data: featured, error: fErr } = await supabase
    .from("korean_phrases")
    .select("id, korean, english")
    .eq("featured_date", today)
    .maybeSingle()

  if (fErr) {
    return NextResponse.json(
      { error: "query_failed", message: fErr.message },
      { status: 500 }
    )
  }
  if (!featured) {
    return NextResponse.json(
      { error: "no_phrase_today", message: "Today's phrase not yet generated." },
      { status: 404 }
    )
  }

  const correct = featured as { id: string; korean: string; english: string }

  // 2. 오답 3개 — featured 와 다른 phrase 에서 랜덤 선택
  //    `not.eq` 조건 + order rand() 흉내 — Supabase 의 rand() 직접 불가라 큰 풀에서 가져와 셔플
  const { data: poolRows } = await supabase
    .from("korean_phrases")
    .select("english")
    .neq("id", correct.id)
    .limit(50)
  const pool = ((poolRows ?? []) as Array<{ english: string }>)
    .map((r) => r.english)
    .filter((s, i, arr) => s && arr.indexOf(s) === i) // unique

  const distractors: string[] = []
  // 풀에서 우선 3개 추출 (셔플 후 앞 3)
  const shuffledPool = [...pool].sort(() => Math.random() - 0.5)
  for (const s of shuffledPool) {
    if (s !== correct.english && distractors.length < 3) distractors.push(s)
  }
  // fallback — 풀이 부족하면 정적 리스트에서 보충
  if (distractors.length < 3) {
    const shuffledFb = [...FALLBACK_DISTRACTORS].sort(() => Math.random() - 0.5)
    for (const s of shuffledFb) {
      if (distractors.length >= 3) break
      if (s !== correct.english && !distractors.includes(s)) distractors.push(s)
    }
  }

  // 3. 4개 셔플 + 정답 라벨 박제
  const all = [correct.english, ...distractors]
  const shuffled = all.map((v, i) => ({ v, k: Math.random(), origin: i })).sort(
    (a, b) => a.k - b.k
  )
  const labels: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"]
  const options: QuizOption[] = shuffled.map((s, i) => ({
    label: labels[i],
    english: s.v,
  }))
  const correctIdx = shuffled.findIndex((s) => s.origin === 0)
  const correctLabel = labels[correctIdx]

  const payload: QuizApi = {
    phraseId: correct.id,
    korean: correct.korean,
    options,
    correctLabel,
  }
  return NextResponse.json(payload)
}

const PostSchema = z.object({
  phraseId: z.string().uuid(),
  isCorrect: z.boolean(),
})

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const { error } = await supabase.from("user_quiz_results").insert({
    user_id: user.id,
    phrase_id: parsed.data.phraseId,
    is_correct: parsed.data.isCorrect,
  })
  if (error) {
    console.error("[/api/korean/quiz POST] insert 실패:", error)
    return NextResponse.json(
      { error: "insert_failed", message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
