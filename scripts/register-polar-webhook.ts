/**
 * register-polar-webhook.ts — 1회용 Polar 웹훅 엔드포인트 등록 스크립트
 *
 * 사용법:
 *   npx tsx scripts/register-polar-webhook.ts
 *
 * 환경변수 (.env.local 또는 셸 export):
 *   POLAR_ACCESS_TOKEN — Polar 대시보드 > Settings > API Tokens
 *
 * 이미 등록된 엔드포인트가 있으면 중복 생성을 피하기 위해 기존 목록을 먼저 출력합니다.
 * 중복 확인 후 실제 등록하려면 --force 플래그를 추가하세요:
 *   npx tsx scripts/register-polar-webhook.ts --force
 */

import { config } from "dotenv"
import { Polar } from "@polar-sh/sdk"

// .env.local 로드
config({ path: ".env.local" })

const WEBHOOK_URL = "https://www.unfoldk.com/api/polar/webhook"

// 구독·결제 이벤트 — 웹훅 핸들러(app/api/polar/webhook/route.ts) 와 동기화
const EVENTS = [
  "subscription.active",
  "subscription.updated",
  "subscription.canceled",
  "subscription.revoked",
  "subscription.uncanceled",
  "order.paid",
] as const

async function main() {
  const accessToken = process.env.POLAR_ACCESS_TOKEN
  if (!accessToken) {
    console.error("❌ POLAR_ACCESS_TOKEN 환경변수가 없습니다.")
    process.exit(1)
  }

  const polar = new Polar({ accessToken })
  const force = process.argv.includes("--force")

  // 기존 웹훅 엔드포인트 목록 확인
  console.log("🔍 기존 웹훅 엔드포인트 조회 중...")
  const existing = await polar.webhooks.listWebhookEndpoints({})
  const items = existing.result?.items ?? []

  if (items.length > 0) {
    console.log(`\n기존 엔드포인트 ${items.length}개:`)
    for (const ep of items) {
      console.log(`  - [${ep.id}] ${ep.url}`)
    }

    const alreadyRegistered = items.some((ep) => ep.url === WEBHOOK_URL)
    if (alreadyRegistered) {
      console.log(`\n✅ ${WEBHOOK_URL} 이미 등록되어 있습니다. 중복 등록을 건너뜁니다.`)
      console.log("   (재등록하려면 Polar 대시보드에서 기존 엔드포인트를 삭제 후 다시 실행)")
      process.exit(0)
    }
  } else {
    console.log("  (등록된 엔드포인트 없음)")
  }

  if (!force) {
    console.log(`\n📋 등록 예정 엔드포인트:`)
    console.log(`   URL:    ${WEBHOOK_URL}`)
    console.log(`   Events: ${EVENTS.join(", ")}`)
    console.log(`\n실제 등록하려면 --force 플래그를 추가하세요:`)
    console.log(`   npx tsx scripts/register-polar-webhook.ts --force`)
    process.exit(0)
  }

  // 웹훅 엔드포인트 등록
  console.log(`\n🚀 웹훅 엔드포인트 등록 중...`)
  const endpoint = await polar.webhooks.createWebhookEndpoint({
    url: WEBHOOK_URL,
    name: "UnfoldK Hallyu Pass",
    format: "raw",
    events: [...EVENTS],
  })

  console.log(`\n✅ 등록 완료!`)
  console.log(`   Endpoint ID: ${endpoint.id}`)
  console.log(`   URL:         ${endpoint.url}`)
  console.log(`   Secret:      ${endpoint.secret}`)
  console.log(`\n⚠️  위 Secret 값을 복사해서 .env.local 과 Vercel 환경변수에 설정하세요:`)
  console.log(`   POLAR_WEBHOOK_SECRET=${endpoint.secret}`)
}

main().catch((err) => {
  console.error("❌ 오류:", err instanceof Error ? err.message : err)
  process.exit(1)
})
