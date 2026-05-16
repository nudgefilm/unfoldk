import { NextResponse } from "next/server"
import { verifyDiscordSignature } from "@/lib/discord/verify"
import { isKnownCommand } from "@/lib/discord/commands"
import {
  buildAboutEmbed,
  buildChartCommandEmbed,
  buildComebackEmbed,
  buildDramaCommandEmbed,
  buildKoreanCommandEmbed,
} from "@/lib/discord/embeds"
import {
  fetchAiringDramas,
  fetchTodayKoreanPhrase,
  fetchTop10Chart,
  fetchWeeklyComebacks,
} from "@/lib/discord/data"
import type { DiscordEmbed } from "@/lib/discord/bot"
import { upsertServerSettings } from "@/lib/discord/settings"

export const maxDuration = 10
export const dynamic = "force-dynamic"
export const runtime = "nodejs" // Ed25519 검증 Node crypto 필요

// Discord 인터랙션 webhook
// Discord Developer Portal → General Information → INTERACTIONS ENDPOINT URL 에
// https://unfoldk.com/api/discord/interactions 등록 후 PUBLIC_KEY 로 서명 검증.
//
// 흐름:
//   1. X-Signature-Ed25519 / X-Signature-Timestamp 검증 (실패 시 401 → Discord 자동 차단)
//   2. type=1 (PING) → type=1 (PONG) 즉시 응답
//   3. type=2 (APPLICATION_COMMAND) → 명령명 분기 → Embed 즉시 응답 (type=4)
//
// 3초 내 응답 보장 — DB 조회 + TMDB fetch 가 그 안에 끝남.

interface InteractionOption {
  name: string
  type: number
  value?: string | number | boolean
}

interface DiscordInteractionBody {
  type: number
  guild_id?: string
  member?: {
    permissions?: string // bitmask string (e.g., "8589934591")
  }
  data?: {
    name?: string
    options?: InteractionOption[]
  }
}

const INTERACTION_TYPE_PING = 1
const INTERACTION_TYPE_APPLICATION_COMMAND = 2

const RESPONSE_TYPE_PONG = 1
const RESPONSE_TYPE_CHANNEL_MESSAGE_WITH_SOURCE = 4

// 메시지 응답 flags — EPHEMERAL (1 << 6) = 호출자에게만 표시
const FLAG_EPHEMERAL = 64

// Discord permission bit — MANAGE_GUILD = 1 << 5 = 32. /setup 권한 검증용.
// tsconfig target=ES6 환경이라 BigInt 리터럴(`1n`) 대신 BigInt() 생성자 사용.
const PERM_MANAGE_GUILD = BigInt(32)

function jsonOk(body: object) {
  return NextResponse.json(body, { status: 200 })
}

function embedResponse(embed: DiscordEmbed, ephemeral = false) {
  return jsonOk({
    type: RESPONSE_TYPE_CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [embed],
      ...(ephemeral ? { flags: FLAG_EPHEMERAL } : {}),
    },
  })
}

function ephemeralMessage(content: string) {
  return jsonOk({
    type: RESPONSE_TYPE_CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, flags: FLAG_EPHEMERAL },
  })
}

async function handleSimpleCommand(name: string): Promise<DiscordEmbed> {
  switch (name) {
    case "comeback": {
      const items = await fetchWeeklyComebacks(10)
      return buildComebackEmbed(items)
    }
    case "chart": {
      const items = await fetchTop10Chart()
      return buildChartCommandEmbed(items)
    }
    case "drama": {
      const items = await fetchAiringDramas(5)
      return buildDramaCommandEmbed(items)
    }
    case "korean":
      return buildKoreanCommandEmbed(fetchTodayKoreanPhrase())
    case "about":
    default:
      return buildAboutEmbed()
  }
}

// /setup 옵션 파싱 — 옵션 type=7 (CHANNEL), value 는 channel snowflake string
function findChannelOption(
  options: InteractionOption[] | undefined,
  name: string
): string | undefined {
  if (!options) return undefined
  const opt = options.find((o) => o.name === name && o.type === 7)
  return typeof opt?.value === "string" ? opt.value : undefined
}

function hasManageGuild(permissionsStr: string | undefined): boolean {
  if (!permissionsStr) return false
  try {
    return (BigInt(permissionsStr) & PERM_MANAGE_GUILD) === PERM_MANAGE_GUILD
  } catch {
    return false
  }
}

