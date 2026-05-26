import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { hasProAccess } from "@/lib/auth/plan"
import { generateGrammarExplanation } from "@/lib/claude/korean-phrase"

// POST /api/korean/grammar — Pro 전용 AI 문법 설명 (Phase 1)
//
// body: { phraseId }  — UUID 또는 "fallback-YYYY-MM-DD" sentinel.
// 동작:
//   1. 로그인 + Pro 검증
//   2. sentinel id 면 즉시 422 (fallback phrase 는 DB 에 없거나 임시 row — 문법 분석 의미 없음)
//   3. grammar_explanations 캐시 hit → 즉시 반환
//   4. miss → korean_phrases 조회 → Claude Haiku 생성 → DB 저장
// 응답:
//   - { explanation: string, cached: boolean }
//   - 403: not_pro / 404: phrase_not_found / 422: generation_failed(+ reason, detail)

const MODEL = "claude-haiku-4-5"
export const dynamic = "force-dynamic"

// phraseId 는 UUID 또는 sentinel — 둘 다 허용하고 본문에서 분기.
const PostSchema = z.object({
  phraseId: z.string().min(1),
})

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("plan_type, is_admin, trial_ends_at")
    .eq("id", user.id)
    .maybeSingle()
  const row = profile as { plan_type?: string; is_admin?: boolean; trial_ends_at?: string | null } | null
  if (!hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin, trialEndsAt: row?.trial_ends_at })) {
    return NextResponse.json({ error: "not_pro" }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    console.error(
      `[/api/korean/grammar] invalid_body issues=${JSON.stringify(parsed.error.issues)} received=${JSON.stringify(body).slice(0, 200)}`
    )
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues, received: body },
      { status: 400 }
    )
  }
  const phraseId = parsed.data.phraseId
  console.log(`[/api/korean/grammar] phraseId 수신=${phraseId} user=${user.id}`)

  // fallback sentinel — phrase 가 실제 DB row 가 아니라 임시 자리채움.
  // 문법 분석은 의미 없음 + grammar_explanations FK 도 위반. 명확한 reason 으로 422 응답.
  if (phraseId.startsWith("fallback-")) {
    return NextResponse.json(
      {
        error: "fallback_phrase",
        message:
          "Today's phrase is a fallback. AI grammar will be available once the real phrase is generated.",
      },
      { status: 422 }
    )
  }

  // 1. 캐시 hit (Pro RLS 통과)
  const { data: cached } = await supabase
    .from("grammar_explanations")
    .select("explanation")
    .eq("phrase_id", phraseId)
    .maybeSingle()
  if (cached) {
    return NextResponse.json({
      explanation: (cached as { explanation: string }).explanation,
      cached: true,
    })
  }

  // 2. korean_phrase 조회
  const { data: phrase, error: pErr } = await supabase
    .from("korean_phrases")
    .select("korean, english, difficulty")
    .eq("id", phraseId)
    .maybeSingle()
  if (pErr) {
    console.error(
      `[/api/korean/grammar] korean_phrases 조회 실패 code=${pErr.code} message=${pErr.message} phraseId=${phraseId}`
    )
    return NextResponse.json(
      { error: "query_failed", message: pErr.message },
      { status: 500 }
    )
  }
  if (!phrase) {
    console.warn(`[/api/korean/grammar] phrase_not_found phraseId=${phraseId}`)
    return NextResponse.json({ error: "phrase_not_found", phraseId }, { status: 404 })
  }
  const p = phrase as { korean: string; english: string; difficulty: string | null }

  // 3. Claude 생성
  const result = await generateGrammarExplanation(
    p.korean,
    p.english,
    p.difficulty ?? "beginner"
  )
  if (!result.ok) {
    console.error(
      `[/api/korean/grammar] generation_failed reason=${result.reason} detail=${result.detail ?? "(none)"} phraseId=${phraseId} korean=${p.korean}`
    )
    return NextResponse.json(
      {
        error: "generation_failed",
        reason: result.reason,
        detail: result.detail ?? null,
        message: "Could not generate grammar explanation.",
      },
      { status: 422 }
    )
  }

  // 4. 캐시 저장 — admin client
  const admin = createSupabaseAdminClient()
  const { error: insErr } = await admin
    .from("grammar_explanations")
    .upsert(
      { phrase_id: phraseId, explanation: result.text, model: MODEL },
      { onConflict: "phrase_id" }
    )
  if (insErr) {
    console.warn(
      `[/api/korean/grammar] 캐시 저장 실패 code=${insErr.code} message=${insErr.message}`
    )
  }

  return NextResponse.json({ explanation: result.text, cached: false })
}
