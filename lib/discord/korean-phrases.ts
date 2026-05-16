// HangeulGo 백엔드 미구현 상태 — 정적 한국어 표현 회전 사용 (CLAUDE.md §6 임시 정책)
// 매일 dayOfYear % length 로 결정적 선택 → cron 과 /korean 슬래시 명령 응답이 동일 표현 보장.
// HangeulGo 백엔드 구축 시 본 모듈을 DB 조회로 교체 (소비처는 getDailyKoreanPhrase 한 곳).

export interface KoreanPhrase {
  korean: string
  romanization: string
  english: string
  source: string // 드라마/맥락 — 없으면 "Daily expression"
}

const PHRASES: ReadonlyArray<KoreanPhrase> = [
  { korean: "안녕하세요", romanization: "Annyeonghaseyo", english: "Hello", source: "Daily expression" },
  { korean: "감사합니다", romanization: "Gamsahamnida", english: "Thank you", source: "Daily expression" },
  { korean: "사랑해요", romanization: "Saranghaeyo", english: "I love you", source: "Crash Landing on You" },
  { korean: "괜찮아요", romanization: "Gwaenchanayo", english: "It's okay / I'm fine", source: "Reply 1988" },
  { korean: "잘 자요", romanization: "Jal jayo", english: "Sleep well / Good night", source: "Daily expression" },
  { korean: "맛있어요", romanization: "Masisseoyo", english: "It's delicious", source: "Itaewon Class" },
  { korean: "보고 싶어요", romanization: "Bogo sipeoyo", english: "I miss you", source: "Goblin" },
  { korean: "화이팅", romanization: "Hwaiting", english: "You can do it! / Cheer up!", source: "Squid Game" },
  { korean: "대박", romanization: "Daebak", english: "Awesome / Jackpot", source: "Daily expression" },
  { korean: "진짜", romanization: "Jinjja", english: "Really / Seriously", source: "Daily expression" },
  { korean: "잠깐만요", romanization: "Jamkkanmanyo", english: "Wait a moment", source: "Daily expression" },
  { korean: "어떻게", romanization: "Eotteoke", english: "How / What do I do", source: "Daily expression" },
  { korean: "괜찮아", romanization: "Gwaenchana", english: "It's okay (casual)", source: "Reply 1997" },
  { korean: "고마워요", romanization: "Gomawoyo", english: "Thank you (warm)", source: "Daily expression" },
  { korean: "미안해요", romanization: "Mianhaeyo", english: "I'm sorry", source: "Daily expression" },
  { korean: "오빠", romanization: "Oppa", english: "Older brother (used by women)", source: "Daily expression" },
  { korean: "언니", romanization: "Eonni", english: "Older sister (used by women)", source: "Daily expression" },
  { korean: "형", romanization: "Hyeong", english: "Older brother (used by men)", source: "Daily expression" },
  { korean: "누나", romanization: "Nuna", english: "Older sister (used by men)", source: "Daily expression" },
  { korean: "아이고", romanization: "Aigo", english: "Oh dear / Oh no", source: "Reply 1988" },
  { korean: "정말요?", romanization: "Jeongmaryo?", english: "Really?", source: "Daily expression" },
  { korean: "예뻐요", romanization: "Yeppeoyo", english: "You're pretty", source: "True Beauty" },
  { korean: "멋있어요", romanization: "Meosisseoyo", english: "You're cool", source: "Vincenzo" },
  { korean: "어서 오세요", romanization: "Eoseo oseyo", english: "Welcome (to a place)", source: "Hometown Cha-Cha-Cha" },
  { korean: "다녀올게요", romanization: "Danyeoolgeyo", english: "I'll be back (leaving)", source: "Daily expression" },
  { korean: "잘 먹겠습니다", romanization: "Jal meokgesseumnida", english: "I'll eat well (pre-meal)", source: "Let's Eat" },
  { korean: "잘 먹었습니다", romanization: "Jal meogeosseumnida", english: "I ate well (post-meal)", source: "Let's Eat" },
  { korean: "수고하셨어요", romanization: "Sugohasyeosseoyo", english: "You worked hard / Well done", source: "Misaeng" },
  { korean: "파이팅", romanization: "Paiting", english: "Fighting! (encouragement)", source: "Start-Up" },
  { korean: "오늘도", romanization: "Oneuldo", english: "Today too / Once again today", source: "Daily expression" },
  { korean: "사랑해", romanization: "Saranghae", english: "I love you (casual)", source: "Descendants of the Sun" },
  { korean: "보고싶다", romanization: "Bogosipda", english: "I miss you (casual)", source: "It's Okay to Not Be Okay" },
  { korean: "축하해요", romanization: "Chukhahaeyo", english: "Congratulations", source: "Daily expression" },
  { korean: "행복하세요", romanization: "Haengbokhaseyo", english: "Be happy", source: "Our Beloved Summer" },
  { korean: "최고예요", romanization: "Choegoyeyo", english: "You're the best", source: "Daily expression" },
] as const

// UTC 기준 day-of-year (1~366) — 모든 cron / 슬래시 명령이 같은 timezone 에서 같은 표현 선택
function dayOfYearUTC(d: Date = new Date()): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0)
  const now = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return Math.floor((now - start) / 86_400_000)
}

export function getDailyKoreanPhrase(d: Date = new Date()): KoreanPhrase {
  const idx = dayOfYearUTC(d) % PHRASES.length
  return PHRASES[idx]
}