// /setup 응답 한 줄 — 채널이 설정되면 #mention, 아니면 fallback 안내
function formatSetupRow(label: string, emoji: string, channelId: string | null): string {
  if (channelId) return `${emoji} ${label} → <#${channelId}>`
  return `${emoji} ${label} → _not set (fallback to #announcements or #general)_`
}

async function handleSetup(body: DiscordInteractionBody) {
  // DM 차단 — dm_permission=false 로도 막히지만 이중 안전.
  if (!body.guild_id) {
    return ephemeralMessage("`/setup` can only be used inside a server.")
  }
  if (!hasManageGuild(body.member?.permissions)) {
    return ephemeralMessage(
      "You need the **Manage Server** permission to run `/setup`."
    )
  }

  // 사용자가 지정한 옵션만 partial 로 추출. 미지정 키는 settings 의 기존 값 유지.
  const partial = {
    schedule_channel_id: findChannelOption(body.data?.options, "schedule") ?? null,
    charts_channel_id: findChannelOption(body.data?.options, "charts") ?? null,
    drama_channel_id: findChannelOption(body.data?.options, "drama") ?? null,
    korean_channel_id: findChannelOption(body.data?.options, "korean") ?? null,
  }
  // null 을 명시 전달하면 기존 값 덮어쓸 가능성 → undefined 로 정규화
  const normalized = Object.fromEntries(
    Object.entries(partial).filter(([, v]) => v !== null)
  ) as typeof partial

  if (Object.keys(normalized).length === 0) {
    return ephemeralMessage(
      "Please specify at least one channel option. Example: `/setup schedule:#daily-schedule`"
    )
  }

  const saved = await upsertServerSettings(body.guild_id, normalized)
  if (!saved) {
    return ephemeralMessage(
      "Failed to save settings. Please try again, or contact UnfoldK support."
    )
  }

  const description = [
    "✅ **HallyuBot setup complete!**",
    "",
    formatSetupRow("Schedule", "📅", saved.schedule_channel_id),
    formatSetupRow("Charts", "📊", saved.charts_channel_id),
    formatSetupRow("Drama", "🎬", saved.drama_channel_id),
    formatSetupRow("Korean", "🇰🇷", saved.korean_channel_id),
    "",
    "_Daily posts start at 9:00 AM UTC (6:00 PM KST)._",
  ].join("\n")

  return embedResponse(
    {
      title: "HallyuBot — Channel Setup",
      description,
      color: 0xff4b6e,
    },
    /* ephemeral */ true
  )
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get("x-signature-ed25519")
  const timestamp = request.headers.get("x-signature-timestamp")

  if (!verifyDiscordSignature(rawBody, signature, timestamp)) {
    // Discord 가 endpoint 등록 검증 시 의도적으로 잘못된 서명 보내기도 함 — 반드시 401
    return new NextResponse("invalid request signature", { status: 401 })
  }

  let body: DiscordInteractionBody
  try {
    body = JSON.parse(rawBody) as DiscordInteractionBody
  } catch {
    return new NextResponse("invalid json", { status: 400 })
  }

  // PING — Discord endpoint 등록 검증 시 호출
  if (body.type === INTERACTION_TYPE_PING) {
    return jsonOk({ type: RESPONSE_TYPE_PONG })
  }

  if (body.type === INTERACTION_TYPE_APPLICATION_COMMAND) {
    const name = body.data?.name ?? ""
    if (!isKnownCommand(name)) {
      return embedResponse({
        title: "Unknown command",
        description: `Try \`/about\` for the list of UnfoldK bot commands.`,
        color: 0xff4b6e,
      })
    }
    try {
      if (name === "setup") {
        return await handleSetup(body)
      }
      const embed = await handleSimpleCommand(name)
      return embedResponse(embed)
    } catch (err) {
      console.error(`[discord-interactions] ${name} 처리 실패:`, err)
      return embedResponse({
        title: "Something went wrong",
        description:
          "Try again in a minute, or visit https://unfoldk.com directly.",
        color: 0xff4b6e,
      })
    }
  }

  // 기타 interaction type (component, modal 등) — 향후 확장. 현재는 noop.
  return jsonOk({ type: RESPONSE_TYPE_PONG })
}
