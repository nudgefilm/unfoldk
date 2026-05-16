import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { registerGuildCommands } from "@/lib/discord/bot"
import { SLASH_COMMANDS } from "@/lib/discord/commands"

export const maxDuration = 30
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Discord 슬래시 커맨드 등록 트리거 (수동 일회성 호출)
// 호출 예 (PowerShell):
//   curl.exe -H "Authorization: Bearer $env:CRON_SECRET" `
//            https://unfoldk.com/api/discord/register-commands
//
// guild-scoped 등록 → 즉시 반영. 명령어 변경 시 본 endpoint 재호출.
// global 명령은 최대 1시간 propagation 지연이라 본 봇에선 미사용.

export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  if (
    !process.env.DISCORD_BOT_TOKEN ||
    !process.env.DISCORD_CLIENT_ID ||
    !process.env.DISCORD_GUILD_ID
  ) {
    return NextResponse.json(
      { error: "DISCORD_BOT_TOKEN / DISCORD_CLIENT_ID / DISCORD_GUILD_ID 미설정" },
      { status: 500 }
    )
  }

  try {
    const { count } = await registerGuildCommands(SLASH_COMMANDS)
    return NextResponse.json({
      ok: true,
      registered: count,
      commands: SLASH_COMMANDS.map((c) => c.name),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown"
    console.error("[discord/register-commands]", msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
