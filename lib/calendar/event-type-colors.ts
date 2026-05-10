// 이벤트 타입별 색상 — HallyuCalendar 전 영역 공통 헬퍼.
// 캘린더 그리드 / Upcoming 카드 / EventDetailModal 타입 태그 / 랜딩 위젯 / Featured 카드
// 모두 이 한 곳에서 색을 가져와 톤 정합성 유지.

// API 응답에 들어오는 display 타입 라벨 (TYPE_TO_DISPLAY 매핑 결과).
// DB enum (comeback/drama/concert/fanmeet) 과 1:1 대응.
export type EventDisplayType = "K-pop" | "K-drama" | "Concert" | "Fan Meet"

const EVENT_TYPE_HEX: Record<EventDisplayType, string> = {
  "K-pop": "#FF4B6E",     // 브랜드 핑크 (comeback)
  "K-drama": "#8B5CF6",   // 보라
  "Concert": "#F97316",   // 주황
  "Fan Meet": "#06B6D4",  // 하늘
}

// 매칭 실패 시 브랜드 핑크 fallback — 구 데이터·타입 추가 시 안전망.
const FALLBACK_HEX = "#FF4B6E"

export function getEventTypeColor(type: string | undefined | null): string {
  if (!type) return FALLBACK_HEX
  return EVENT_TYPE_HEX[type as EventDisplayType] ?? FALLBACK_HEX
}

// alpha 합성 — Tailwind arbitrary class 로 못 쓰는 동적 색상에 활용.
// 예: bg-[#FF4B6E]/15 같은 정적 클래스 대신 rgba(r,g,b,0.15) 인라인 style.
export function getEventTypeColorAlpha(
  type: string | undefined | null,
  alpha: number
): string {
  const hex = getEventTypeColor(type)
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
