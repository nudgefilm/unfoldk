import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// POST /api/korean/learning-progress
//   body: { phraseId: string, status?: "new" | "learning" | "mastered" }
//   본인 user 의 phrase 학습 상태 upsert. Got it 클릭 시 status='mastered' 기록.
//   페이지 재진입 시 phrase-of-day GET 이 본 row 를 참조해 동일 표현 재노출을 막음.
//
// 비-UUID phrase_id (fallback sentinel 등) 은 skip 응답 — idempotent.

export const dynamic = "force-dynamic"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALLOWED_STATUS = ["new", "learning", "mastered"] as const
type LearningStatus = (typeof ALLOWED_STATUS)[number]

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  let body: { phraseId?: string; status?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const phraseId = body.phraseId
  if (!phraseId || !UUID_REGEX.test(phraseId)) {
    return NextResponse.json({ skipped: true, reason: "non_uuid_phrase_id" })
  }

  const status: LearningStatus =
    body.status && (ALLOWED_STATUS as readonly string[]).includes(body.status)
      ? (body.status as LearningStatus)
      : "mastered"

  const { error } = await supabase
    .from("user_learning_progress")
    .upsert(
      {
        user_id: user.id,
        phrase_id: phraseId,
        status,
        last_studied_at: new Date().toISOString(),
      },
      { onConflict: "user_id,phrase_id" }
    )
  if (error) {
    console.error(
      `[/api/korean/learning-progress POST] upsert 실패 code=${error.code} message=${error.message}`
    )
    return NextResponse.json(
      { error: "upsert_failed", message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, phraseId, status })
}

// DELETE /api/korean/learning-progress
//   body: { phraseId: string }
//   user_learning_progress 에서 해당 row 삭제 (Learning Progress 목록에서 제거).
export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  let body: { phraseId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const phraseId = body.phraseId
  if (!phraseId || !UUID_REGEX.test(phraseId)) {
    return NextResponse.json({ skipped: true, reason: "non_uuid_phrase_id" })
  }

  const { error } = await supabase
    .from("user_learning_progress")
    .delete()
    .eq("user_id", user.id)
    .eq("phrase_id", phraseId)

  if (error) {
    console.error(
      `[/api/korean/learning-progress DELETE] 삭제 실패 code=${error.code} message=${error.message}`
    )
    return NextResponse.json(
      { error: "delete_failed", message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, phraseId })
}
