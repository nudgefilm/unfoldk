// beauty_suppliers_staging 영문 변환 스크립트
//
// 실행:
//   pnpm dlx dotenv-cli -e .env.local -- pnpm tsx scripts/translate-pipeline.ts
//
// 필요 환경변수 (.env.local):
//   ANTHROPIC_API_KEY         — Claude Haiku 호출
//   NEXT_PUBLIC_SUPABASE_URL  — Supabase 프로젝트 URL
//   SUPABASE_SERVICE_ROLE_KEY — RLS 우회용 서비스 롤 키
//
// 동작:
//   1. beauty_suppliers_staging WHERE translate_status='pending' 전체 조회
//   2. 20건씩 배치로 Claude Haiku 호출 (1 API call / 배치)
//   3. 결과 UPDATE (translate_status: 'completed' | 'failed')
//   4. 배치별 진행 현황 + 최종 요약 출력

import { createClient } from "@supabase/supabase-js"
import Anthropic from "@anthropic-ai/sdk"

// ── 환경변수 ──────────────────────────────────────────────────────────────────
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? ""
const SUPA_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const SUPA_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

if (!ANTHROPIC_KEY) { console.error("❌ ANTHROPIC_API_KEY 미설정"); process.exit(1) }
if (!SUPA_URL)      { console.error("❌ NEXT_PUBLIC_SUPABASE_URL 미설정"); process.exit(1) }
if (!SUPA_KEY)      { console.error("❌ SUPABASE_SERVICE_ROLE_KEY 미설정"); process.exit(1) }

// ── 상수 ──────────────────────────────────────────────────────────────────────
const BATCH_SIZE = 20

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface StagingRow {
  id: string
  company_name_ko: string
  address_ko: string | null
}

interface TranslatedItem {
  id: string
  company_name_en: string
  address_en: string
  city_en: string
  state_en: string
}

// ── Claude 시스템 프롬프트 (route.ts와 동일) ──────────────────────────────────
const SYSTEM_PROMPT = `You are a Korean-to-English business address translator for a B2B directory.
Convert Korean company names and addresses to standard English business format.
Rules:
- company_name_en: English legal entity name (e.g. "주식회사 주노뷰티" → "JUNO BEAUTY Co., Ltd.", "유한회사 ABC" → "ABC LLC")
- address_en: Full English street address
- city_en: City in English (e.g. "강남구" → "Gangnam-gu", "서울특별시" → "Seoul")
- state_en: Province/region in English (e.g. "경기도" → "Gyeonggi-do", "서울" → "Seoul")
- If a field cannot be determined, use an empty string ""
- Respond ONLY with a valid JSON array, no markdown, no explanation`

