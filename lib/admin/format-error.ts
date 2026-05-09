import type { PostgrestError } from "@supabase/supabase-js"

// PostgrestError 는 Error 서브클래스라 JSON.stringify 시 message 만 노출됨.
// code/hint/details 를 함께 합쳐 진단성을 끌어올리는 공통 포맷터.
//
// 사용처: 어드민 페이지 RSC loader 가 service_role 쿼리 실패 시 화면 배너에 노출.
//        2026-05-09 인시던트(/admin/users 가 403 을 0행으로 마스킹)이 계기.
export function formatPostgrestError(
  error: PostgrestError | null | undefined
): string {
  if (!error) return "알 수 없는 오류"
  const detail = [error.code, error.message, error.hint]
    .filter((v) => v !== null && v !== undefined && String(v).trim().length > 0)
    .join(" / ")
  return (
    detail ||
    "Supabase 응답에 메시지 없음 (보통 권한/네트워크 이슈 — 서버 콘솔 확인)"
  )
}
