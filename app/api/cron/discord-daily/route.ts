import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import {
  postChannelMessage,
  postWebhookMessage,
  resolveChannelIdByName,
  type DiscordEmbed,
} from "@/lib/discord/bot"
import {
  buildCurationKEmbed,
  buildDailyScheduleEmbed,
  buildDramaUpdatesEmbed,
  buildKfoodEmbed,
  buildKoreanPhraseEmbed,
  buildKpopChartEmbed,
} from "@/lib/discord/embeds"
import {
  fetchDailyCurationSpot,
  fetchDailyFoodRecipe,
  fetchTodayKoreanPhrase,
  fetchTodaySchedule,
} from "@/lib/discord/data"
import {
  listAllServerSettings,
  resolveChannelForKey,
  type ChannelKey,
  type DiscordServerSettings,
} from "@/lib/discord/settings"

export const maxDuration = 60
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// 일일 Discord 자동 포스팅 cron
// vercel.json 매일 09:00 UTC (= 18:00 KST) 실행
//
// 전송 우선순위:
//   1. DISCORD_WEBHOOK_* 4개 env 모두 설정 → Webhook 방식 (봇 권한 불필요)
//   2. 미설정 → Bot 토큰 방식 (DB enrolled 서버 순회)

const CHANNEL_KEYS: readonly ChannelKey[] = ["schedule", "charts", "drama", "korean"] as const

const LEGACY_CHANNEL_NAMES: Record<ChannelKey, string> = {
  schedule: "daily-schedule",
  charts: "kpop-charts",
  drama: "drama-updates",
  korean: "korean-phrase",
}

// Webhook env 읽기 — 하나라도 없으면 null (4개 전부 있어야 webhook 모드)
function getWebhookUrls(): Record<ChannelKey, string> | null {
  const schedule = process.env.DISCORD_WEBHOOK_SCHEDULE
  const charts = process.env.DISCORD_WEBHOOK_CHARTS
  const drama = process.env.DISCORD_WEBHOOK_DRAMA
  const korean = process.env.DISCORD_WEBHOOK_KOREAN
  if (!schedule || !charts || !drama || !korean) return null
  return { schedule, charts, drama, korean }
}

interface PostResult {
  channel: string
  method: "webhook" | "bot"
  channel_id?: string
  webhook_url_prefix?: string // 앞 30자만 — 보안
  status: "posted" | "channel_not_found" | "error"
  error?: string
}

type ExtraChannelKey = "food" | "curation"

function getExtraWebhookUrls(): Partial<Record<ExtraChannelKey, string>> {
  const urls: Partial<Record<ExtraChannelKey, string>> = {}
  if (process.env.DISCORD_WEBHOOK_FOOD) urls.food = process.env.DISCORD_WEBHOOK_FOOD
  if (process.env.DISCORD_WEBHOOK_CURATION) urls.curation = process.env.DISCORD_WEBHOOK_CURATION
  return urls
}

async function buildExtraEmbeds(): Promise<Record<ExtraChannelKey, DiscordEmbed>> {
  const [recipe, spot] = await Promise.all([
    fetchDailyFoodRecipe(),
    fetchDailyCurationSpot(),
  ])
  return {
    food: buildKfoodEmbed(recipe),
    curation: buildCurationKEmbed(spot),
  }
}

async function postExtraWebhooks(
  urls: Partial<Record<ExtraChannelKey, string>>,
  embeds: Record<ExtraChannelKey, DiscordEmbed>
): Promise<PostResult[]> {
  const keys = Object.keys(urls) as ExtraChannelKey[]
  return Promise.all(
    keys.map(async (key): Promise<PostResult> => {
      const url = urls[key]!
      try {
        await postWebhookMessage(url, { embeds: [embeds[key]] })
        return { channel: key, method: "webhook", webhook_url_prefix: url.slice(0, 30), status: "posted" }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[discord-daily webhook ${key}]`, msg)
        return { channel: key, method: "webhook", status: "error", error: msg }
      }
    })
  )
}

async function buildAllEmbeds(): Promise<Record<ChannelKey, DiscordEmbed>> {
  const schedule = await fetchTodaySchedule(10)
  const phrase = fetchTodayKoreanPhrase()
  return {
    schedule: buildDailyScheduleEmbed(schedule),
    charts: buildKpopChartEmbed(),
    drama: buildDramaUpdatesEmbed(),
    korean: buildKoreanPhraseEmbed(phrase),
  }
}

// ── Webhook 모드 ──────────────────────────────────────────────
async function postViaWebhooks(
  webhooks: Record<ChannelKey, string>,
  embeds: Record<ChannelKey, DiscordEmbed>
): Promise<PostResult[]> {
  return Promise.all(
    CHANNEL_KEYS.map(async (key): Promise<PostResult> => {
      const url = webhooks[key]
      try {
        await postWebhookMessage(url, { embeds: [embeds[key]] })
        return {
          channel: key,
          method: "webhook",
          webhook_url_prefix: url.slice(0, 30),
          status: "posted",
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[discord-daily webhook ${key}]`, msg)
        return { channel: key, method: "webhook", status: "error", error: msg }
      }
    })
  )
}

