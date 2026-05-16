// HallyuBot 슬래시 커맨드 1회성 등록 스크립트
//
// 실행: pnpm discord:register
//
// 필요 환경변수:
//   DISCORD_BOT_TOKEN  — 봇 토큰
//   DISCORD_CLIENT_ID  — Application ID
//   DISCORD_GUILD_ID   — 등록 대상 서버 ID
//
// 본 스크립트는 tsx 가 .env 파일을 자동 로드하지 않으므로, 실행 전 환경변수가 셸에
// 노출돼 있어야 함. .env.local 의 값을 쓰려면 한 가지를 골라 실행:
//   PowerShell:
//     Get-Content .env.local | ForEach-Object {
//       if ($_ -match '^([^#=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2]) }
//     }; pnpm discord:register
//   또는 dotenv-cli 설치 후:
//     pnpm dlx dotenv-cli -e .env.local -- pnpm discord:register
//
// 동작:
//   PUT https://discord.com/api/v10/applications/{CLIENT_ID}/guilds/{GUILD_ID}/commands
//   → guild-scoped 등록 (즉시 반영). 본문 = 전체 명령 배열 → 기존 명령 모두 덮어쓰기.
//
// 명령 정의 single source of truth: lib/discord/commands.ts.
// 본 스크립트는 같은 SLASH_COMMANDS 를 import 해 사용 — 정의 중복 X.

import { SLASH_COMMANDS } from "../lib/discord/commands"

const DISCORD_API_BASE = "https://discord.com/api/v10"

function readEnv(key: string): string {
  const val = process.env[key]
  if (!val || val.length === 0) {
    console.error(`✗ Missing environment variable: ${key}`)
    console.error(`  Tip: see header comment in scripts/register-commands.ts for .env.local loading.`)
    process.exit(1)
  }
  return val
}

async function main(): Promise<void> {
  const botToken = readEnv("DISCORD_BOT_TOKEN")
  const clientId = readEnv("DISCORD_CLIENT_ID")
  const guildId = readEnv("DISCORD_GUILD_ID")

  const url = `${DISCORD_API_BASE}/applications/${clientId}/guilds/${guildId}/commands`
  console.log(`→ PUT ${url}`)
  console.log(`→ Registering ${SLASH_COMMANDS.length} command(s) to guild ${guildId}…`)

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(SLASH_COMMANDS),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`✗ Discord API ${res.status} ${res.statusText}`)
    console.error(body)
    process.exit(1)
  }

  // 응답에서 실제 등록된 결과 구조만 사용 — Discord 가 부여한 command id 까지 받음
  type RegisteredCommand = { id: string; name: string; description: string }
  const registered = (await res.json()) as RegisteredCommand[]

  console.log(`\n✓ Registered ${registered.length} command(s):`)
  for (const cmd of registered) {
    console.log(`  /${cmd.name}  (id=${cmd.id})  — ${cmd.description}`)
  }
}

main().catch((err: unknown) => {
  console.error("✗ Unexpected error:", err)
  process.exit(1)
})
