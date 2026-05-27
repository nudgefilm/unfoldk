#!/usr/bin/env npx tsx
// =============================================================
// scripts/tag-korean-phrases.ts
//
// korean_phrases 의 emotion_tag / episode_tag / scene_description
// Claude Haiku 배치 API 로 자동 태깅 (50% 할인).
//
// 실행:
//   npx tsx scripts/tag-korean-phrases.ts
//   (환경변수는 .env.local 또는 직접 export 로 주입)
//
// 필요 env:
//   ANTHROPIC_API_KEY
//   NEXT_PUBLIC_SUPABASE_URL  (또는 SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY
//
// 동작:
//   1. emotion_tag IS NULL 인 표현 전체 조회 (dramas JOIN → 드라마명)
//   2. Claude Haiku 배치 API 제출 (1,000건 단위 청크)
//   3. 폴링(15초 간격) → 완료 후 결과 수집
//   4. DB 일괄 UPDATE
//
// 재실행 안전: emotion_tag IS NULL 인 행만 처리 → 이미 완료된 행 스킵
// =============================================================

import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

// ── 환경변수 로드 (.env.local 자동 파싱) ─────────────────────
function loadEnv(): { supabaseUrl: string; serviceKey: string; anthropicKey: string } {
  // .env.local 파일이 있으면 파싱
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

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ""
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? ""

  if (!supabaseUrl) throw new Error("SUPABASE_URL (또는 NEXT_PUBLIC_SUPABASE_URL) 미설정")
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY 미설정")
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY 미설정")

  return { supabaseUrl, serviceKey, anthropicKey }
}

// ── 상수 ──────────────────────────────────────────────────────
const EMOTION_TAGS = ["로맨틱", "코믹", "감동", "일상", "우정"] as const
type EmotionTag = (typeof EMOTION_TAGS)[number]
const CHUNK_SIZE = 1_000           // Anthropic 배치 최대 10,000 이하로 여유 있게
const POLL_INTERVAL_MS = 15_000    // 15초 폴링
const MAX_WAIT_MS = 40 * 60_000    // 40분 타임아웃
const UPDATE_CONCURRENCY = 30      // DB UPDATE 병렬 수

// ── Claude 시스템 프롬프트 ────────────────────────────────────
const SYSTEM_PROMPT = `You are a K-drama Korean expression classifier.

Given a drama name, Korean expression, and its English meaning, output JSON with:
1. emotion_tag: EXACTLY ONE of [로맨틱, 코믹, 감동, 일상, 우정]
   - 로맨틱: romantic, love, attraction, longing, confession
   - 코믹: funny, awkward, embarrassing, playful
   - 감동: moving, touching, tearful, heartfelt, bittersweet
   - 일상: everyday, casual, neutral, practical
   - 우정: friendship, loyalty, camaraderie, teamwork
2. episode_tag: Episode reference if you can confidently infer (e.g. "Ep 8", "Season 1 Ep 3"). null if uncertain.
3. scene_description: One sentence describing the scene context in English. Be vivid and specific if you know the drama.

Output ONLY valid JSON. No markdown, no explanation:
{"emotion_tag":"...","episode_tag":"..." or null,"scene_description":"..."}`

// ── 타입 ──────────────────────────────────────────────────────
interface PhraseRow {
  id: string
  korean: string
  english: string | null
  drama_title: string | null
}

interface TagResult {
  emotion_tag: EmotionTag | null
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

  // 1. 미태깅 표현 조회 ─────────────────────────────────────
  console.log("📥 emotion_tag IS NULL 표현 조회 중...")

  // korean_phrases → dramas JOIN (drama_id FK 가정)
  // 구조가 다를 경우 (예: pack_id 경유) 아래 select 쿼리 조정 필요.
  const { data: rawPhrases, error: fetchErr } = await supabase
    .from("korean_phrases")
    .select("id, korean, english, drama_id, dramas(title)")
    .is("emotion_tag", null)
    .not("drama_id", "is", null)
    .order("created_at", { ascending: true })

