// beauty_suppliers_staging 영문 변환 — Supabase Edge Function
//
// POST /functions/v1/translate-pipeline
// Headers: Authorization: Bearer <CRON_SECRET>
// Body (optional JSON): { "max_batches": 25 }
//
// 자동 주입 시크릿: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// 수동 등록 시크릿: ANTHROPIC_API_KEY, CRON_SECRET
//
// 동작:
//   1. beauty_suppliers_staging WHERE translate_status='pending' 전체 조회 (페이지네이션)
//   2. 20건씩 배치로 Claude Haiku 호출 (1 API call / 배치)
//   3. 결과 UPDATE (translate_status: 'completed' | 'failed')
//   4. { processed, completed, failed, remaining } JSON 반환

import { createClient } from "npm:@supabase/supabase-js@2"
import Anthropic from "npm:@anthropic-ai/sdk@0.35.0"

// ── 상수 ──────────────────────────────────────────────────────────────────────
const BATCH_SIZE         = 20
const DEFAULT_MAX_BATCHES = 50  // 기본 1,000건/호출 — 타임아웃 방지

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

// ── Claude 시스템 프롬프트 ─────────────────────────────────────────────────────
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
  rows: StagingRow[],
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

  const jsonMatch = rawText.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []

  const parsed = JSON.parse(jsonMatch[0]) as unknown[]
  return parsed.filter((item): item is TranslatedItem => {
    if (typeof item !== "object" || item === null) return false
    const o = item as Record<string, unknown>
    return typeof o.id === "string" && typeof o.company_name_en === "string"
  })
}

// ── 핸들러 ────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    })
  }

  // 인증 — CRON_SECRET Bearer 토큰
  const cronSecret = Deno.env.get("CRON_SECRET")
  if (cronSecret) {
    const authHeader = req.headers.get("Authorization") ?? ""
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }
  }

  // 요청 바디 파싱 (optional)
  let maxBatches = DEFAULT_MAX_BATCHES
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    if (typeof body.max_batches === "number" && body.max_batches > 0) {
      maxBatches = body.max_batches
    }
  } catch { /* body 없음 — 기본값 사용 */ }

  // 환경변수
  const supabaseUrl     = Deno.env.get("SUPABASE_URL")     ?? ""
  const serviceRoleKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? ""

  if (!supabaseUrl || !serviceRoleKey || !anthropicApiKey) {
    return new Response(
      JSON.stringify({ error: "Missing required environment variables" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }

  const supabase  = createClient(supabaseUrl, serviceRoleKey)
  const anthropic = new Anthropic({ apiKey: anthropicApiKey })

  try {
    // 1. pending 전체 조회 (Supabase 1,000행 캡 우회 — 페이지네이션)
    const rows: StagingRow[] = []
    const FETCH_PAGE = 1000
    let fetchFrom = 0
    while (true) {
      const { data, error } = await supabase
        .from("beauty_suppliers_staging")
        .select("id, company_name_ko, address_ko")
        .eq("translate_status", "pending")
        .range(fetchFrom, fetchFrom + FETCH_PAGE - 1)

      if (error) throw new Error(`Supabase 조회 오류: ${error.message}`)
      if (!data || data.length === 0) break
      rows.push(...(data as StagingRow[]))
      if (data.length < FETCH_PAGE) break
      fetchFrom += FETCH_PAGE
    }

    const totalPending = rows.length
    if (totalPending === 0) {
      return new Response(
        JSON.stringify({ message: "번역 대기 항목 없음", processed: 0, completed: 0, failed: 0, remaining: 0 }),
        { headers: { "Content-Type": "application/json" } },
      )
    }

    // 2. 배치 처리 (max_batches 제한)
    const totalBatches    = Math.ceil(rows.length / BATCH_SIZE)
    const batchesToRun    = Math.min(totalBatches, maxBatches)
    const rowsToProcess   = rows.slice(0, batchesToRun * BATCH_SIZE)

    let completed = 0
    let failed    = 0

    for (let batchIdx = 0; batchIdx < batchesToRun; batchIdx++) {
      const start     = batchIdx * BATCH_SIZE
      const batchRows = rowsToProcess.slice(start, start + BATCH_SIZE)

      let translated: TranslatedItem[] = []
      let batchFailed = false

      try {
        translated = await translateBatch(anthropic, batchRows)
      } catch {
        batchFailed = true
      }

      if (batchFailed) {
        await supabase
          .from("beauty_suppliers_staging")
          .update({ translate_status: "failed" })
          .in("id", batchRows.map(r => r.id))
        failed += batchRows.length
      } else {
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
          }),
        )
      }
    }

    const processed = completed + failed
    const remaining = totalPending - processed

    return new Response(
      JSON.stringify({
        processed,
        completed,
        failed,
        remaining,
        total_pending_at_start: totalPending,
      }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
})
