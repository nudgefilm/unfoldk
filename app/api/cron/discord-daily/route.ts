import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import {
  postChannelMessage,
  resolveChannelIdByName,
  type DiscordEmbed,
} from "@/lib/discord/bot"
import {
  buildDailyScheduleEmbed,
  buildDramaUpdatesEmbed,
  buildKoreanPhraseEmbed,
  buildKpopChartEmbed,
} from "@/lib/discord/embeds"
import {
  fetchAiringDramas,
  fetchTodayKoreanPhrase,
  fetchTodaySchedule,
  fetchTop10Chart,
} from "@/lib/discord/data"
import {
  listAllServerSettings,
  resolveChannelForKey,
  type ChannelKey,
  type DiscordServerSettings,
} from "@/lib/discord/settings"

export const maxDuration = 60
export const dynamic = "force-dynamic"
export const runtime = "nodejs" // crypto.verify (Ed25519) Node 전용 — 명시적 nodejs 런타임

// 일일 Discord 자동 포스팅 cron
// vercel.json 매일 09:00 UTC (= 18:00 KST) 실행
//
// Multi-server 처리:
//   1. discord_server_settings 의 enrolled 서버 → /setup 으로 지정한 채널 ID 사용.
//      특정 키가 NULL 이면 announcements → general 순서 fallback (lib/discord/settings.ts).
//   2. env DISCORD_GUILD_ID 가 enrolled 에 없으면 legacy 채널명 매핑으로 fallback
//      (daily-schedule / kpop-charts / drama-updates / korean-phrase).
//
// 한 서버 또는 한 채널 실패가 다른 발송을 막지 않음 (개별 try/catch).
// 데이터 fetch 는 server-independent 이므로 한 번만 — embed 재사용.

const CHANNEL_KEYS: readonly ChannelKey[] = [
  "schedule",
  "charts",
  "drama",
  "korean",
] as const

// /setup 미사용 환경 (env-only 서버) 의 기존 채널명 매핑.
// 사용자가 별도 설정 없이도 기본 채널 자동 포스팅 받도록.
const LEGACY_CHANNEL_NAMES: Record<ChannelKey, string> = {
  schedule: "daily-schedule",
  charts: "kpop-charts",
  drama: "drama-updates",
  korean: "korean-phrase",
}

interface PostResult {
  guild_id: string
  channel: ChannelKey
  channel_id?: string
  status: "posted" | "channel_not_found" | "error"
  error?: string
}

async function buildAllEmbeds(): Promise<Record<ChannelKey, DiscordEmbed>> {
  // 네 데이터 소스 병렬 — 단일 cron 시점 스냅샷이라 한 번만 fetch
  const [schedule, charts, dramas] = await Promise.all([
    fetchTodaySchedule(10),
    fetchTop10Chart(),
    fetchAiringDramas(5),
  ])
  const phrase = fetchTodayKoreanPhrase()
  return {
    schedule: buildDailyScheduleEmbed(schedule),
    charts: buildKpopChartEmbed(charts),
    drama: buildDramaUpdatesEmbed(dramas),
    korean: buildKoreanPhraseEmbed(phrase),
  }
}

// 서버별·키별 채널 ID 결정 — settings 유무에 따라 다른 fallback 전략
async function resolveChannelId(
  guildId: string,
  key: ChannelKey,
  settings: DiscordServerSettings | undefined
): Promise<string | null> {
  if (settings) {
    return resolveChannelForKey(settings, key)
  }
  // settings 없는 env 서버 — legacy 채널명으로 매핑
  try {
    return await resolveChannelIdByName(LEGACY_CHANNEL_NAMES[key], guildId)
  } catch (err) {
    console.error(`[discord-daily legacy resolve ${guildId} ${key}]`, err)
    return null
  }
}

async function postOne(
  guildId: string,
  key: ChannelKey,
  embed: DiscordEmbed,
  settings: DiscordServerSettings | undefined
): Promise<PostResult> {
  try {
    const channelId = await resolveChannelId(guildId, key, settings)
    if (!channelId) {
      return { guild_id: guildId, channel: key, status: "channel_not_found" }
    }
    await postChannelMessage(channelId, { embeds: [embed] })
    return { guild_id: guildId, channel: key, channel_id: channelId, status: "posted" }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown"
    console.error(`[discord-daily ${guildId} ${key}]`, msg)
    return { guild_id: guildId, channel: key, status: "error", error: msg }
  }
}

export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  if (!process.env.DISCORD_BOT_TOKEN) {
    return NextResponse.json({ error: "DISCORD_BOT_TOKEN 미설정" }, { status: 500 })
  }

  const t0 = Date.now()

  // 1) 발송 대상 서버 결정 — DB enrolled + env fallback
  const enrolled = await listAllServerSettings()
  const enrolledMap = new Map(enrolled.map((s) => [s.guild_id, s]))
  const envGuildId = process.env.DISCORD_GUILD_ID ?? null

  const targetGuildIds = new Set<string>(enrolled.map((s) => s.guild_id))
  if (envGuildId && !enrolledMap.has(envGuildId)) {
    targetGuildIds.add(envGuildId)
  }

  if (targetGuildIds.size === 0) {
    const payload = {
      source: "discord-daily",
      elapsedMs: Date.now() - t0,
      summary: { posted: 0, errors: 0, notFound: 0, total: 0, servers: 0 },
      results: [],
      note: "No enrolled servers and no DISCORD_GUILD_ID — nothing to post.",
    }
    await recordCronLog("discord-daily", "success", payload)
    return NextResponse.json(payload)
  }

  // 2) Embed 한 번만 빌드 — server-independent
  const embeds = await buildAllEmbeds()

  // 3) 서버 × 키 발송 (서버는 순차 — Discord rate limit; 한 서버 내 키들은 병렬)
  const allResults: PostResult[] = []
  for (const guildId of targetGuildIds) {
    const settings = enrolledMap.get(guildId)
    const serverResults = await Promise.all(
      CHANNEL_KEYS.map((key) => postOne(guildId, key, embeds[key], settings))
    )
    allResults.push(...serverResults)
  }

  const posted = allResults.filter((r) => r.status === "posted").length
  const errors = allResults.filter((r) => r.status === "error").length
  const notFound = allResults.filter((r) => r.status === "channel_not_found").length

  const payload = {
    source: "discord-daily",
    elapsedMs: Date.now() - t0,
    summary: {
      posted,
      errors,
      notFound,
      total: allResults.length,
      servers: targetGuildIds.size,
    },
    results: allResults,
  }

  await recordCronLog(
    "discord-daily",
    errors > 0 && posted === 0 ? "failed" : "success",
    payload
  )

  const httpStatus = errors > 0 ? (posted > 0 ? 207 : 500) : 200
  return NextResponse.json(payload, { status: httpStatus })
}