// ── Bot 토큰 모드 (기존 multi-server 로직) ───────────────────
interface BotPostResult extends PostResult {
  guild_id: string
}

async function resolveChannelId(
  guildId: string,
  key: ChannelKey,
  settings: DiscordServerSettings | undefined
): Promise<string | null> {
  if (settings) return resolveChannelForKey(settings, key)
  try {
    return await resolveChannelIdByName(LEGACY_CHANNEL_NAMES[key], guildId)
  } catch (err) {
    console.error(`[discord-daily legacy resolve ${guildId} ${key}]`, err)
    return null
  }
}

async function postOneBot(
  guildId: string,
  key: ChannelKey,
  embed: DiscordEmbed,
  settings: DiscordServerSettings | undefined
): Promise<BotPostResult> {
  try {
    const channelId = await resolveChannelId(guildId, key, settings)
    if (!channelId) {
      return { guild_id: guildId, channel: key, method: "bot", status: "channel_not_found" }
    }
    await postChannelMessage(channelId, { embeds: [embed] })
    return { guild_id: guildId, channel: key, method: "bot", channel_id: channelId, status: "posted" }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[discord-daily bot ${guildId} ${key}]`, msg)
    return { guild_id: guildId, channel: key, method: "bot", status: "error", error: msg }
  }
}

async function postViaBotToken(
  embeds: Record<ChannelKey, DiscordEmbed>
): Promise<{ results: BotPostResult[]; servers: number }> {
  const enrolled = await listAllServerSettings()
  const enrolledMap = new Map(enrolled.map((s) => [s.guild_id, s]))
  const envGuildId = process.env.DISCORD_GUILD_ID ?? null

  const targetGuildIds = new Set<string>(enrolled.map((s) => s.guild_id))
  if (envGuildId && !enrolledMap.has(envGuildId)) targetGuildIds.add(envGuildId)

  const allResults: BotPostResult[] = []
  for (const guildId of targetGuildIds) {
    const settings = enrolledMap.get(guildId)
    const serverResults = await Promise.all(
      CHANNEL_KEYS.map((key) => postOneBot(guildId, key, embeds[key], settings))
    )
    allResults.push(...serverResults)
  }
  return { results: allResults, servers: targetGuildIds.size }
}

// ── Handler ───────────────────────────────────────────────────
export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  const webhooks = getWebhookUrls()
  const usingWebhook = webhooks !== null

  if (!usingWebhook && !process.env.DISCORD_BOT_TOKEN) {
    return NextResponse.json(
      { error: "DISCORD_WEBHOOK_* 4개 또는 DISCORD_BOT_TOKEN 중 하나 이상 필요" },
      { status: 500 }
    )
  }

  const t0 = Date.now()
  const embeds = await buildAllEmbeds()

  let results: PostResult[]
  let servers: number

  if (usingWebhook) {
    results = await postViaWebhooks(webhooks, embeds)
    servers = 1
  } else {
    const botResult = await postViaBotToken(embeds)
    results = botResult.results
    servers = botResult.servers
  }

  // food / curation 추가 채널 — Webhook 설정 시 독립 발송
  const extraUrls = getExtraWebhookUrls()
  if (Object.keys(extraUrls).length > 0) {
    const extraEmbeds = await buildExtraEmbeds()
    const extraResults = await postExtraWebhooks(extraUrls, extraEmbeds)
    results = [...results, ...extraResults]
  }

  const posted = results.filter((r) => r.status === "posted").length
  const errors = results.filter((r) => r.status === "error").length
  const notFound = results.filter((r) => r.status === "channel_not_found").length

  const payload = {
    source: "discord-daily",
    mode: usingWebhook ? "webhook" : "bot",
    elapsedMs: Date.now() - t0,
    summary: { posted, errors, notFound, total: results.length, servers },
    results,
  }

  await recordCronLog("discord-daily", errors > 0 && posted === 0 ? "failed" : "success", payload)

  const httpStatus = errors > 0 ? (posted > 0 ? 207 : 500) : 200
  return NextResponse.json(payload, { status: httpStatus })
}
