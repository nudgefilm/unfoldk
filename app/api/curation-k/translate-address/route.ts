import { NextResponse } from "next/server"
import { z } from "zod"
import Anthropic from "@anthropic-ai/sdk"

// /api/curation-k/translate-address — 한국어 주소 → 영문 변환 (lazy, 모달 전용)
//
// 캐싱: Vercel CDN s-maxage 7일 + Next fetch 캐시 동등. 동일 주소 반복 호출 차단.
// 입력은 query param `text` (GET) — CDN 캐시 키로 자연스럽게 사용.
//
// 비용: Haiku ~50 tokens out × $5/1M = $0.00025/주소. 캐시 적중 시 0.
// 모델: claude-haiku-4-5-20251001 (CLAUDE.md §6 AI 처리 원칙 — 변환은 Haiku).

export const revalidate = 604800 // 7일

const client = new Anthropic()

const QuerySchema = z.object({
  text: z.string().trim().min(1).max(200),
})

const SYSTEM_PROMPT = `You are a Korean address translator.

Given a Korean address string (Hangul, possibly with English mixed in), output the standard English Romanization used in tourism / postal contexts.

Strict rules:
- Output the address only. No explanation, no quotes, no preamble.
- Use widely-accepted Romanization (e.g., "Seoul", "Gangnam-gu", "Insadong", "Myeong-dong"). Prefer English equivalents for administrative units (Gu = District optional).
- Keep building/floor numbers as digits. Drop redundant "South Korea" suffix.
- Max 200 characters.
- If the input is already English, return it as-is (trimmed).`

export async function GET(request: Request) {
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({ text: url.searchParams.get("text") ?? "" })
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_text" }, { status: 400 })
  }

  const input = parsed.data.text

  // 한글 비율 ≤10% 면 이미 영문이라고 보고 바로 반환 (Haiku 호출 절약).
  const hangulCount = (input.match(/[가-힯]/g) ?? []).length
  if (hangulCount / input.length < 0.1) {
    return NextResponse.json(
      { english: input },
      { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000" } }
    )
  }

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: input }],
    })
    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    )
    const out = textBlock?.text?.trim().slice(0, 200) ?? ""
    if (out.length === 0) {
      // fallback — 원본 그대로
      return NextResponse.json({ english: input })
    }
    return NextResponse.json(
      { english: out },
      { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000" } }
    )
  } catch (err) {
    console.error("[curation-k/translate-address] Haiku 호출 실패:", err)
    // 외부 API 실패 → 원본 노출 (CLAUDE.md §6 #4 fallback)
    return NextResponse.json({ english: input }, { status: 200 })
  }
}
