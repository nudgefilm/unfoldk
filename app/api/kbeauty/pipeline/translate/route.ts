import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const client = new Anthropic()
const BATCH_SIZE = 20

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

// 한글 업체명·주소 → 영문 법인명·도로명 주소 일괄 변환
// 단독 한글 입력 시 Apollo.io 매핑 성공률 5% 미만 → 전처리 필수
const SYSTEM_PROMPT = `You are a Korean-to-English business address translator for a B2B directory.
Convert Korean company names and addresses to standard English business format.
Rules:
- company_name_en: English legal entity name (e.g. "주식회사 주노뷰티" → "JUNO BEAUTY Co., Ltd.", "유한회사 ABC" → "ABC LLC")
- address_en: Full English street address
- city_en: City in English (e.g. "강남구" → "Gangnam-gu", "서울특별시" → "Seoul")
- state_en: Province/region in English (e.g. "경기도" → "Gyeonggi-do", "서울" → "Seoul")
- If a field cannot be determined, use an empty string ""
- Respond ONLY with a valid JSON array, no markdown, no explanation`

export async function POST() {
  // ── 1. 세션 인증 ──────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // ── 2. 어드민 검증 ────────────────────────────────────────────────────────
  const admin = createSupabaseAdminClient()
  const { data: userRow } = await admin
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()
  if (!userRow?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // ── 3. pending 항목 조회 ──────────────────────────────────────────────────
  const { data: pendingRows, error: fetchErr } = await admin
    .from("beauty_suppliers_staging")
    .select("id, company_name_ko, address_ko")
    .eq("translate_status", "pending")
    .limit(BATCH_SIZE)

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!pendingRows || pendingRows.length === 0) {
    return NextResponse.json({ processed: 0, success: 0, failed: 0, message: "번역 대기 항목 없음" })
  }

  const rows = pendingRows as StagingRow[]
  let success = 0
  let failed = 0

  // ── 4. Claude Haiku 일괄 변환 (배치 20개 → 1 API 호출) ───────────────────
  const inputPayload = rows.map(r => ({
    id: r.id,
    company_name_ko: r.company_name_ko,
    address_ko: r.address_ko ?? "",
  }))

  const userMessage = `Convert each entry to English business format. Return a JSON array with the same order:
${JSON.stringify(inputPayload, null, 2)}

Return format (array of objects):
[{"id":"<same id>","company_name_en":"...","address_en":"...","city_en":"...","state_en":"..."}]`

  let translated: TranslatedItem[] = []

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    })

    const textBlock = response.content.find(b => b.type === "text")
    const rawText = textBlock && textBlock.type === "text" ? textBlock.text.trim() : ""

    // JSON 추출 (markdown 코드블록 대비)
    const jsonMatch = rawText.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as unknown[]
      translated = parsed.filter((item): item is TranslatedItem => {
        if (typeof item !== "object" || item === null) return false
        const o = item as Record<string, unknown>
        return typeof o.id === "string" && typeof o.company_name_en === "string"
      })
    }
  } catch {
    // Claude 호출 자체 실패 → 전체 배치 failed 처리
    await admin
      .from("beauty_suppliers_staging")
      .update({ translate_status: "failed" })
      .in("id", rows.map(r => r.id))
    return NextResponse.json({ processed: rows.length, success: 0, failed: rows.length })
  }

  // ── 5. 결과 UPDATE ────────────────────────────────────────────────────────
  const translatedMap = new Map(translated.map(t => [t.id, t]))

  await Promise.all(
    rows.map(async row => {
      const t = translatedMap.get(row.id)
      if (t && t.company_name_en) {
        const { error } = await admin
          .from("beauty_suppliers_staging")
          .update({
            company_name_en: t.company_name_en,
            address_en: t.address_en || null,
            city_en: t.city_en || null,
            state_en: t.state_en || null,
            translate_status: "completed",
          })
          .eq("id", row.id)
        if (!error) success++
        else failed++
      } else {
        await admin
          .from("beauty_suppliers_staging")
          .update({ translate_status: "failed" })
          .eq("id", row.id)
        failed++
      }
    })
  )

  return NextResponse.json({ processed: rows.length, success, failed })
}
