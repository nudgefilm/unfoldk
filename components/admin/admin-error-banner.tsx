// 어드민 페이지 공통 — service_role 조회 실패 시 화면 상단에 노출하는 배너.
// 빈 배열 fallback 으로 0건처럼 보이는 사고(2026-05-09 인시던트) 를 막기 위해
// 모든 어드민 RSC loader 는 실패를 이 배너로 surface 한다.
//
// 디자인: 에러 직관성을 위해 Tailwind red 톤으로 통일 (브랜드 핑크는 success/CTA 전용).
// 이 한 곳에서 색을 바꾸면 5개 어드민 페이지에 일괄 반영.

interface AdminErrorBannerProps {
  // 한 줄 요약 — 예: "이벤트 조회 실패"
  title: string
  // formatPostgrestError 결과 — code/message/hint 합본
  detail: string
  // 서버 콘솔 로그 prefix — 예: "[admin/events]"
  logPrefix: string
}

export function AdminErrorBanner({ title, detail, logPrefix }: AdminErrorBannerProps) {
  return (
    <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-400">
      <p className="text-sm font-medium mb-1">{title}</p>
      <p className="text-xs opacity-80 break-all">{detail}</p>
      <p className="text-xs opacity-60 mt-2">
        보통 service_role GRANT 누락(code 42501) 또는 환경변수 문제. 서버 콘솔의{" "}
        <code>{logPrefix}</code> 로그 확인.
      </p>
    </div>
  )
}
