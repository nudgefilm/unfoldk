#!/usr/bin/env npx tsx
// =============================================================
// scripts/tag-food-drama.ts
//
// food_recipes 에 drama_title / episode_tag / scene_description 자동 태깅.
// Claude Haiku 배치 API 사용 (50% 할인).
// 태깅 완료 후 이번 주차(featured_week)를 현재 ISO 주차로 설정.
//
// 실행:
//   npx tsx scripts/tag-food-drama.ts
//
// 필요 env:
//   ANTHROPIC_API_KEY
//   NEXT_PUBLIC_SUPABASE_URL  (또는 SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY
//
// 동작:
//   1. drama_title IS NULL 인 레시피 전체 조회
//   2. Claude Haiku 배치 API 제출 (200건 단위 청크)
//   3. 폴링(15초 간격) → 완료 후 결과 수집
//   4. drama_title 있는 결과만 DB UPDATE
//   5. featured_week 미설정인 drama_title 있는 레시피 중 최대 9개 선정 → 이번 주차 set
//
// 재실행 안전: drama_title IS NULL 인 행만 처리 → 이미 완료된 행 스킵
// featured_week 도 미설정인 행만 대상 → 중복 set 없음
// =============================================================

import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

// ── 환경변수 로드 (.env.local 자동 파싱) ──────────────────────
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

