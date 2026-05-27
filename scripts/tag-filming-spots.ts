#!/usr/bin/env npx tsx
// =============================================================
// scripts/tag-filming-spots.ts
//
// filming_spots 의 scene_description / photo_tip
// Claude Haiku 배치 API 로 자동 생성 (50% 할인).
//
// 실행:
//   npx tsx scripts/tag-filming-spots.ts
//   (환경변수는 .env.local 또는 직접 export 로 주입)
//
// 필요 env:
//   ANTHROPIC_API_KEY
//   NEXT_PUBLIC_SUPABASE_URL  (또는 SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY
//
// 동작:
//   1. scene_description IS NULL + status='confirmed' + spot_name != '__no_spots_found__' 조회
//   2. Claude Haiku 배치 API 제출 (500건 단위 청크)
//   3. 폴링(15초 간격) → 완료 후 결과 수집
//   4. DB 일괄 UPDATE
//
// 재실행 안전: scene_description IS NULL 인 행만 처리 → 이미 완료된 행 스킵
// =============================================================

import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

// ── 환경변수 로드 (.env.local 자동 파싱) ─────────────────────
function loadEnv(): { supabaseUrl: string; serviceKey: string; anthropicKey: string } {
  const envPath = path.resolve(process.cwd(), ".env.local")
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n")
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eqIdx = trimmed.indexOf("=")
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "")
      if (!process.env[key]) process.env[key] = val
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ""
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? ""

  if (!supabaseUrl) throw new Error("SUPABASE_URL (또는 NEXT_PUBLIC_SUPABASE_URL) 미설정")
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY 미설정")
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY 미설정")

  return { supabaseUrl, serviceKey, anthropicKey }
}

// ── 상수 ──────────────────────────────────────────────────────
const CHUNK_SIZE = 500
const POLL_INTERVAL_MS = 15_000
const MAX_WAIT_MS = 40 * 60_000
const UPDATE_CONCURRENCY = 30

// ── Claude 시스템 프롬프트 ────────────────────────────────────
const SYSTEM_PROMPT = `You are a K-drama filming location expert writing for international Hallyu fans.

Given a drama name and filming spot name, output JSON with:
1. scene_description: ONE vivid sentence (max 60 chars) capturing the most iconic scene filmed there.
   - Written like a fan memory: "Where Gong Yoo first appeared to Kim Go-eun in that alley"
   - Must be specific to this spot. If uncertain, write a plausible scene the spot is known for.
   - Korean drama atmosphere, present tense, emotional.
2. photo_tip: ONE practical photo tip for visiting fans (max 80 chars).
   - Best angle, time of day, lens focal length, or key composition detail.
   - Example: "Best at golden hour — stand at the alley entrance for the wide shot"

Output ONLY valid JSON. No markdown, no explanation:
{"scene_description":"...","photo_tip":"..."}`

// ── 타입 ──────────────────────────────────────────────────────
interface SpotRow {
  id: string
  spot_name: string
  drama_title: string
}

interface TagResult {
  scene_description: string | null
  photo_tip: string | null
}

// ── 유틸 ──────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function parseTagResult(raw: string): Partial<TagResult> {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error("JSON 블록 없음")
  return JSON.parse(match[0]) as Partial<TagResult>
}

