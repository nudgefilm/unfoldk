import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// 계정 영구 삭제 — auth.users cascade → public.users + 관련 테이블 자동 삭제
export async function POST() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createSupabaseAdminClient()
  const { error } = await admin.auth.admin.deleteUser(user.id)

  if (error) {
    console.error("[account/delete] 삭제 실패:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
