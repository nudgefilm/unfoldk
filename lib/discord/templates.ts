// Discord 봇 메시지 템플릿 — 서비스별 안내 + Early Access note.
//
// 사용 시나리오 (향후 봇 구현 예정):
//   - /unfoldk help              → BRAND_INTRO + EARLY_ACCESS_NOTE
//   - /unfoldk calendar          → SERVICE_BLURBS.calendar
//   - /unfoldk drama (등)        → SERVICE_BLURBS.{service}
//   - 매주 1회 broadcast         → WEEKLY_PROMO
//
// 본 파일은 데이터 only — 봇 런타임 (Discord.js·Slash command 핸들러) 은 별도 패키지.
// 메시지 변경 시 봇 재배포 불필요 (런타임이 import 시점에 읽음).
//
// CLAUDE.md §6 AI 처리 원칙 — 정적 카피이므로 Claude 호출 불필요.

export const BRAND_INTRO = `**UnfoldK** — your pass to Korean culture.
Calendar · KpopStats · KdramaMatch · HangeulGo · KfoodKit · Curation K. One subscription, six fan tools.`

export const EARLY_ACCESS_NOTE = `
🌟 UnfoldK is now live — Early Access is open!
✅ Live now: HallyuCalendar · KpopStats · Curation K
🔜 Coming soon: KdramaMatch · HangeulGo · KfoodKit
→ https://www.unfoldk.com
`.trim()

// 6 서비스 short blurb — 봇 응답 시 단일 메시지 임베드.
export const SERVICE_BLURBS = {
  calendar: `📅 **HallyuCalendar** — Never miss a comeback, premiere, concert, or fan meet.
Live TMDB + Ticketmaster ingestion. Free + Hallyu Pass tiers.
→ unfoldk.com/calendar`,

  kpop: `🎵 **KpopStats** — Global K-pop charts that move.
Last.fm monthly listeners · trending Top.
→ unfoldk.com/kpop`,

  drama: `🎬 **KdramaMatch** — AI-powered K-drama recommendations.
Coming soon — sign up to be notified at launch.
→ unfoldk.com/drama`,

  korean: `🇰🇷 **HangeulGo** — Learn Korean from the K-dramas you watch.
Coming soon — sign up to be notified at launch.
→ unfoldk.com/korean`,

  food: `🍱 **KfoodKit** — Cook the food from your favorite K-dramas.
Coming soon — sign up to be notified at launch.
→ unfoldk.com/food`,

  curationk: `🗺️ **Curation K** — Korea, mapped for fans.
Filming spots · K-pop pilgrimage · food · stays · My Hallyu Course.
→ unfoldk.com/curation-k`,
} as const

export type ServiceKey = keyof typeof SERVICE_BLURBS

// 매주 1회 broadcast — 일반 채널용 short 프로모 메시지.
export const WEEKLY_PROMO = `**Korea this week on UnfoldK**
🎵 Fresh K-pop chart trends → unfoldk.com/kpop
📅 Upcoming comebacks & concerts → unfoldk.com/calendar
🗺️ Drama filming spots → unfoldk.com/curation-k`

// 신규 가입 환영 — 봇이 새 멤버 join 이벤트에 응답.
export const WELCOME_MESSAGE = `Welcome to the UnfoldK community! 🎉

${BRAND_INTRO}

${EARLY_ACCESS_NOTE}

Try \`/unfoldk help\` for commands.`

// 봇 에러 표준 응답 (외부 API 실패 등) — 사용자에게 친절한 fallback.
export const ERROR_FALLBACK = `Something went wrong fetching that. Try again in a minute.`