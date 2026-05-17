import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { hasProAccess } from "@/lib/auth/plan"
import { generateGrammarExplanation } from "@/lib/claude/korean-phrase"

// POST /api/korean/grammar — Pro 전용 AI 문법 설명 (Phase 1)
//
// body: { phraseId }
// 동작:
//   1. 로그인 + Pro 검증
//   2. grammar_explanations 캐시 hit → 즉시 반환
//   3. miss → korean_phrases 조회 → Claude Haiku 생성 → DB 저장
// 응답:
//   - { explanation: string, cached: boolean }
//   - 403: not_pro / 404: phrase_not_found / 422: generation_failed

const MODEL = "claude-haiku-4-5"
export const dynamic = "force-dynamic"

const PostSchema = z.object({
  phraseId: z.string().uuid(),
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
    .select("plan_type, is_admin")
    .eq("id", user.id)
    .maybeSingle()
  const row = profile as { plan_type?: string; is_admin?: boolean } | null
  if (!hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin })) {
    return NextResponse.json({ error: "not_pro" }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 }
    )
  }
  const phraseId = parsed.data.phraseId

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
    return NextResponse.json(
      { error: "query_failed", message: pErr.message },
      { status: 500 }
    )
  }
  if (!phrase) {
    return NextResponse.json({ error: "phrase_not_found" }, { status: 404 })
  }
  const p = phrase as { korean: string; english: string; difficulty: string | null }

  // 3. Claude 생성
  const explanation = await generateGrammarExplanation(
    p.korean,
    p.english,
    p.difficulty ?? "beginner"
  )
  if (!explanation) {
    return NextResponse.json(
      { error: "generation_failed", message: "Could not generate grammar explanation." },
      { status: 422 }
    )
  }

  // 4. 캐시 저장 — admin client
  const admin = createSupabaseAdminClient()
  const { error: insErr } = await admin
    .from("grammar_explanations")
    .upsert(
      { phrase_id: phraseId, explanation, model: MODEL },
      { onConflict: "phrase_id" }
    )
  if (insErr) {
    console.warn("[/api/korean/grammar] 캐시 저장 실패:", insErr.message)
  }

  return NextResponse.json({ explanation, cached: false })
}
