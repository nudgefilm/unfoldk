import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// /api/curation-k/course/[id] DELETE
//
// 본인 코스만 삭제 — RLS 정책 (0023 hallyu_courses_all_own) 가 auth.uid = user_id
// 체크. 다른 유저 코스 삭제 시도는 0행 affected.

export const dynamic = "force-dynamic"

// UUID 형식 sanitize — 잘못된 path param 으로 인한 supabase 에러 메시지 노출 차단
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  // RLS 가 본인 행만 매칭. 다른 유저 행 ID 로 호출 시 0행 affected.
  const { error, count } = await supabase
    .from("hallyu_courses")
    .delete({ count: "exact" })
    .eq("id", id)

  if (error) {
    console.error("[curation-k/course/delete] 실패:", error.message)
    return NextResponse.json(
      { error: "delete_failed", detail: error.message },
      { status: 500 }
    )
  }

  if ((count ?? 0) === 0) {
    // 본인 소유 아님 or 이미 삭제됨 — 양쪽 다 404 로 통일
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true, deleted_id: id })
}
