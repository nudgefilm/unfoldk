// Discord Embed 빌더 — 4개 채널 자동 포스팅 + 5개 슬래시 명령 응답
//
// 디자인 원칙 (사용자 명시 형식 준수):
//   - 모든 Embed 하단에 EARLY_ACCESS_NOTE 포함 (lib/discord/templates.ts 재사용)
//   - 브랜드 컬러 #FF4B6E (0xff4b6e)
//   - footer.text: "Powered by UnfoldK.com"
//   - description 은 markdown 지원 — 코드 블록·이모지·링크 가능

import type { DiscordEmbed } from "@/lib/discord/bot"
import {
  BRAND_INTRO,
  EARLY_ACCESS_NOTE,
  SERVICE_BLURBS,
} from "@/lib/discord/templates"
import type { ChartItem, ScheduleItem } from "@/lib/discord/data"
import type { TmdbTvShow } from "@/lib/api/tmdb"
import type { KoreanPhrase } from "@/lib/discord/korean-phrases"

const BRAND_COLOR = 0xff4b6e
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://unfoldk.com"
const FOOTER_TEXT = "Powered by UnfoldK.com"

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
    case "comeback":
      return "🎵"
    case "drama":
      return "🎬"
    case "concert":
      return "🎤"
    case "fanmeet":
      return "💌"
  }
}

// ─── 채널 자동 포스팅 Embed (4종) ────────────────────────────

export function buildDailyScheduleEmbed(items: ScheduleItem[]): DiscordEmbed {
  const lines = items.length
    ? items.map(
        (e) =>
          `${typeEmoji(e.type)} **${e.title}** — ${formatDateKST(e.event_date)}\n   ${e.artist_or_drama}`
      )
    : ["_No events today — check back tomorrow!_"]

  return {
    title: "🎵 Today's K-pop & K-drama Schedule",
    description: [
      divider(),
      ...lines,
      divider(),
      `👉 Full schedule → ${APP_URL}/calendar`,
      "",
      EARLY_ACCESS_NOTE,
    ].join("\n"),
    color: BRAND_COLOR,
    url: `${APP_URL}/calendar`,
    footer: { text: FOOTER_TEXT },
    timestamp: new Date().toISOString(),
  }
}

export function buildKpopChartEmbed(items: ChartItem[]): DiscordEmbed {
  const lines = items.length
    ? items.map(
        (it) =>
          `**#${it.rank}** ${it.name} — ${formatListenersM(it.lastfm_listeners)} listeners`
      )
    : ["_Chart data syncing — try again in a few hours._"]

  return {
    title: "📊 This Week's K-pop Global Chart",
    description: [
      divider(),
      ...lines,
      divider(),
      `👉 Full chart → ${APP_URL}/kpop`,
      "",
      EARLY_ACCESS_NOTE,
    ].join("\n"),
    color: BRAND_COLOR,
    url: `${APP_URL}/kpop`,
    footer: { text: FOOTER_TEXT },
    timestamp: new Date().toISOString(),
  }
}

export function buildDramaUpdatesEmbed(items: TmdbTvShow[]): DiscordEmbed {
  const lines = items.length
    ? items.map(
        (d) =>
          `🎬 **${d.name}** — ${d.first_air_date || "TBA"}\n   _${d.overview ? d.overview.slice(0, 90) + (d.overview.length > 90 ? "…" : "") : "No description."}_`
      )
    : ["_Drama data unavailable — try again later._"]

  return {
    title: "🎬 Currently Airing K-Dramas",
    description: [
      divider(),
      ...lines,
      divider(),
      `👉 Browse all dramas → ${APP_URL}/drama`,
      "",
      EARLY_ACCESS_NOTE,
    ].join("\n"),
    color: BRAND_COLOR,
    url: `${APP_URL}/drama`,
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
      `👉 Learn more → ${APP_URL}/korean`,
      "",
      EARLY_ACCESS_NOTE,
    ].join("\n"),
    color: BRAND_COLOR,
    url: `${APP_URL}/korean`,
    footer: { text: FOOTER_TEXT },
    timestamp: new Date().toISOString(),
  }
}

// ─── 슬래시 명령 Embed (5종) ─────────────────────────────────

export function buildComebackEmbed(items: ScheduleItem[]): DiscordEmbed {
  const lines = items.length
    ? items.map(
        (e) =>
          `🎵 **${e.title}** — ${formatDateKST(e.event_date)}\n   ${e.artist_or_drama}`
      )
    : ["_No comebacks scheduled in the next 7 days._"]

  return {
    title: "🎵 This Week's K-pop Comebacks",
    description: [
      divider(),
      ...lines,
      divider(),
      `👉 Full schedule → ${APP_URL}/calendar`,
      "",
      EARLY_ACCESS_NOTE,
    ].join("\n"),
    color: BRAND_COLOR,
    url: `${APP_URL}/calendar`,
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
    url: APP_URL,
    footer: { text: FOOTER_TEXT },
  }
}
