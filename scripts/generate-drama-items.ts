#!/usr/bin/env npx tsx
// =============================================================
// scripts/generate-drama-items.ts
//
// dramas DB 기준으로 드라마별 패션/뷰티/라이프스타일 아이템 3~5개 자동 추출.
// Claude Haiku 사용. is_approved = false 로 저장 (어드민 검토 대기).
// 이미 아이템이 있는 드라마는 스킵 (멱등).
//
// 실행:
//   npx tsx scripts/generate-drama-items.ts
//   npx tsx scripts/generate-drama-items.ts --dry-run   # 저장 없이 결과만 출력
//   npx tsx scripts/generate-drama-items.ts --limit 10  # 최대 10편만 처리
//
// 필요 env (.env.local 자동 로드):
//   ANTHROPIC_API_KEY
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// 비용 추정:
//   드라마 N편 × ~600 tokens × $0.001/1K = N × $0.0006
//   예) 100편 → ~$0.06
// =============================================================

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"
import { generateItemsForDramas } from "../lib/drama-items/generate"

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
}
loadEnv()

// ── CLI 파라미터 ──────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = args.includes("--dry-run")
const limitIdx = args.indexOf("--limit")
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1] ?? "0", 10) : null

// ── Supabase 직접 초기화 (스크립트용 — admin client 경로 우회) ─
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log(`[generate-drama-items] DRY_RUN=${DRY_RUN} LIMIT=${LIMIT ?? "전체"}`)

  let query = supabase
    .from("dramas")
    .select("id, title, overview, genre")
    .order("popularity", { ascending: false })
  if (LIMIT !== null) query = query.limit(LIMIT)

  const { data: dramas, error } = await query

  if (error || !dramas) {
    console.error("dramas 조회 실패:", error?.message)
    process.exit(1)
  }
  console.log(`[generate-drama-items] 대상 드라마: ${dramas.length}편`)

  const results = await generateItemsForDramas(
    dramas as Array<{ id: string; title: string; overview: string | null; genre: string | null }>,
    { dryRun: DRY_RUN, delayMs: 300 }
  )

  let inserted = 0
  let skipped = 0
  let errors = 0
  for (const r of results) {
    if (r.skipped) {
      skipped++
    } else if (r.error) {
      errors++
      console.error(`  ✗ ${r.title}: ${r.error}`)
    } else {
      inserted += r.generated
      console.log(`  ✓ ${r.title} → ${r.generated}개`)
    }
  }

  console.log(`\n[generate-drama-items] 완료: inserted=${inserted} skipped=${skipped} errors=${errors}${DRY_RUN ? " (dry-run)" : ""}`)
}

main().catch((err) => {
  console.error("[generate-drama-items] 치명적 오류:", err)
  process.exit(1)
})