// ── 배치 1회 Claude 호출 ──────────────────────────────────────────────────────
async function translateBatch(
  anthropic: Anthropic,
  rows: StagingRow[]
): Promise<TranslatedItem[]> {
  const inputPayload = rows.map(r => ({
    id:              r.id,
    company_name_ko: r.company_name_ko,
    address_ko:      r.address_ko ?? "",
  }))

  const userMessage = `Convert each entry to English business format. Return a JSON array with the same order:
${JSON.stringify(inputPayload, null, 2)}

Return format (array of objects):
[{"id":"<same id>","company_name_en":"...","address_en":"...","city_en":"...","state_en":"..."}]`

  const response = await anthropic.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: [
      {
        type:          "text",
        text:          SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  })

  const textBlock = response.content.find(b => b.type === "text")
  const rawText   = textBlock && textBlock.type === "text" ? textBlock.text.trim() : ""

  // JSON 배열 추출 (markdown 코드블록 대비)
  const jsonMatch = rawText.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []

  const parsed = JSON.parse(jsonMatch[0]) as unknown[]
  return parsed.filter((item): item is TranslatedItem => {
    if (typeof item !== "object" || item === null) return false
    const o = item as Record<string, unknown>
    return typeof o.id === "string" && typeof o.company_name_en === "string"
  })
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
async function main() {
  const supabase  = createClient(SUPA_URL, SUPA_KEY)
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY })

  // 1. pending 건수 먼저 확인 + 전체 조회 (Supabase 기본 1,000행 캡 우회 — 페이지네이션)
  console.log("\n[1/3] translate_status='pending' 건수 확인 중...")
  const { count: pendingCount, error: countErr } = await supabase
    .from("beauty_suppliers_staging")
    .select("*", { count: "exact", head: true })
    .eq("translate_status", "pending")

  if (countErr) {
    console.error("❌ Supabase 카운트 오류:", countErr.message)
    process.exit(1)
  }

  console.log(`   → 현재 pending: ${(pendingCount ?? 0).toLocaleString()}건`)

  if ((pendingCount ?? 0) === 0) {
    console.log("   → 번역 대기 항목 없음. 종료합니다.")
    return
  }

  console.log("   → 전체 조회 중...")
  const rows: StagingRow[] = []
  const FETCH_PAGE = 1000
  let fetchFrom = 0
  while (true) {
    const { data, error: fetchErr } = await supabase
      .from("beauty_suppliers_staging")
      .select("id, company_name_ko, address_ko")
      .eq("translate_status", "pending")
      .range(fetchFrom, fetchFrom + FETCH_PAGE - 1)

    if (fetchErr) {
      console.error("❌ Supabase 조회 오류:", fetchErr.message)
      process.exit(1)
    }

    if (!data || data.length === 0) break
    rows.push(...(data as StagingRow[]))
    if (data.length < FETCH_PAGE) break
    fetchFrom += FETCH_PAGE
  }

  const totalBatches = Math.ceil(rows.length / BATCH_SIZE)
  console.log(`   → 조회 완료: ${rows.length.toLocaleString()}건 / ${totalBatches}배치 (${BATCH_SIZE}건/배치)`)

  // 2. 배치 처리
  console.log("\n[2/3] Claude Haiku 번역 시작...")
  let completed = 0
  let failed    = 0

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const start     = batchIdx * BATCH_SIZE
    const batchRows = rows.slice(start, start + BATCH_SIZE)

    let translated: TranslatedItem[] = []
    let batchFailed = false

    try {
      translated = await translateBatch(anthropic, batchRows)
    } catch (err) {
      console.warn(`\n  ⚠️  배치 ${batchIdx + 1} Claude 호출 실패:`, err instanceof Error ? err.message : String(err))
      batchFailed = true
    }

    if (batchFailed) {
      // Claude 호출 자체 실패 → 배치 전체 failed
      await supabase
        .from("beauty_suppliers_staging")
        .update({ translate_status: "failed" })
        .in("id", batchRows.map(r => r.id))
      failed += batchRows.length
    } else {
      // 성공·실패 row별 UPDATE
      const translatedMap = new Map(translated.map(t => [t.id, t]))

      await Promise.all(
        batchRows.map(async row => {
          const t = translatedMap.get(row.id)
          if (t && t.company_name_en) {
            const { error } = await supabase
              .from("beauty_suppliers_staging")
              .update({
                company_name_en:  t.company_name_en,
                address_en:       t.address_en  || null,
                city_en:          t.city_en     || null,
                state_en:         t.state_en    || null,
                translate_status: "completed",
              })
              .eq("id", row.id)
            if (!error) completed++
            else        failed++
          } else {
            await supabase
              .from("beauty_suppliers_staging")
              .update({ translate_status: "failed" })
              .eq("id", row.id)
            failed++
          }
        })
      )
    }

    // 배치별 진행 현황
    const pct = (((batchIdx + 1) / totalBatches) * 100).toFixed(1)
    process.stdout.write(
      `\r  진행: ${batchIdx + 1}/${totalBatches}배치 (${pct}%) | 완료 ${completed.toLocaleString()}건 | 실패 ${failed.toLocaleString()}건`
    )
  }

  // 3. 최종 요약
  console.log("\n\n[3/3] 완료")
  console.log("─".repeat(40))
  console.log(`  전체 대상:  ${rows.length.toLocaleString()}건`)
  console.log(`  변환 완료:  ${completed.toLocaleString()}건`)
  console.log(`  변환 실패:  ${failed.toLocaleString()}건`)
  console.log("─".repeat(40))
}

main().catch(err => {
  console.error("❌ 예외:", err)
  process.exit(1)
})
