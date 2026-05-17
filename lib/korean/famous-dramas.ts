// HangeulGo (M+3) Phase 1 — 오늘의 표현 회전용 유명 K-드라마 20편 시드.
//
// 사용:
//   - dayOfYear % FAMOUS_DRAMAS.length → 오늘의 드라마 선택
//   - Claude Haiku 가 해당 드라마의 학습 목적 예시 표현을 생성
//
// 원칙:
//   - 글로벌 인지도 + 한국어 학습에 적합한 회화 풍부 작품 위주
//   - 드라마 대사 원문 직접 사용 금지 — Claude 가 "이 드라마에서 자주 나올 법한"
//     학습용 예시 표현을 생성 (저작권 회피)
//   - 가능하면 dramas 테이블의 title/title_ko 와 매칭되도록 KO/EN 양쪽 박제

export interface FamousDrama {
  ko: string                   // 한국어 원제
  en: string                   // 영문 공식 제목 (TMDB name 기준)
}

export const FAMOUS_DRAMAS: ReadonlyArray<FamousDrama> = [
  { ko: "도깨비", en: "Guardian: The Lonely and Great God" },
  { ko: "이태원 클라쓰", en: "Itaewon Class" },
  { ko: "별에서 온 그대", en: "My Love from the Star" },
  { ko: "응답하라 1988", en: "Reply 1988" },
  { ko: "사랑의 불시착", en: "Crash Landing on You" },
  { ko: "이상한 변호사 우영우", en: "Extraordinary Attorney Woo" },
  { ko: "오징어 게임", en: "Squid Game" },
  { ko: "미스터 션샤인", en: "Mr. Sunshine" },
  { ko: "킹덤", en: "Kingdom" },
  { ko: "호텔 델루나", en: "Hotel del Luna" },
  { ko: "더 글로리", en: "The Glory" },
  { ko: "갯마을 차차차", en: "Hometown Cha-Cha-Cha" },
  { ko: "슬기로운 의사생활", en: "Hospital Playlist" },
  { ko: "우리들의 블루스", en: "Our Blues" },
  { ko: "빈센조", en: "Vincenzo" },
  { ko: "김비서가 왜 그럴까", en: "What's Wrong with Secretary Kim" },
  { ko: "그 해 우리는", en: "Our Beloved Summer" },
  { ko: "동백꽃 필 무렵", en: "When the Camellia Blooms" },
  { ko: "시그널", en: "Signal" },
  { ko: "스카이 캐슬", en: "SKY Castle" },
] as const

// 오늘의 드라마 선택 — dayOfYear 기반 결정적 회전
export function pickFamousDramaByDayOfYear(dayOfYear: number): FamousDrama {
  return FAMOUS_DRAMAS[dayOfYear % FAMOUS_DRAMAS.length]
}
