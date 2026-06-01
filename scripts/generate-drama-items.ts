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
}
loadEnv()

// ── CLI 파라미터 ──────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = args.includes("--dry-run")
const limitIdx = args.indexOf("--limit")
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1] ?? "50", 10) : 50

// ── 클라이언트 초기화 ─────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── 타입 ──────────────────────────────────────────────────────
type Category = "fashion" | "beauty" | "lifestyle"

interface DramaItemInsert {
  drama_id: string
  name: string
  category: Category
  brand: string | null
  description: string | null
  purchase_url: null  // 어드민이 직접 입력
  is_approved: false
}

interface ExtractedItem {
  name: string
  category: Category
  brand: string | null
  description: string | null
}

interface DramaRow {
  id: string
  title: string
  overview: string | null
  genres: string[] | null
}

// ── Claude Haiku 추출 ─────────────────────────────────────────
async function extractItems(drama: DramaRow): Promise<ExtractedItem[]> {
  const genreText = drama.genres?.join(", ") || "Korean drama"
  const overviewText = drama.overview
    ? drama.overview.slice(0, 500)
    : "No overview available."

  const prompt = `You are a K-drama fashion and lifestyle curator.

Drama: "${drama.title}"
Genre: ${genreText}
Overview: ${overviewText}

Extract 3 to 5 iconic fashion, beauty, or lifestyle items that are strongly associated with this drama's aesthetic, characters, or memorable scenes. Focus on items fans would actually want to buy.

Return a JSON array (no markdown) with this exact structure:
[
  {
    "name": "item name (specific, not generic)",
    "category": "fashion" | "beauty" | "lifestyle",
    "brand": "brand name if identifiable, otherwise null",
    "description": "1-2 sentences why fans love this item from the drama"
  }
]`

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    system: "You extract K-drama related fashion/beauty/lifestyle items. Return valid JSON only, no markdown.",
    messages: [{ role: "user", content: prompt }],
  })

  const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : ""
  // JSON 배열만 추출
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error(`JSON 파싱 실패: ${text.slice(0, 100)}`)

  const parsed = JSON.parse(match[0]) as unknown[]
  const items: ExtractedItem[] = []
  for (const raw of parsed) {
    if (typeof raw !== "object" || raw === null) continue
    const item = raw as Record<string, unknown>
    const cat = item.category as string
    if (!["fashion", "beauty", "lifestyle"].includes(cat)) continue
    items.push({
      name: String(item.name ?? "").slice(0, 200),
      category: cat as Category,
      brand: item.brand ? String(item.brand).slice(0, 100) : null,
      description: item.description ? String(item.description).slice(0, 500) : null,
    })
  }
  return items.slice(0, 5)
}

// ── 메인 ──────────────────────────────────────────────────────
async function main() {
  console.log(`[generate-drama-items] DRY_RUN=${DRY_RUN} LIMIT=${LIMIT}`)

  // 1) 드라마 목록 조회
  const { data: dramas, error: dramasErr } = await supabase
    .from("dramas")
    .select("id, title, overview, genres")
    .order("popularity", { ascending: false })
    .limit(LIMIT)

  if (dramasErr || !dramas) {
    console.error("dramas 조회 실패:", dramasErr?.message)
    process.exit(1)
  }
  console.log(`[generate-drama-items] 대상 드라마: ${dramas.length}편`)

  // 2) 이미 아이템이 있는 drama_id 목록 조회
  const dramaIds = dramas.map((d) => d.id)
  const { data: existing } = await supabase
    .from("drama_items")
    .select("drama_id")
    .in("drama_id", dramaIds)

  const existingSet = new Set<string>(
    (existing ?? []).map((r: { drama_id: string }) => r.drama_id)
  )

  const todo = (dramas as DramaRow[]).filter((d) => !existingSet.has(d.id))
  console.log(`[generate-drama-items] 스킵(이미 아이템 있음): ${dramas.length - todo.length}편, 처리: ${todo.length}편`)

  let totalInserted = 0
  let totalErrors = 0

  for (const drama of todo) {
    try {
      const items = await extractItems(drama)
      console.log(`  ✓ ${drama.title} → ${items.length}개`)
      if (DRY_RUN) {
        for (const it of items) {
          console.log(`    [${it.category}] ${it.name}${it.brand ? ` (${it.brand})` : ""}`)
        }
        continue
      }

      const rows: DramaItemInsert[] = items.map((it) => ({
        drama_id: drama.id,
        ...it,
        purchase_url: null,
        is_approved: false,
      }))

      const { error: insertErr } = await supabase.from("drama_items").insert(rows)
      if (insertErr) throw new Error(insertErr.message)
      totalInserted += rows.length
    } catch (err) {
      console.error(`  ✗ ${drama.title}: ${err instanceof Error ? err.message : String(err)}`)
      totalErrors++
    }
    // API 레이트 리밋 방지
    await new Promise((r) => setTimeout(r, 300))
  }

  console.log(`\n[generate-drama-items] 완료: inserted=${totalInserted} errors=${totalErrors}${DRY_RUN ? " (dry-run)" : ""}`)
}

main().catch((err) => {
  console.error("[generate-drama-items] 치명적 오류:", err)
  process.exit(1)
})
