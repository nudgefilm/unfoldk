import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { getBotIdentity, getBotGuildMember, getChannelInfo } from "@/lib/discord/bot"
import { listAllServerSettings } from "@/lib/discord/settings"

const ENV_GUILD_ID = process.env.DISCORD_GUILD_ID ?? null

// 사용자 확인 채널 ID (참조용) — cron 실제 사용 ID 는 DB 에서 옴
const KNOWN_CHANNEL_IDS = {
  schedule: "1505158601222783026",
  charts: "1505158658902851734",
  drama: "1505158724107501619",
  korean: "1505158766759514162",
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: isAdminUser } = await supabase.rpc("is_admin", { uid: user.id })
  if (!isAdminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // 1) 봇 identity
  const identity = await getBotIdentity().catch((e: unknown) => ({ error: String(e) }))

  // 2) 봇 guild 멤버십 (env guild_id)
  const guildMember = ENV_GUILD_ID
    ? await getBotGuildMember(ENV_GUILD_ID).catch((e: unknown) => ({ error: String(e) }))
    : { error: "DISCORD_GUILD_ID 미설정" }

  // 3) DB에 저장된 서버 설정 (cron이 실제로 사용하는 채널 ID)
  const enrolledSettings = await listAllServerSettings()

  // 4) 알려진 채널 ID 4개 접근 가능 여부 (참조용)
  const knownChannelChecks = await Promise.all(
    Object.entries(KNOWN_CHANNEL_IDS).map(async ([name, id]) => {
      const info = await getChannelInfo(id).catch((e: unknown) => ({ error: String(e) }))
      return [name, { id, ...info }]
    })
  )

  // 5) DB에 저장된 채널 ID도 개별 접근 체크
  const dbChannelChecks: Record<string, unknown> = {}
  for (const s of enrolledSettings) {
    const keys = {
      schedule: s.schedule_channel_id,
      charts: s.charts_channel_id,
      drama: s.drama_channel_id,
      korean: s.korean_channel_id,
    }
    const checks = await Promise.all(
      Object.entries(keys).map(async ([key, channelId]) => {
        if (!channelId) return [key, { id: null, status: "not_configured" }]
        const info = await getChannelInfo(channelId).catch((e: unknown) => ({ error: String(e) }))
        return [key, { id: channelId, ...info }]
      })
    )
    dbChannelChecks[s.guild_id] = Object.fromEntries(checks)
  }

  // 6) cron_logs 최근 discord-daily 기록 (컬럼: route, executed_at, result_json)
  const admin = createSupabaseAdminClient()
  const { data: recentLogs } = await admin
    .from("cron_logs")
    .select("executed_at, status, result_json")
    .eq("route", "discord-daily")
    .order("executed_at", { ascending: false })
    .limit(5)

  return NextResponse.json({
    env: {
      guild_id: ENV_GUILD_ID,
      token_set: !!process.env.DISCORD_BOT_TOKEN,
    },
    bot: identity,
    guildMember,
    enrolledSettings,
    knownChannels: Object.fromEntries(knownChannelChecks),
    dbChannels: dbChannelChecks,
    recentCronLogs: recentLogs ?? [],
  })
}
