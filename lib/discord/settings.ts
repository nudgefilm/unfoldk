// discord_server_settings 헬퍼 — /setup 명령 enrollment + cron 다중 서버 순회
// admin client 만 사용 (RLS service_role bypass). 클라이언트 노출 금지.

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { resolveChannelIdByName } from "@/lib/discord/bot"

// settings.X_channel_id 컬럼 ↔ 채널 키 매핑 — cron / /setup 양쪽이 동일 키 사용
export type ChannelKey = "schedule" | "charts" | "drama" | "korean"

export interface DiscordServerSettings {
  guild_id: string
  schedule_channel_id: string | null
  charts_channel_id: string | null
  drama_channel_id: string | null
  korean_channel_id: string | null
  created_at?: string
  updated_at?: string
}

// 미설정 채널 fallback 후보 — /setup 안 한 키는 announcements → general 순서로 시도
const FALLBACK_CHANNEL_NAMES = ["announcements", "general"] as const

export function columnForKey(key: ChannelKey): keyof DiscordServerSettings {
  switch (key) {
    case "schedule":
      return "schedule_channel_id"
    case "charts":
      return "charts_channel_id"
    case "drama":
      return "drama_channel_id"
    case "korean":
      return "korean_channel_id"
  }
}

export async function getServerSettings(
  guildId: string
): Promise<DiscordServerSettings | null> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("discord_server_settings")
    .select("*")
    .eq("guild_id", guildId)
    .maybeSingle()
  if (error) {
    console.error("[discord/settings] getServerSettings:", error.message)
    return null
  }
  return (data as DiscordServerSettings | null) ?? null
}

export async function listAllServerSettings(): Promise<DiscordServerSettings[]> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("discord_server_settings")
    .select("*")
  if (error) {
    console.error("[discord/settings] listAllServerSettings:", error.message)
    return []
  }
  return (data ?? []) as DiscordServerSettings[]
}

// /setup 호출 시 부분 업데이트 — 지정 안 한 키는 기존 값 유지.
// supabase upsert 가 전체 row 덮어쓰기 라서 read-then-merge 사용.
// 단일 사용자가 /setup 호출하는 시나리오 → race condition 사실상 없음.
export async function upsertServerSettings(
  guildId: string,
  partial: Partial<Pick<
    DiscordServerSettings,
    "schedule_channel_id" | "charts_channel_id" | "drama_channel_id" | "korean_channel_id"
  >>
): Promise<DiscordServerSettings | null> {
  const supabase = createSupabaseAdminClient()
  const existing = await getServerSettings(guildId)

  const merged: DiscordServerSettings = {
    guild_id: guildId,
    schedule_channel_id: partial.schedule_channel_id ?? existing?.schedule_channel_id ?? null,
    charts_channel_id: partial.charts_channel_id ?? existing?.charts_channel_id ?? null,
    drama_channel_id: partial.drama_channel_id ?? existing?.drama_channel_id ?? null,
    korean_channel_id: partial.korean_channel_id ?? existing?.korean_channel_id ?? null,
  }

  const { data, error } = await supabase
    .from("discord_server_settings")
    .upsert(merged, { onConflict: "guild_id" })
    .select()
    .maybeSingle()
  if (error) {
    console.error("[discord/settings] upsertServerSettings:", error.message)
    return null
  }
  return (data as DiscordServerSettings | null) ?? merged
}

// cron 시 각 서버·각 키에 대해 실제 발송할 채널 ID 결정
// 우선순위: settings 의 명시 ID → announcements → general → null (스킵)
export async function resolveChannelForKey(
  settings: DiscordServerSettings,
  key: ChannelKey
): Promise<string | null> {
  const directId = settings[columnForKey(key)] as string | null
  if (directId) return directId

  for (const fallbackName of FALLBACK_CHANNEL_NAMES) {
    try {
      const id = await resolveChannelIdByName(fallbackName, settings.guild_id)
      if (id) return id
    } catch (err) {
      console.error(
        `[discord/settings] fallback ${fallbackName} resolve 실패 (guild=${settings.guild_id}):`,
        err
      )
    }
  }
  return null
}
