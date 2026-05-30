// Discord Embed 빌더 — 채널 자동 포스팅 + 슬래시 명령 응답
//
// 디자인 원칙 (사용자 명시 형식 준수):
//   - 모든 Embed 하단에 EARLY_ACCESS_NOTE 포함 (lib/discord/templates.ts 재사용)
//   - 브랜드 컬러 #FF4B6E (0xff4b6e)
//   - footer.text: "Powered by UnfoldK"
//   - image 필드: 채널별 고정 이미지 (하단 큰 이미지)

import type { DiscordEmbed } from "@/lib/discord/bot"
import {
  BRAND_INTRO,
  EARLY_ACCESS_NOTE,
  SERVICE_BLURBS,
} from "@/lib/discord/templates"
import type { ChartItem, CurationSpotItem, FoodRecipeItem, ScheduleItem } from "@/lib/discord/data"
import type { TmdbTvShow } from "@/lib/api/tmdb"
import type { KoreanPhrase } from "@/lib/discord/korean-phrases"

const BRAND_COLOR = 0xff4b6e
const FOOTER_TEXT = "Powered by UnfoldK"
const BASE_IMG = "https://www.unfoldk.com/images/discord"

// 채널별 고정 이미지 URL (파일명: discord-{service}.jpeg)
const CHANNEL_IMAGES = {
  schedule: `${BASE_IMG}/discord-hallyu-calendar.jpeg`,
  charts:   `${BASE_IMG}/discord-kpop-stats.jpeg`,
  drama:    `${BASE_IMG}/discord-kdrama-match.jpeg`,
  korean:   `${BASE_IMG}/discord-hangeul-go.jpeg`,
  food:     `${BASE_IMG}/discord-kfood-kit.jpeg`,
  curation: `${BASE_IMG}/discord-curation-k.jpeg`,
} as const

function divider(): string {
  return "─────────────────────"
}

function formatDateKST(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
  })
}

