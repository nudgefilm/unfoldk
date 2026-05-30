#!/usr/bin/env npx tsx
// =============================================================
// scripts/generate-scene-descriptions.ts
//
// korean_phrases.scene_description IS NULL 인 표현을
// Claude Haiku 배치 API (50% 할인) 로 자동 생성.
//
// 실행:
//   npx tsx scripts/generate-scene-descriptions.ts
//
// 필요 env (.env.local 자동 로드):
//   ANTHROPIC_API_KEY
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// 비용: ~888건 × 200 토큰 × $0.5/1M = ~$0.09
// =============================================================

import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

// ── 환경변수 로드 ─────────────────────────────────────────────
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local")
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
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
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? ""

  if (!supabaseUrl)  throw new Error("SUPABASE_URL 미설정")
  if (!serviceKey)   throw new Error("SUPABASE_SERVICE_ROLE_KEY 미설정")
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY 미설정")

  return { supabaseUrl, serviceKey, anthropicKey }
}

// ── 상수 ──────────────────────────────────────────────────────
const MODEL          = "claude-haiku-4-5-20251001"
const CHUNK_SIZE     = 1_000
const POLL_MS        = 15_000    // 15초
const MAX_WAIT_MS    = 40 * 60_000
const UPDATE_CONCURRENCY = 30

// ── 시스템 프롬프트 ───────────────────────────────────────────
const SYSTEM = `You are a K-drama scene descriptor for a Korean language learning app.

Given a Korean expression, its English meaning, the drama title, and optionally an episode tag, write a vivid 1–2 sentence scene description in English.

Rules:
- Be specific and emotionally evocative — help the learner picture the moment
- Focus on the scene context where this phrase would naturally appear
- Do NOT invent plot details you aren't sure about; write what is plausible given the expression
- Do NOT quote the expression directly in the description
- Output ONLY the scene description text — no quotes, no JSON, no explanation`

// ── 타입 ──────────────────────────────────────────────────────
interface PhraseRow {
  id: string
  korean: string
  english: string | null
  drama_name: string | null
  episode_tag: string | null
}

// ── 유틸 ──────────────────────────────────────────────────────
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

function buildUserMessage(row: PhraseRow): string {
  const parts = [
    `Drama: ${row.drama_name ?? "Unknown K-drama"}`,
    `Korean: ${row.korean}`,
    row.english    ? `English: ${row.english}`        : null,
    row.episode_tag ? `Episode: ${row.episode_tag}`   : null,
  ]
  return parts.filter(Boolean).join("\n")
}

// ── 메인 ──────────────────────────────────────────────────────
async function main() {
  const env = loadEnv()
  const supabase = createClient(env.supabaseUrl, env.serviceKey, { auth: { persistSession: false } })
  const anthropic = new Anthropic({ apiKey: env.anthropicKey })

  // 1. 미생성 표현 조회 ─────────────────────────────────────
  console.log("📥 scene_description IS NULL 표현 조회 중...")

  const { data, error } = await supabase
    .from("korean_phrases")
    .select("id, korean, english, drama_name, episode_tag")
    .is("scene_description", null)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("❌ 조회 실패:", error.message)
    process.exit(1)
  }

  const phrases = (data ?? []) as PhraseRow[]

  if (phrases.length === 0) {
    console.log("✅ 처리할 표현 없음 (scene_description 전부 등록됨).")
    return
  }

  console.log(`📊 처리 대상: ${phrases.length}건`)
  console.log(`   예상 비용: ~$${(phrases.length * 0.0001).toFixed(2)} (Haiku 50% 배치)`)

  // 2. 청크 분할 + 배치 제출 ──────────────────────────────────
  let totalUpdated = 0
  let totalFailed  = 0
  const failedIds: string[] = []

  const chunks: PhraseRow[][] = []
  for (let i = 0; i < phrases.length; i += CHUNK_SIZE) {
    chunks.push(phrases.slice(i, i + CHUNK_SIZE))
  }

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci]
    console.log(`\n━━━ 청크 ${ci + 1}/${chunks.length} (${chunk.length}건) ━━━`)

    const requests = chunk.map((row) => ({
      custom_id: row.id,
      params: {
        model: MODEL,
        max_tokens: 200,
        system: SYSTEM,
        messages: [{ role: "user" as const, content: buildUserMessage(row) }],
      },
    }))

    let batch: Awaited<ReturnType<typeof anthropic.messages.batches.create>>
    try {
      batch = await anthropic.messages.batches.create({ requests })
    } catch (err) {
      console.error(`❌ 배치 제출 실패:`, err)
      totalFailed += chunk.length
      continue
    }
    console.log(`✅ 배치 제출 — ID: ${batch.id}`)

    // 3. 폴링 ────────────────────────────────────────────────
    const startMs = Date.now()
    let status = batch.processing_status

    while (status !== "ended") {
      if (Date.now() - startMs > MAX_WAIT_MS) {
        console.error(`\n❌ 40분 타임아웃 — 배치 ${batch.id} 수동 확인 후 재실행하세요.`)
        break
      }
      await sleep(POLL_MS)
      const latest = await anthropic.messages.batches.retrieve(batch.id)
      status = latest.processing_status
      const c = latest.request_counts
      process.stdout.write(
        `\r⏳ 폴링 중... 완료: ${c.succeeded + c.errored}/${chunk.length} (성공: ${c.succeeded}, 실패: ${c.errored})`
      )
    }
    console.log()

    if (status !== "ended") continue

    // 4. 결과 수집 + DB UPDATE ──────────────────────────────
    console.log("💾 결과 수집 → DB 업데이트 중...")

    const updateQueue: Array<() => Promise<void>> = []

    for await (const result of await anthropic.messages.batches.results(batch.id)) {
      if (result.result.type !== "succeeded") {
        console.warn(`  ⚠️  ${result.custom_id} — ${result.result.type}`)
        totalFailed++
        failedIds.push(result.custom_id)
        continue
      }

      const content = result.result.message.content[0]
      if (!content || content.type !== "text") {
        totalFailed++
        failedIds.push(result.custom_id)
        continue
      }

      const sceneDesc = content.text.trim()
      if (!sceneDesc) {
        totalFailed++
        failedIds.push(result.custom_id)
        continue
      }

      const phraseId = result.custom_id
      updateQueue.push(async () => {
        const { error: upErr } = await supabase
          .from("korean_phrases")
          .update({ scene_description: sceneDesc })
          .eq("id", phraseId)
        if (upErr) {
          console.warn(`  ⚠️  ${phraseId} UPDATE 실패: ${upErr.message}`)
          totalFailed++
          failedIds.push(phraseId)
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

  // 5. 요약 ─────────────────────────────────────────────────
  console.log("\n" + "═".repeat(50))
  console.log("🎉 완료")
  console.log(`   업데이트: ${totalUpdated}건`)
  console.log(`   실패:     ${totalFailed}건`)
  if (failedIds.length > 0) {
    console.log("\n실패 ID 목록 (재실행 시 자동 재처리):")
    failedIds.forEach((id) => console.log(`  - ${id}`))
  }
  console.log("═".repeat(50))
}

main().catch((err: unknown) => {
  console.error("\n❌ 스크립트 오류:", err)
  process.exit(1)
})
