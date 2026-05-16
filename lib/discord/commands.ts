// 슬래시 커맨드 정의 — Discord PUT /applications/{client_id}/guilds/{guild_id}/commands 로 등록
//
// 등록 트리거: app/api/discord/register-commands (CRON_SECRET 인증, 수동/일회성).
// 핸들러: app/api/discord/interactions (서명 검증 후 name 으로 분기).
//
// guild-scoped 등록 → 즉시 반영. global 명령은 최대 1시간 propagation 지연 발생.

// Discord ApplicationCommandOptionType — 본 봇 사용분만
//   3 = STRING, 7 = CHANNEL
const OPT_TYPE_CHANNEL = 7

// Discord channel_types — 자동 포스팅 가능 텍스트/공지 채널만 허용
//   0 = GUILD_TEXT, 5 = GUILD_ANNOUNCEMENT
const POSTABLE_CHANNEL_TYPES = [0, 5] as const

// Discord permission bitmask
//   MANAGE_GUILD = 1 << 5 = 32. /setup 은 서버 관리자만.
const PERM_MANAGE_GUILD = "32"

export interface SlashCommandOption {
  name: string
  description: string
  type: number
  required?: boolean
  channel_types?: readonly number[]
}

// Discord ApplicationCommand 타입 1 = CHAT_INPUT (슬래시)
export interface SlashCommandDef {
  name: string
  description: string
  type: 1
  default_member_permissions?: string
  dm_permission?: boolean
  options?: SlashCommandOption[]
}

export const SLASH_COMMANDS: SlashCommandDef[] = [
  {
    name: "comeback",
    description: "Upcoming K-pop comebacks this week",
    type: 1,
  },
  {
    name: "chart",
    description: "Latest K-pop global Top 10",
    type: 1,
  },
  {
    name: "drama",
    description: "Currently airing K-dramas",
    type: 1,
  },
  {
    name: "korean",
    description: "Korean phrase of the day",
    type: 1,
  },
  {
    name: "about",
    description: "About UnfoldK — your pass to Korean culture",
    type: 1,
  },
  {
    name: "setup",
    description: "Configure HallyuBot daily posting channels (admin only)",
    type: 1,
    default_member_permissions: PERM_MANAGE_GUILD,
    dm_permission: false,
    options: [
      {
        name: "schedule",
        description: "Channel for the daily K-pop & K-drama schedule",
        type: OPT_TYPE_CHANNEL,
        channel_types: POSTABLE_CHANNEL_TYPES,
        required: false,
      },
      {
        name: "charts",
        description: "Channel for the weekly K-pop global Top 10",
        type: OPT_TYPE_CHANNEL,
        channel_types: POSTABLE_CHANNEL_TYPES,
        required: false,
      },
      {
        name: "drama",
        description: "Channel for currently airing K-drama updates",
        type: OPT_TYPE_CHANNEL,
        channel_types: POSTABLE_CHANNEL_TYPES,
        required: false,
      },
      {
        name: "korean",
        description: "Channel for the Korean phrase of the day",
        type: OPT_TYPE_CHANNEL,
        channel_types: POSTABLE_CHANNEL_TYPES,
        required: false,
      },
    ],
  },
]

export type SlashCommandName = (typeof SLASH_COMMANDS)[number]["name"]

export function isKnownCommand(name: string): name is SlashCommandName {
  return SLASH_COMMANDS.some((c) => c.name === name)
}