function formatListenersM(n: number | null): string {
  if (!n || n <= 0) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function typeEmoji(type: ScheduleItem["type"]): string {
  switch (type) {
    case "comeback": return "🎵"
    case "drama":    return "🎬"
    case "concert":  return "🎤"
    case "fanmeet":  return "💌"
  }
}

// 성인·민감 콘텐츠 필터 키워드
const SENSITIVE_WORDS = [
  "homoerotic", "erotic", "sexual content", "adult content",
  "nudity", "pornographic", "explicit sexual",
]

function filterOverview(overview: string | null | undefined): string | null {
  if (!overview?.trim()) return null
  const lower = overview.toLowerCase()
  if (SENSITIVE_WORDS.some((w) => lower.includes(w))) return null
  return overview.slice(0, 100) + (overview.length > 100 ? "…" : "")
}

// ─── 채널 자동 포스팅 Embed ────────────────────────────────────

export function buildDailyScheduleEmbed(items: ScheduleItem[]): DiscordEmbed {
  // 중복 제거: (artist_or_drama, date, type) 동일한 이벤트는 첫 번째만 유지
  // (예: TWICE 월드투어 VIP/일반/Comfort Seats → 1건)
  const seen = new Set<string>()
  const deduped = items.filter((e) => {
    const key = `${e.artist_or_drama.toLowerCase()}|${e.event_date.slice(0, 10)}|${e.type}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const lines = deduped.length
    ? deduped.map((e) => {
        const titleNorm = e.title.trim().toLowerCase()
        const artistNorm = e.artist_or_drama.trim().toLowerCase()
        // 제목과 아티스트명이 동일하거나 아티스트명이 없으면 부제목 생략
        const subtitle =
          artistNorm && artistNorm !== titleNorm
            ? `\n   ${e.artist_or_drama}`
            : ""
        return `${typeEmoji(e.type)} **${e.title}** — ${formatDateKST(e.event_date)}${subtitle}`
      })
    : ["_No events today — check back tomorrow!_"]

  return {
    title: "🎵 Today's K-pop & K-drama Schedule",
    description: [divider(), ...lines, divider(), EARLY_ACCESS_NOTE].join("\n"),
    color: BRAND_COLOR,
    image: { url: CHANNEL_IMAGES.schedule },
    footer: { text: FOOTER_TEXT },
    timestamp: new Date().toISOString(),
  }
}

export function buildKpopChartEmbed(items: ChartItem[]): DiscordEmbed {
  const lines = items.length
    ? items.map(
        (it) => `**#${it.rank}** ${it.name} — ${formatListenersM(it.lastfm_listeners)} listeners`
      )
    : ["_Chart data syncing — try again in a few hours._"]

  return {
    title: "📊 This Week's K-pop Global Chart",
    description: [divider(), ...lines, divider(), EARLY_ACCESS_NOTE].join("\n"),
    color: BRAND_COLOR,
    image: { url: CHANNEL_IMAGES.charts },
    footer: { text: FOOTER_TEXT },
    timestamp: new Date().toISOString(),
  }
}

export function buildDramaUpdatesEmbed(items: TmdbTvShow[]): DiscordEmbed {
  const lines = items.length
    ? items.map((d) => {
        const overview = filterOverview(d.overview)
        // 설명 있으면 이탤릭으로, 없으면 설명 줄 자체 생략
        const descLine = overview ? `\n   _${overview}_` : ""
        return `🎬 **${d.name}** — ${d.first_air_date || "TBA"}${descLine}`
      })
    : ["_No dramas currently airing. Check back soon!_"]

  return {
    title: "🎬 Currently Airing K-Dramas",
    description: [divider(), ...lines, divider(), EARLY_ACCESS_NOTE].join("\n"),
    color: BRAND_COLOR,
    image: { url: CHANNEL_IMAGES.drama },
    footer: { text: FOOTER_TEXT },
    timestamp: new Date().toISOString(),
  }
}

export function buildKoreanPhraseEmbed(p: KoreanPhrase): DiscordEmbed {
  return {
    title: "🇰🇷 Korean Phrase of the Day",
    description: [
      divider(),
      `**${p.korean}**`,
      `_${p.romanization}_`,
      `"${p.english}"`,
      `From: ${p.source}`,
      divider(),
      EARLY_ACCESS_NOTE,
    ].join("\n"),
    color: BRAND_COLOR,
    image: { url: CHANNEL_IMAGES.korean },
    footer: { text: FOOTER_TEXT },
    timestamp: new Date().toISOString(),
  }
}

export function buildKfoodEmbed(recipe?: FoodRecipeItem | null): DiscordEmbed {
  if (!recipe) {
    return {
      title: "🍱 K-food Kitchen — Cook Your Favorite Drama Dishes",
      description: [divider(), SERVICE_BLURBS.food, divider(), EARLY_ACCESS_NOTE].join("\n"),
      color: BRAND_COLOR,
      image: { url: CHANNEL_IMAGES.food },
      footer: { text: FOOTER_TEXT },
      timestamp: new Date().toISOString(),
    }
  }
  const nameLine = recipe.title_en
    ? `**${recipe.title_en}** (${recipe.title})`
    : `**${recipe.title}**`
  const lines: string[] = [`🍽️ ${nameLine}`]
  if (recipe.description_en) lines.push(`_${recipe.description_en}_`)
  if (recipe.ready_in_minutes) lines.push(`⏱️ Ready in ${recipe.ready_in_minutes} min`)
  return {
    title: "🍱 Today's K-food Recipe",
    description: [divider(), ...lines, divider(), EARLY_ACCESS_NOTE].join("\n"),
    color: BRAND_COLOR,
    image: { url: CHANNEL_IMAGES.food },
    footer: { text: FOOTER_TEXT },
    timestamp: new Date().toISOString(),
  }
}

export function buildCurationKEmbed(spot?: CurationSpotItem | null): DiscordEmbed {
  if (!spot) {
    return {
      title: "🗺️ Curation K — Korea, Mapped for Fans",
      description: [divider(), SERVICE_BLURBS.curationk, divider(), EARLY_ACCESS_NOTE].join("\n"),
      color: BRAND_COLOR,
      image: { url: CHANNEL_IMAGES.curation },
      footer: { text: FOOTER_TEXT },
      timestamp: new Date().toISOString(),
    }
  }
  const nameLine = spot.name_en
    ? `**${spot.name_en}** (${spot.name})`
    : `**${spot.name}**`
  const lines: string[] = [`📍 ${nameLine}`, `_${spot.category}_`]
  if (spot.description) lines.push(spot.description)
  if (spot.addr) lines.push(`📮 ${spot.addr}`)
  return {
    title: "🗺️ Today's Korean Destination",
    description: [divider(), ...lines, divider(), EARLY_ACCESS_NOTE].join("\n"),
    color: BRAND_COLOR,
    image: { url: CHANNEL_IMAGES.curation },
    footer: { text: FOOTER_TEXT },
    timestamp: new Date().toISOString(),
  }
}

// ─── 슬래시 명령 Embed (이미지 없음 — 명령 응답용) ──────────────

export function buildComebackEmbed(items: ScheduleItem[]): DiscordEmbed {
  const lines = items.length
    ? items.map(
        (e) => `🎵 **${e.title}** — ${formatDateKST(e.event_date)}\n   ${e.artist_or_drama}`
      )
    : ["_No comebacks scheduled in the next 7 days._"]

  return {
    title: "🎵 This Week's K-pop Comebacks",
    description: [divider(), ...lines, divider(), EARLY_ACCESS_NOTE].join("\n"),
    color: BRAND_COLOR,
    footer: { text: FOOTER_TEXT },
  }
}

// /chart 와 자동 포스팅 (kpop-charts) 은 동일 데이터·동일 포맷 사용
export const buildChartCommandEmbed = buildKpopChartEmbed

// /drama 와 자동 포스팅 (drama-updates) 동일
export const buildDramaCommandEmbed = buildDramaUpdatesEmbed

// /korean 과 자동 포스팅 (korean-phrase) 동일
export const buildKoreanCommandEmbed = buildKoreanPhraseEmbed

export function buildAboutEmbed(): DiscordEmbed {
  return {
    title: "🌏 UnfoldK — Your Pass to Korean Culture",
    description: [
      BRAND_INTRO,
      divider(),
      SERVICE_BLURBS.calendar,
      "",
      SERVICE_BLURBS.kpop,
      "",
      SERVICE_BLURBS.curationk,
      divider(),
      EARLY_ACCESS_NOTE,
    ].join("\n"),
    color: BRAND_COLOR,
    footer: { text: FOOTER_TEXT },
  }
}
