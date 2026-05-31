#!/usr/bin/env npx tsx
// =============================================================
// scripts/generate-drama-phrases.ts
//
// korean_phrases 에 등록된 전체 드라마를 순회하며
// 중급(intermediate) · 고급(advanced) 문장 패턴 표현을
// 드라마당 각 3개씩 자동 생성 → DB 저장.
//
// 멱등: 이미 해당 드라마에 difficulty 별 표현이 3개 이상이면 스킵.
// 저작권: Claude 가 드라마 실제 대사를 직접 인용하지 않고
//         "이 드라마 분위기에서 쓸 법한" 예시 문장으로 재가공.
//
// 실행:
//   npx tsx scripts/generate-drama-phrases.ts
//   npx tsx scripts/generate-drama-phrases.ts --dry-run  # 실제 저장 없이 확인
//
// 필요 env (.env.local 자동 로드):
//   ANTHROPIC_API_KEY
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// 비용 추정:
//   드라마 N편 × 2 difficulty × 1콜 × ~600토큰 = N × $0.0006
//   예) 50편 → ~$0.03
// =============================================================

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"
import { generateDramaPhrases } from "../lib/claude/korean-phrase"

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

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? ""

  if (!supabaseUrl)  throw new Error("NEXT_PUBLIC_SUPABASE_URL 미설정")
  if (!serviceKey)   throw new Error("SUPABASE_SERVICE_ROLE_KEY 미설정")
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY 미설정")

  return { supabaseUrl, serviceKey }
}

// ── 상수 ──────────────────────────────────────────────────────
// 드라마당 목표 최소 보유 표현 수 (미달 시 Claude 생성)
const TARGET_PER_DIFFICULTY = 3
// 드라마 간 호출 딜레이 (Haiku rate-limit 회피)
const DELAY_MS = 800

const DIFFICULTIES = ["intermediate", "advanced"] as const

// ── sleep helper ──────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── 메인 ──────────────────────────────────────────────────────
async function main() {
  const isDryRun = process.argv.includes("--dry-run")
  if (isDryRun) console.log("[generate-drama-phrases] ⚠️  DRY-RUN 모드 — DB 저장 안 함")

  const { supabaseUrl, serviceKey } = loadEnv()
  const supabase = createClient(supabaseUrl, serviceKey)

  // 1. 전체 드라마 목록 수집 (drama_id + drama_name 쌍, drama_name IS NOT NULL)
  const { data: allPhrases, error: listErr } = await supabase
    .from("korean_phrases")
    .select("drama_id, drama_name")
    .not("drama_name", "is", null)

  if (listErr) throw new Error(`드라마 목록 조회 실패: ${listErr.message}`)

  // 중복 제거 (drama_name 기준 — drama_id 없는 경우도 있음)
  const dramaMap = new Map<string, { drama_id: string | null; drama_name: string }>()
  for (const row of allPhrases ?? []) {
    const r = row as { drama_id: string | null; drama_name: string }
    if (!dramaMap.has(r.drama_name)) {
      dramaMap.set(r.drama_name, { drama_id: r.drama_id, drama_name: r.drama_name })
    }
  }

  const dramas = [...dramaMap.values()]
  console.log(`[generate-drama-phrases] 총 드라마: ${dramas.length}편`)

  // 2. 현재 difficulty별 보유 현황 조회
  const { data: existingCounts, error: countErr } = await supabase
    .from("korean_phrases")
    .select("drama_name, difficulty")
    .in("difficulty", ["intermediate", "advanced"])
    .not("drama_name", "is", null)

  if (countErr) throw new Error(`기존 표현 조회 실패: ${countErr.message}`)

  // drama_name + difficulty 별 카운트 맵
  const countMap = new Map<string, number>()
  for (const row of existingCounts ?? []) {
    const r = row as { drama_name: string; difficulty: string }
    const key = `${r.drama_name}::${r.difficulty}`
    countMap.set(key, (countMap.get(key) ?? 0) + 1)
  }

  // 3. 드라마 순회
  let totalGenerated = 0
  let totalSkipped   = 0
  let totalFailed    = 0

  for (let i = 0; i < dramas.length; i++) {
    const { drama_id, drama_name } = dramas[i]
    // drama_name 을 영문 제목으로 사용 (DB에 영문명이 저장된 경우), 한글 제목은 추정 불가 → 영문만 전달
    const dramaEn = drama_name
    const dramaKo = drama_name  // korean_phrases.drama_name 은 보통 영문. 한글 없어도 Claude 가 처리.

    for (const difficulty of DIFFICULTIES) {
      const key = `${drama_name}::${difficulty}`
      const currentCount = countMap.get(key) ?? 0

      if (currentCount >= TARGET_PER_DIFFICULTY) {
        console.log(`  ✓ skip  [${difficulty}] ${drama_name} (보유 ${currentCount}개)`)
        totalSkipped++
        continue
      }

      const needed = TARGET_PER_DIFFICULTY - currentCount
      console.log(`  → gen   [${difficulty}] ${drama_name} (보유 ${currentCount} → 목표 ${TARGET_PER_DIFFICULTY}, 생성 예정 3개)`)

      if (isDryRun) {
        totalSkipped++
        continue
      }

      const result = await generateDramaPhrases({ dramaKo, dramaEn, difficulty })

      if (!result.ok) {
        console.error(`  ✗ fail  [${difficulty}] ${drama_name}: ${result.reason} ${result.detail ?? ""}`)
        totalFailed++
        await sleep(DELAY_MS)
        continue
      }

      // 실제로 필요한 만큼만 저장 (이미 일부 있는 경우 needed < 3)
      const toInsert = result.payloads.slice(0, needed).map((p) => ({
        drama_id:      drama_id,
        drama_name:    drama_name,
        korean:        p.korean,
        romanization:  p.romanization,
        english:       p.english,
        word_breakdown: p.word_breakdown,
        synonyms:      p.synonyms,
        antonyms:      p.antonyms,
        difficulty:    p.difficulty,
      }))

      const { error: insertErr } = await supabase
        .from("korean_phrases")
        .insert(toInsert)

      if (insertErr) {
        console.error(`  ✗ insert fail [${difficulty}] ${drama_name}: ${insertErr.message}`)
        totalFailed++
      } else {
        console.log(`  ✓ saved ${toInsert.length}개 [${difficulty}] ${drama_name}`)
        totalGenerated += toInsert.length
      }

      await sleep(DELAY_MS)
    }

    // 진행률 표시 (10편마다)
    if ((i + 1) % 10 === 0) {
      console.log(`[generate-drama-phrases] 진행 ${i + 1}/${dramas.length}편 | 생성 ${totalGenerated}개 | 스킵 ${totalSkipped} | 실패 ${totalFailed}`)
    }
  }

  console.log("\n[generate-drama-phrases] 완료")
  console.log(`  생성: ${totalGenerated}개`)
  console.log(`  스킵: ${totalSkipped}건`)
  console.log(`  실패: ${totalFailed}건`)
}

main().catch((err) => {
  console.error("[generate-drama-phrases] 치명 오류:", err)
  process.exit(1)
})
