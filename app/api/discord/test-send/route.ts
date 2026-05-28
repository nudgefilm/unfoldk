// 어드민 전용 — discord-daily 실제 전송 로직 직접 실행 후 즉시 결과 반환.
// Vercel Cron이 불확실할 때 수동 트리거·디버깅용.
import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
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

const CHANNEL_KEYS: readonly ChannelKey[] = ["schedule", "charts", "drama", "korean"] as const

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

async function resolveChannelId(
  guildId: string,
  key: ChannelKey,
  settings: DiscordServerSettings | undefined
): Promise<string | null> {
  if (settings) return resolveChannelForKey(settings, key)
  try {
    return await resolveChannelIdByName(LEGACY_CHANNEL_NAMES[key], guildId)
  } catch (err) {
    console.error(`[test-send legacy resolve ${guildId} ${key}]`, err)
    return null
  }
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: isAdminUser } = await supabase.rpc("is_admin", { uid: user.id })
  if (!isAdminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!process.env.DISCORD_BOT_TOKEN) {
    return NextResponse.json({ error: "DISCORD_BOT_TOKEN 미설정" }, { status: 500 })
  }

  const t0 = Date.now()

  // 발송 대상 서버 결정 (discord-daily 와 동일 로직)
  const enrolled = await listAllServerSettings()
  const enrolledMap = new Map(enrolled.map((s) => [s.guild_id, s]))
  const envGuildId = process.env.DISCORD_GUILD_ID ?? null

  const targetGuildIds = new Set<string>(enrolled.map((s) => s.guild_id))
  if (envGuildId && !enrolledMap.has(envGuildId)) {
    targetGuildIds.add(envGuildId)
  }

  if (targetGuildIds.size === 0) {
    return NextResponse.json({
      note: "No enrolled servers and no DISCORD_GUILD_ID",
      enrolledSettings: enrolled,
    })
  }

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

  // 전송
  const allResults: PostResult[] = []
  for (const guildId of targetGuildIds) {
    const settings = enrolledMap.get(guildId)
    for (const key of CHANNEL_KEYS) {
      try {
        const channelId = await resolveChannelId(guildId, key, settings)
        if (!channelId) {
          allResults.push({ guild_id: guildId, channel: key, status: "channel_not_found" })
          continue
        }
        await postChannelMessage(channelId, { embeds: [embeds[key]] })
        allResults.push({ guild_id: guildId, channel: key, channel_id: channelId, status: "posted" })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        allResults.push({ guild_id: guildId, channel: key, status: "error", error: msg })
      }
    }
  }

  const posted = allResults.filter((r) => r.status === "posted").length
  const errors = allResults.filter((r) => r.status === "error").length

  return NextResponse.json({
    elapsedMs: Date.now() - t0,
    summary: { posted, errors, notFound: allResults.filter((r) => r.status === "channel_not_found").length },
    enrolledSettings: enrolled,
    targetGuilds: [...targetGuildIds],
    results: allResults,
  }, { status: errors > 0 ? (posted > 0 ? 207 : 500) : 200 })
}
