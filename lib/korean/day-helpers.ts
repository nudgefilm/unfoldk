// HangeulGo Phase 1 — Asia/Seoul 기준 날짜 헬퍼.
//
// 모든 시간 기반 회전·스트릭 계산은 한국 자정 기준 — 글로벌 유저의 로컬 자정으로
// 잘못 판정하는 케이스 차단 (app/drama/page.tsx buildDDayLabel 동일 원칙).
//
// 사용:
//   - phrase-of-day: getSeoulDateString() → DB cache key (featured_date)
//   - phrase-of-day: getSeoulDayOfYear() → 드라마 회전 인덱스
//   - streak: getSeoulDateString() → user_streaks.last_studied_date

// 오늘 (Asia/Seoul) YYYY-MM-DD 문자열
// sv-SE locale 이 ISO 형식 YYYY-MM-DD 를 출력하는 패턴 사용
export function getSeoulDateString(now: Date = new Date()): string {
  return now.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })
}

// 오늘 (Asia/Seoul) day-of-year (1~366)
// 1월 1일 = 1, 12월 31일 = 365 또는 366
export function getSeoulDayOfYear(now: Date = new Date()): number {
  const seoulDateStr = getSeoulDateString(now)
  const [y, m, d] = seoulDateStr.split("-").map(Number)
  const startUtc = Date.UTC(y, 0, 1)
  const todayUtc = Date.UTC(y, m - 1, d)
  return Math.floor((todayUtc - startUtc) / 86400000) + 1
}

// 두 날짜 사이 일수 차이 (Asia/Seoul YYYY-MM-DD 문자열 두 개를 받음)
//   diffDays("2026-05-18", "2026-05-19") === 1
//   diffDays("2026-05-19", "2026-05-18") === -1
export function diffSeoulDays(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number)
  const [by, bm, bd] = b.split("-").map(Number)
  const aUtc = Date.UTC(ay, am - 1, ad)
  const bUtc = Date.UTC(by, bm - 1, bd)
  return Math.round((bUtc - aUtc) / 86400000)
}
