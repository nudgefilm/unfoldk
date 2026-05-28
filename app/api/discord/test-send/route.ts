// 어드민 전용 — discord-daily 실제 전송 로직 직접 실행 후 즉시 결과 반환.
// Vercel Cron이 불확실할 때 수동 트리거·디버깅용.
import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import {
  postChannelMessage,
  postWebhookMessage,
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

const CHANNEL_KEYS: readonly ChannelKey[] = ["schedule", "charts", "drama", "korean"] as const

const LEGACY_CHANNEL_NAMES: Record<ChannelKey, string> = {
  schedule: "daily-schedule",
  charts: "kpop-charts",
  drama: "drama-updates",
  korean: "korean-phrase",
}

function getWebhookUrls(): Record<ChannelKey, string> | null {
  const schedule = process.env.DISCORD_WEBHOOK_SCHEDULE
  const charts = process.env.DISCORD_WEBHOOK_CHARTS
  const drama = process.env.DISCORD_WEBHOOK_DRAMA
  const korean = process.env.DISCORD_WEBHOOK_KOREAN
  if (!schedule || !charts || !drama || !korean) return null
  return { schedule, charts, drama, korean }
}

interface PostResult {
  channel: ChannelKey
  method: "webhook" | "bot"
  channel_id?: string
  status: "posted" | "channel_not_found" | "error"
  error?: string
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: isAdminUser } = await supabase.rpc("is_admin", { uid: user.id })
  if (!isAdminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const webhooks = getWebhookUrls()
  const usingWebhook = webhooks !== null

  if (!usingWebhook && !process.env.DISCORD_BOT_TOKEN) {
    return NextResponse.json(
      { error: "DISCORD_WEBHOOK_* 4개 또는 DISCORD_BOT_TOKEN 중 하나 이상 필요" },
      { status: 500 }
    )
  }

  const t0 = Date.now()

  // Embed 빌드
  let embeds: Record<ChannelKey, DiscordEmbed>
  try {
    const [schedule, charts, dramas] = await Promise.all([
      fetchTodaySchedule(10),
      fetchTop10Chart(),
      fetchAiringDramas(5),
    ])
    const phrase = fetchTodayKoreanPhrase()
    embeds = {
      schedule: buildDailyScheduleEmbed(schedule),
      charts: buildKpopChartEmbed(charts),
      drama: buildDramaUpdatesEmbed(dramas),
      korean: buildKoreanPhraseEmbed(phrase),
    }
  } catch (err) {
    return NextResponse.json({
      error: "Embed 빌드 실패",
      detail: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }

  const results: PostResult[] = []

  if (usingWebhook) {
    // Webhook 방식
    for (const key of CHANNEL_KEYS) {
      const url = webhooks[key]
      try {
        await postWebhookMessage(url, { embeds: [embeds[key]] })
        results.push({ channel: key, method: "webhook", status: "posted" })
      } catch (err) {
        results.push({ channel: key, method: "webhook", status: "error", error: err instanceof Error ? err.message : String(err) })
      }
    }
  } else {
    // Bot 토큰 방식
    const enrolled = await listAllServerSettings()
    const enrolledMap = new Map(enrolled.map((s) => [s.guild_id, s]))
    const envGuildId = process.env.DISCORD_GUILD_ID ?? null

    const targetGuildIds = new Set<string>(enrolled.map((s) => s.guild_id))
    if (envGuildId && !enrolledMap.has(envGuildId)) targetGuildIds.add(envGuildId)

    if (targetGuildIds.size === 0) {
      return NextResponse.json({ error: "No enrolled servers and no DISCORD_GUILD_ID" })
    }

    for (const guildId of targetGuildIds) {
      const settings = enrolledMap.get(guildId) as DiscordServerSettings | undefined
      for (const key of CHANNEL_KEYS) {
        try {
          let channelId: string | null = null
          if (settings) {
            channelId = await resolveChannelForKey(settings, key)
          } else {
            try { channelId = await resolveChannelIdByName(LEGACY_CHANNEL_NAMES[key], guildId) } catch { /* skip */ }
          }
          if (!channelId) {
            results.push({ channel: key, method: "bot", status: "channel_not_found" })
            continue
          }
          await postChannelMessage(channelId, { embeds: [embeds[key]] })
          results.push({ channel: key, method: "bot", channel_id: channelId, status: "posted" })
        } catch (err) {
          results.push({ channel: key, method: "bot", status: "error", error: err instanceof Error ? err.message : String(err) })
        }
      }
    }
  }

  const posted = results.filter((r) => r.status === "posted").length
  const errors = results.filter((r) => r.status === "error").length

  return NextResponse.json({
    mode: usingWebhook ? "webhook" : "bot",
    elapsedMs: Date.now() - t0,
    summary: { posted, errors, notFound: results.filter((r) => r.status === "channel_not_found").length },
    results,
  }, { status: errors > 0 ? (posted > 0 ? 207 : 500) : 200 })
}