// ── 메인 ──────────────────────────────────────────────────────
async function main() {
  const env = loadEnv()
  const supabase = createClient(env.supabaseUrl, env.serviceKey, {
    auth: { persistSession: false },
  })
  const anthropic = new Anthropic({ apiKey: env.anthropicKey })

  // 1. 미태깅 촬영지 조회 ─────────────────────────────────────
  console.log("📥 scene_description IS NULL 촬영지 조회 중...")

  const { data: rawSpots, error: fetchErr } = await supabase
    .from("filming_spots")
    .select("id, spot_name, drama_title")
    .is("scene_description", null)
    .eq("status", "confirmed")
    .neq("spot_name", "__no_spots_found__")
    .order("created_at", { ascending: true })

  if (fetchErr) {
    console.error("❌ 조회 실패:", fetchErr.message)
    process.exit(1)
  }

  const spots = (rawSpots ?? []) as SpotRow[]

  if (spots.length === 0) {
    console.log("✅ 태깅할 촬영지 없음 (이미 전체 처리됨).")
    return
  }

  console.log(`📊 처리 대상: ${spots.length}건`)
  console.log(`   청크 크기: ${CHUNK_SIZE} / 예상 배치 수: ${Math.ceil(spots.length / CHUNK_SIZE)}`)

  // 2. 청크 분할 + 배치 제출 ──────────────────────────────────
  let totalUpdated = 0
  let totalFailed = 0

  const chunks: SpotRow[][] = []
  for (let i = 0; i < spots.length; i += CHUNK_SIZE) {
    chunks.push(spots.slice(i, i + CHUNK_SIZE))
  }

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci]
    console.log(`\n━━━ 청크 ${ci + 1}/${chunks.length} (${chunk.length}건) ━━━`)

    const requests = chunk.map((row) => ({
      custom_id: row.id,
      params: {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user" as const,
            content: `Drama: ${row.drama_title}\nFilming spot: ${row.spot_name}`,
          },
        ],
      },
    }))

    let batch: Awaited<ReturnType<typeof anthropic.messages.batches.create>>
    try {
      batch = await anthropic.messages.batches.create({ requests })
    } catch (err) {
      console.error(`❌ 배치 제출 실패:`, err)
      continue
    }
    console.log(`✅ 배치 제출 — ID: ${batch.id}`)

    // 3. 완료 폴링 ──────────────────────────────────────────
    const startMs = Date.now()
    let batchStatus = batch.processing_status

    while (batchStatus !== "ended") {
      if (Date.now() - startMs > MAX_WAIT_MS) {
        console.error(`\n❌ 타임아웃 (40분). 배치 ID: ${batch.id} 를 수동 확인 후 재실행하세요.`)
        break
      }
      await sleep(POLL_INTERVAL_MS)
      const latest = await anthropic.messages.batches.retrieve(batch.id)
      batchStatus = latest.processing_status
      const c = latest.request_counts
      process.stdout.write(
        `\r⏳ 처리 중... 성공: ${c.succeeded} / 실패: ${c.errored} / 전체: ${chunk.length}건`
      )
    }
    console.log()

    if (batchStatus !== "ended") continue

    // 4. 결과 수집 + DB UPDATE ──────────────────────────────
    console.log("💾 결과 → DB UPDATE 중...")

    const updateQueue: Array<() => Promise<void>> = []

    for await (const result of await anthropic.messages.batches.results(batch.id)) {
      if (result.result.type !== "succeeded") {
        console.warn(`  ⚠️  ${result.custom_id} — ${result.result.type}`)
        totalFailed++
        continue
      }

      const content = result.result.message.content[0]
      if (!content || content.type !== "text") {
        totalFailed++
        continue
      }

      let parsed: Partial<TagResult> = {}
      try {
        parsed = parseTagResult(content.text)
      } catch {
        console.warn(`  ⚠️  ${result.custom_id} — JSON 파싱 실패: ${content.text.slice(0, 60)}`)
        totalFailed++
        continue
      }

      const sceneDesc =
        typeof parsed.scene_description === "string" && parsed.scene_description.trim()
          ? parsed.scene_description.trim()
          : null

      const photoTip =
        typeof parsed.photo_tip === "string" && parsed.photo_tip.trim()
          ? parsed.photo_tip.trim()
          : null

      const spotId = result.custom_id

      updateQueue.push(async () => {
        const { error } = await supabase
          .from("filming_spots")
          .update({ scene_description: sceneDesc, photo_tip: photoTip })
          .eq("id", spotId)
        if (error) {
          console.warn(`  ⚠️  ${spotId} UPDATE 실패: ${error.message}`)
          totalFailed++
        } else {
          totalUpdated++
        }
      })
    }

    // 병렬 UPDATE
    for (let i = 0; i < updateQueue.length; i += UPDATE_CONCURRENCY) {
      await Promise.all(updateQueue.slice(i, i + UPDATE_CONCURRENCY).map((fn) => fn()))
      process.stdout.write(`\r  DB 업데이트: ${Math.min(i + UPDATE_CONCURRENCY, updateQueue.length)}/${updateQueue.length}건`)
    }
    console.log(`\n✅ 청크 ${ci + 1} 완료`)
  }

  // 5. 최종 요약 ─────────────────────────────────────────────
  console.log("\n" + "═".repeat(50))
  console.log(`🎉 전체 완료`)
  console.log(`   업데이트: ${totalUpdated}건`)
  console.log(`   실패:     ${totalFailed}건`)
  console.log(`   미처리:   ${spots.length - totalUpdated - totalFailed}건`)
  console.log("=".repeat(50))

  if (totalFailed > 0) {
    console.log("⚠️  실패 행은 scene_description = NULL 상태 유지 → 재실행 시 자동 재처리됩니다.")
  }
}

main().catch((err: unknown) => {
  console.error("\n❌ 스크립트 오류:", err)
  process.exit(1)
})
