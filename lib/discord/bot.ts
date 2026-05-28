// Discord REST API 클라이언트 — Vercel serverless 환경에서 bot 메시지 발송·채널 조회
// discord.js 미사용 (gateway WebSocket 부담 + serverless 부적합). REST 만으로 일일 포스팅·
// 슬래시 응답 모두 처리 가능.
//
// CLAUDE.md §6 #4: 외부 API 실패 시 fallback 필수 — 호출 측에서 try/catch 후
// recordCronLog 로 실패 기록.

const DISCORD_API_BASE = "https://discord.com/api/v10"

function botToken(): string {
  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) throw new Error("DISCORD_BOT_TOKEN 미설정")
  return token
}

function guildId(): string {
  const id = process.env.DISCORD_GUILD_ID
  if (!id) throw new Error("DISCORD_GUILD_ID 미설정")
  return id
}

function clientId(): string {
  const id = process.env.DISCORD_CLIENT_ID
  if (!id) throw new Error("DISCORD_CLIENT_ID 미설정")
  return id
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bot ${botToken()}`,
    "Content-Type": "application/json",
  }
}

// Discord Embed 객체 — 본 봇에서 사용하는 최소 필드만 타입 정의
export interface DiscordEmbed {
  title?: string
  description?: string
  url?: string
  color?: number // 정수 (예: 0xff4b6e = UnfoldK 브랜드)
  fields?: { name: string; value: string; inline?: boolean }[]
  footer?: { text: string; icon_url?: string }
  thumbnail?: { url: string }
  timestamp?: string // ISO8601
}

interface DiscordChannel {
  id: string
  name: string
  type: number // 0 = GUILD_TEXT, 5 = GUILD_ANNOUNCEMENT
}

// 채널명 → ID 매핑 캐시 (모듈 레벨 — Vercel 함수 인스턴스 동안 유지)
// TTL 10분. multi-guild 지원 — 봇이 여러 서버에 초대된 경우 각 guild 별 캐시.
const CHANNEL_CACHE_TTL_MS = 10 * 60 * 1000
interface GuildChannelCache {
  fetchedAt: number
  byName: Map<string, string>
}
const channelCacheByGuild = new Map<string, GuildChannelCache>()

async function fetchGuildChannels(targetGuildId: string): Promise<DiscordChannel[]> {
  const res = await fetch(`${DISCORD_API_BASE}/guilds/${targetGuildId}/channels`, {
    headers: authHeaders(),
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Discord GET /guilds/${targetGuildId}/channels ${res.status}: ${body}`)
  }
  return (await res.json()) as DiscordChannel[]
}

// 채널명 → ID. 텍스트·공지 채널만 매핑. 캐시 hit 시 fetch 생략.
// guildIdOverride 미지정 시 env DISCORD_GUILD_ID 사용 (기본 봇 서버 단일 모드용).
export async function resolveChannelIdByName(
  name: string,
  guildIdOverride?: string
): Promise<string | null> {
  const targetGuildId = guildIdOverride ?? guildId()
  const now = Date.now()
  let cache = channelCacheByGuild.get(targetGuildId)
  if (!cache || now - cache.fetchedAt > CHANNEL_CACHE_TTL_MS) {
    const channels = await fetchGuildChannels(targetGuildId)
    const byName = new Map<string, string>()
    for (const c of channels) {
      if (c.type === 0 || c.type === 5) {
        byName.set(c.name, c.id)
      }
    }
    cache = { fetchedAt: now, byName }
    channelCacheByGuild.set(targetGuildId, cache)
  }
  return cache.byName.get(name) ?? null
}

export async function postChannelMessage(
  channelId: string,
  payload: { embeds: DiscordEmbed[]; content?: string }
): Promise<void> {
  const res = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Discord POST /channels/${channelId}/messages ${res.status}: ${body}`)
  }
}

// 슬래시 명령 등록 — guild-scoped (즉시 반영). global 은 최대 1시간 지연.
export async function registerGuildCommands(
  commands: unknown[]
): Promise<{ count: number }> {
  const res = await fetch(
    `${DISCORD_API_BASE}/applications/${clientId()}/guilds/${guildId()}/commands`,
    {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(commands),
    }
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Discord PUT commands ${res.status}: ${body}`)
  }
  const registered = (await res.json()) as unknown[]
  return { count: registered.length }
}

// 캐시 강제 무효화 — 테스트 / 채널 추가 직후 수동 갱신용
// guildIdOverride 미지정 시 전체 캐시 비움.
export function clearChannelCache(guildIdOverride?: string): void {
  if (guildIdOverride) {
    channelCacheByGuild.delete(guildIdOverride)
  } else {
    channelCacheByGuild.clear()
  }
}

// 봇 자신의 계정 정보 — GET /users/@me (토큰 유효성·봇 ID 확인용)
export async function getBotIdentity(): Promise<{ id: string; username: string; bot: boolean } | null> {
  const res = await fetch(`${DISCORD_API_BASE}/users/@me`, {
    headers: authHeaders(),
    cache: "no-store",
  })
  if (!res.ok) return null
  return (await res.json()) as { id: string; username: string; bot: boolean }
}

// 봇이 해당 길드의 멤버인지 확인 — GET /guilds/:id/members/@me
export async function getBotGuildMember(
  targetGuildId: string
): Promise<{ joined_at: string; roles: string[] } | { error: number; message: string } | null> {
  const res = await fetch(`${DISCORD_API_BASE}/guilds/${targetGuildId}/members/@me`, {
    headers: authHeaders(),
    cache: "no-store",
  })
  const body = await res.json() as Record<string, unknown>
  if (!res.ok) return { error: (body.code as number) ?? res.status, message: (body.message as string) ?? "" }
  return { joined_at: body.joined_at as string, roles: (body.roles as string[]) ?? [] }
}

// 특정 채널 정보 조회 — GET /channels/:id (채널 존재·타입 확인용)
export async function getChannelInfo(
  channelId: string
): Promise<{ id: string; name: string; type: number } | { error: number; message: string } | null> {
  const res = await fetch(`${DISCORD_API_BASE}/channels/${channelId}`, {
    headers: authHeaders(),
    cache: "no-store",
  })
  const body = await res.json() as Record<string, unknown>
  if (!res.ok) return { error: (body.code as number) ?? res.status, message: (body.message as string) ?? "" }
  return { id: body.id as string, name: body.name as string, type: body.type as number }
}