// ── ISO 주차 문자열 반환 (예: "2026-W22") ──────────────────────
function getISOWeekStr(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`
}

// ── 상수 ──────────────────────────────────────────────────────
const CHUNK_SIZE = 200              // 배치 청크 크기 (Haiku 배치 최대 10,000 이하 여유)
const POLL_INTERVAL_MS = 15_000    // 15초 폴링
const MAX_WAIT_MS = 40 * 60_000    // 40분 타임아웃
const UPDATE_CONCURRENCY = 30      // DB UPDATE 병렬 수
const FEATURED_MAX = 9             // 이번 주 featured_week 선정 최대 레시피 수 (3개 드라마 × 3)

// ── Claude 시스템 프롬프트 ────────────────────────────────────
const SYSTEM_PROMPT = `You are a K-drama food expert for UnfoldK.

Given a Korean food name (and optional English name), identify which famous K-drama this food is associated with. Focus on iconic scenes where this food appears — e.g., 라면 in "Crash Landing on You", 치킨 in "My Mister", 삼겹살 in "Itaewon Class".

Output ONLY valid JSON with NO markdown:
{
  "drama_title": "English drama title (e.g. 'Crash Landing on You')" or null if no famous drama association,
  "episode_tag": "Episode reference (e.g. 'Ep 4', 'Season 1 Ep 7')" or null if uncertain,
  "scene_description": "One vivid sentence describing the iconic scene in English" or null if no clear scene
}

Rules:
- drama_title MUST be the official English title or well-known romanization
- Only set drama_title if you are confident (≥70% sure) about the association
- If multiple dramas feature this food, pick the most iconic/famous one
- scene_description should be fan-friendly and emotionally evocative
- Output null for all fields if food has no clear K-drama connection`

// ── 타입 ──────────────────────────────────────────────────────
interface RecipeRow {
  id: string
  title: string
  title_en: string | null
}

interface TagResult {
  drama_title: string | null
  episode_tag: string | null
  scene_description: string | null
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

  // 1. 미태깅 레시피 조회 ───────────────────────────────────────
  console.log("📥 drama_title IS NULL 레시피 조회 중...")

  const { data: rawRecipes, error: fetchErr } = await supabase
    .from("food_recipes")
    .select("id, title, title_en")
    .is("drama_title", null)
    .order("id", { ascending: true })

  if (fetchErr) {
    console.error("❌ 조회 실패:", fetchErr.message)
    process.exit(1)
  }

  const recipes = (rawRecipes ?? []) as RecipeRow[]

  if (recipes.length === 0) {
    console.log("✅ 태깅할 레시피 없음 (이미 전체 처리됨).")
    await setFeaturedWeek(supabase)
    return
  }

  console.log(`📊 처리 대상: ${recipes.length}건`)
  console.log(`   청크 크기: ${CHUNK_SIZE} / 예상 배치 수: ${Math.ceil(recipes.length / CHUNK_SIZE)}`)

  // 2. 청크 분할 + 배치 제출 ──────────────────────────────────
  let totalUpdated = 0
  let totalSkipped = 0  // drama 없음 (null 결과)
  let totalFailed = 0

  const chunks: RecipeRow[][] = []
  for (let i = 0; i < recipes.length; i += CHUNK_SIZE) {
    chunks.push(recipes.slice(i, i + CHUNK_SIZE))
  }

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci]
    console.log(`\n━━━ 청크 ${ci + 1}/${chunks.length} (${chunk.length}건) ━━━`)

    const requests = chunk.map((row) => ({
      custom_id: row.id,
      params: {
        model: "claude-haiku-4-5-20251001" as const,
        max_tokens: 200,
        system: [
          {
            type: "text" as const,
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" as const },
          },
        ],
        messages: [
          {
            role: "user" as const,
            content: [
              `Food: ${row.title}`,
              row.title_en ? ` (${row.title_en})` : "",
            ].join(""),
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

    // 3. 완료 폴링 ──────────────────────────────────────────────
    const startMs = Date.now()
    let batchStatus = batch.processing_status

    while (batchStatus !== "ended") {
      if (Date.now() - startMs > MAX_WAIT_MS) {
        console.error(`\n❌ 타임아웃. 배치 ID: ${batch.id} 수동 확인 후 재실행하세요.`)
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

    // 4. 결과 수집 + DB UPDATE ──────────────────────────────────
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

      // drama_title 없으면 DB 업데이트 스킵 (drama 미연결 음식)
      if (!parsed.drama_title || typeof parsed.drama_title !== "string") {
        totalSkipped++
        continue
      }

      const dramaTitle = parsed.drama_title.trim()
      const episodeTag =
        typeof parsed.episode_tag === "string" && parsed.episode_tag.trim()
          ? parsed.episode_tag.trim()
          : null
      const sceneDesc =
        typeof parsed.scene_description === "string" && parsed.scene_description.trim()
          ? parsed.scene_description.trim()
          : null
      const recipeId = result.custom_id

      updateQueue.push(async () => {
        const { error } = await supabase
          .from("food_recipes")
          .update({
            drama_title: dramaTitle,
            episode_tag: episodeTag,
            scene_description: sceneDesc,
          })
          .eq("id", recipeId)
        if (error) {
          console.warn(`  ⚠️  ${recipeId} UPDATE 실패: ${error.message}`)
          totalFailed++
        } else {
          totalUpdated++
        }
      })
    }

    // 병렬 UPDATE
    for (let i = 0; i < updateQueue.length; i += UPDATE_CONCURRENCY) {
      await Promise.all(updateQueue.slice(i, i + UPDATE_CONCURRENCY).map((fn) => fn()))
      process.stdout.write(
        `\r  DB 업데이트: ${Math.min(i + UPDATE_CONCURRENCY, updateQueue.length)}/${updateQueue.length}건`
      )
    }
    console.log(`\n✅ 청크 ${ci + 1} 완료`)
  }

  // 5. 최종 요약 ─────────────────────────────────────────────
  console.log("\n" + "═".repeat(50))
  console.log(`🎉 태깅 완료`)
  console.log(`   드라마 태그 set:  ${totalUpdated}건`)
  console.log(`   드라마 없음 skip: ${totalSkipped}건`)
  console.log(`   실패:             ${totalFailed}건`)
  console.log("═".repeat(50))

  if (totalFailed > 0) {
    console.log("⚠️  실패 행은 drama_title = NULL 상태 유지 → 재실행 시 자동 재처리됩니다.")
  }

  // 6. featured_week 자동 설정 ──────────────────────────────────
  await setFeaturedWeek(supabase)
}

// ── featured_week 자동 설정 ─────────────────────────────────
// drama_title 있는 레시피 중 featured_week 미설정 → 이번 주차로 set.
// 드라마별 최대 3개 레시피, 최대 3개 드라마 → 총 9개 이하.
async function setFeaturedWeek(supabase: ReturnType<typeof createClient>) {
  const currentWeek = getISOWeekStr(new Date())
  console.log(`\n📅 featured_week 설정 중 (${currentWeek})...`)

  // 이미 이번 주차 featured 레시피 있으면 스킵
  const { data: existing } = await supabase
    .from("food_recipes")
    .select("id")
    .eq("featured_week", currentWeek)
    .limit(1)

  if (existing && existing.length > 0) {
    console.log(`✅ 이번 주차(${currentWeek}) featured 레시피 이미 존재 — 스킵.`)
    return
  }

  // drama_title 있고 featured_week 없는 레시피 조회 → 드라마별 그룹핑
  const { data: candidates } = await supabase
    .from("food_recipes")
    .select("id, drama_title")
    .not("drama_title", "is", null)
    .is("featured_week", null)
    .order("drama_title")
    .limit(200)

  if (!candidates || candidates.length === 0) {
    console.log("⚠️  featured_week 설정할 레시피 없음 (drama_title 있는 레시피가 없거나 전부 이미 설정됨).")
    return
  }

  // 드라마별 그룹핑
  const byDrama = new Map<string, string[]>()
  for (const row of candidates as { id: string; drama_title: string | null }[]) {
    if (!row.drama_title) continue
    const list = byDrama.get(row.drama_title) ?? []
    list.push(row.id)
    byDrama.set(row.drama_title, list)
  }

  // 드라마 최대 3개 선정 (레시피 많은 순)
  const sortedDramas = [...byDrama.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)

  // 드라마당 최대 3개 레시피 선정
  const selectedIds: string[] = []
  for (const [drama, ids] of sortedDramas) {
    const picked = ids.slice(0, 3)
    selectedIds.push(...picked)
    console.log(`  📺 ${drama} → ${picked.length}개 레시피 선정`)
  }

  if (selectedIds.length === 0) {
    console.log("⚠️  선정된 레시피 없음.")
    return
  }

  // DB UPDATE — featured_week set
  const { error } = await supabase
    .from("food_recipes")
    .update({ featured_week: currentWeek })
    .in("id", selectedIds)

  if (error) {
    console.error("❌ featured_week UPDATE 실패:", error.message)
  } else {
    console.log(`✅ ${selectedIds.length}개 레시피에 featured_week = "${currentWeek}" 설정 완료.`)
  }
}

main().catch((err: unknown) => {
  console.error("\n❌ 스크립트 오류:", err)
  process.exit(1)
})
