import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// GET /api/mypage/learning-debug — 어드민 전용 진단
// Save phrase / Got it 저장 상태를 원시 데이터로 확인.
// 완료 후 라우트 삭제 예정.

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  const admin = createSupabaseAdminClient()

  // 1. 유저 확인
  const { data: userRow } = await admin
    .from("users")
    .select("id, email, plan_type")
    .eq("id", user.id)
    .maybeSingle()

  // 2. user_learning_progress 전체 (status 무관)
  const { data: allProgress, error: allProgressError } = await admin
    .from("user_learning_progress")
    .select("phrase_id, status, last_studied_at")
    .eq("user_id", user.id)
    .order("last_studied_at", { ascending: false })
    .limit(20)

  // 3. mastered 만 필터
  const { data: masteredProgress, error: masteredError } = await admin
    .from("user_learning_progress")
    .select("phrase_id, last_studied_at")
    .eq("user_id", user.id)
    .eq("status", "mastered")

  // 4. mastered phrase_id 가 korean_phrases 에 실제로 존재하는지
  const masteredIds = (masteredProgress ?? []).map((r: { phrase_id: string }) => r.phrase_id)
  let phraseCheck: unknown[] = []
  if (masteredIds.length > 0) {
    const { data } = await admin
      .from("korean_phrases")
      .select("id, korean, featured_date")
      .in("id", masteredIds)
    phraseCheck = data ?? []
  }

  return NextResponse.json({
    authUserId: user.id,
    publicUserRow: userRow,
    allProgress: allProgress ?? [],
    allProgressError: allProgressError?.message ?? null,
    masteredProgress: masteredProgress ?? [],
    masteredError: masteredError?.message ?? null,
    masteredPhraseIdsCount: masteredIds.length,
    phraseCheckCount: phraseCheck.length,
    phraseCheck,
  })
}
