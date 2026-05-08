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

  // ⚠️ users 테이블 직접 select 대신 SECURITY DEFINER RPC 사용
  //    0005 admin 정책의 users self-reference 로 RLS 평가가 재귀에 빠져
  //    관리자도 null 로 읽히는 문제를 회피 — 0006 의 public.is_admin(uid) 함수 호출.
  const { data: isAdminUser, error } = await supabase.rpc("is_admin", {
    uid: user.id,
  })

  if (error || !isAdminUser) {
    return { ok: false, reason: "forbidden" }
  }

  return { ok: true, userId: user.id }
}
