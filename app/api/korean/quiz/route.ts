import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getSeoulDateString } from "@/lib/korean/day-helpers"

// /api/korean/quiz — 현재 보고 있는 표현 기준 4지선다 퀴즈
//
// GET:
//   1. 정답 phrase 결정:
//      a. ?phrase_id=<uuid> 가 있으면 그 phrase 사용 (프론트의 현재 표현 기준)
//      b. 없으면 오늘 featured phrase fallback (backwards compat)
//      c. 둘 다 실패 시 HARDCODED_CORRECT ("안녕하세요" / "Hello")
//   2. korean_phrases 중 정답 외 3개 랜덤 선택 (오답)
//   3. 4개 옵션 셔플 + 정답 인덱스 박제
//   4. 응답: { phraseId, korean, options: [{label, english}], correctLabel }
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

// 퀴즈 오답 fallback — korean_phrases DB 가 부족할 때 (1건뿐 / 0건) 사용.
// phrase-of-day 가 fallback phrase 도 DB upsert 하지만, quiz 가 독립적으로 동작하도록 보강.
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

// 오늘 phrase 조차 없을 때 사용할 정답 — buildFallbackKoreanPhrase 와 동일 내용 박제.
// 별도 import 없이 self-contained 유지 (퀴즈가 phrase-of-day 와 무관하게 동작).
const HARDCODED_CORRECT = {
  korean: "안녕하세요",
  english: "Hello",
}

// UUID v4 형식 검증 — fallback sentinel ("fallback-...") 같은 비-UUID 차단.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const today = getSeoulDateString()
  const url = new URL(request.url)
  const phraseIdParam = url.searchParams.get("phrase_id")

  // 1. 정답 phrase 결정 — 우선순위: phrase_id > 오늘 featured > HARDCODED_CORRECT
  let correct: { id: string; korean: string; english: string } | null = null

  if (phraseIdParam && UUID_REGEX.test(phraseIdParam)) {
    const { data: byId, error: idErr } = await supabase
      .from("korean_phrases")
      .select("id, korean, english")
      .eq("id", phraseIdParam)
      .maybeSingle()
    if (idErr) {
      console.warn(
        `[/api/korean/quiz] phrase_id 쿼리 실패 code=${idErr.code} message=${idErr.message} — featured fallback 시도`
      )
    }
    if (byId) {
      correct = byId as { id: string; korean: string; english: string }
    }
  }

  if (!correct) {
    // featured fallback — phrase_id 없거나 매칭 안 된 경우
    const { data: featured, error: fErr } = await supabase
      .from("korean_phrases")
      .select("id, korean, english")
      .eq("featured_date", today)
      .maybeSingle()
    if (fErr) {
      console.warn(
        `[/api/korean/quiz] featured 쿼리 실패 code=${fErr.code} message=${fErr.message} — hardcoded correct 로 응답`
      )
    }
    if (featured) {
      correct = featured as { id: string; korean: string; english: string }
    }
  }

  if (!correct) {
    correct = { id: `fallback-${today}`, ...HARDCODED_CORRECT }
  }

  // 2. 오답 3개 — featured 와 다른 phrase 에서 랜덤 선택.
  //    correct.id 가 fallback sentinel 이면 UUID 컬럼 .neq 가 400 → 풀 쿼리 자체 스킵.
  //    풀이 부족하면 FALLBACK_DISTRACTORS 에서 보충.
  const isFallbackCorrect = correct.id.startsWith("fallback-")
  let pool: string[] = []
  if (!isFallbackCorrect) {
    const { data: poolRows } = await supabase
      .from("korean_phrases")
      .select("english")
      .neq("id", correct.id)
      .limit(50)
    pool = ((poolRows ?? []) as Array<{ english: string }>)
      .map((r) => r.english)
      .filter((s, i, arr) => s && arr.indexOf(s) === i) // unique
  }

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

// phraseId 는 DB UUID 또는 "fallback-YYYY-MM-DD" sentinel 둘 다 허용.
// sentinel 인 경우 user_quiz_results FK 위반을 피해 insert skip.
const PostSchema = z.object({
  phraseId: z.string().min(1),
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

  if (parsed.data.phraseId.startsWith("fallback-")) {
    return NextResponse.json({ ok: true, skipped: "fallback_phrase" })
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