  if (fetchErr) {
    console.error("❌ 조회 실패:", fetchErr.message)
    console.error("   힌트: drama_id 컬럼이 다른 이름이면 쿼리 수정 필요")
    process.exit(1)
  }

  // drama_id 없는 표현도 포함 (드라마명 없이 텍스트만으로 분류)
  const { data: noDramaRaw } = await supabase
    .from("korean_phrases")
    .select("id, korean, english")
    .is("emotion_tag", null)
    .is("drama_id", null)

  type RawRow = {
    id: string
    korean: string
    english: string | null
    drama_id?: string | null
    dramas?: { title?: string | null } | null
  }

  const phrases: PhraseRow[] = [
    ...((rawPhrases ?? []) as RawRow[]).map((p) => ({
      id: p.id,
      korean: p.korean,
      english: p.english ?? null,
      drama_title:
        (p.dramas && typeof p.dramas === "object" && "title" in p.dramas
          ? (p.dramas as { title?: string | null }).title
          : null) ?? null,
    })),
    ...((noDramaRaw ?? []) as RawRow[]).map((p) => ({
      id: p.id,
      korean: p.korean,
      english: p.english ?? null,
      drama_title: null,
    })),
  ]

  if (phrases.length === 0) {
    console.log("✅ 태깅할 표현 없음 (이미 전체 처리됨).")
    return
  }

  console.log(`📊 처리 대상: ${phrases.length}건`)
  console.log(`   청크 크기: ${CHUNK_SIZE} / 예상 배치 수: ${Math.ceil(phrases.length / CHUNK_SIZE)}`)

  // 2. 청크 분할 + 배치 제출 ──────────────────────────────────
  let totalUpdated = 0
  let totalFailed = 0

  const chunks: PhraseRow[][] = []
  for (let i = 0; i < phrases.length; i += CHUNK_SIZE) {
    chunks.push(phrases.slice(i, i + CHUNK_SIZE))
  }

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci]
    console.log(`\n━━━ 청크 ${ci + 1}/${chunks.length} (${chunk.length}건) ━━━`)

    // 배치 요청 생성
    const requests = chunk.map((row) => ({
      custom_id: row.id,
      params: {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 180,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user" as const,
            content: [
              "Drama:", row.drama_title ?? "Unknown K-drama",
              "\nKorean:", row.korean,
              row.english ? `\nEnglish: ${row.english}` : "",
            ].join(""),
          },
        ],
      },
    }))

    // 배치 제출
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

      // emotion_tag 유효성 검증
      const emotion: EmotionTag | null = EMOTION_TAGS.includes(parsed.emotion_tag as EmotionTag)
        ? (parsed.emotion_tag as EmotionTag)
        : null

      const phraseId = result.custom_id
      const episodeTag =
        typeof parsed.episode_tag === "string" && parsed.episode_tag.trim()
          ? parsed.episode_tag.trim()
          : null
      const sceneDesc =
        typeof parsed.scene_description === "string" && parsed.scene_description.trim()
          ? parsed.scene_description.trim()
          : null

      updateQueue.push(async () => {
        const { error } = await supabase
          .from("korean_phrases")
          .update({ emotion_tag: emotion, episode_tag: episodeTag, scene_description: sceneDesc })
          .eq("id", phraseId)
        if (error) {
          console.warn(`  ⚠️  ${phraseId} UPDATE 실패: ${error.message}`)
          totalFailed++
        } else {
          totalUpdated++
        }
      })
    }

    // 병렬 UPDATE (UPDATE_CONCURRENCY 개씩)
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
  console.log(`   미처리:   ${phrases.length - totalUpdated - totalFailed}건`)
  console.log("=" .repeat(50))

  if (totalFailed > 0) {
    console.log("⚠️  실패 행은 emotion_tag = NULL 상태 유지 → 재실행 시 자동 재처리됩니다.")
  }
}

main().catch((err: unknown) => {
  console.error("\n❌ 스크립트 오류:", err)
  process.exit(1)
})
