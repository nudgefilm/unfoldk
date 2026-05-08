import { createSupabaseServerClient } from "@/lib/supabase/server"

// 어드민 권한 검증 결과
export type AdminAuthResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "unauthenticated" | "forbidden" }

// 서버 라우트 핸들러·서버 컴포넌트에서 호출 — 세션 + is_admin 동시 검증
export async function requireAdmin(): Promise<AdminAuthResult> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, reason: "unauthenticated" }
  }

  // RLS 우회 없이 본인 행만 조회 — users_select_own 정책으로 통과
  const { data, error } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (error || !data?.is_admin) {
    return { ok: false, reason: "forbidden" }
  }

  return { ok: true, userId: user.id }
}
