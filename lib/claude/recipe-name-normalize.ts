// KfoodKit — MAFRA 음식명 정규화 (Claude Haiku 배치)
//
// MFDS COOKRCP01 ↔ MAFRA 매칭 1차 fail 한 row 들에 대해 Claude 가 표준 한글명으로
// 정규화. 오타·띄어쓰기·축약형 통일이 목표.
//   예: "김치찌게" → "김치찌개" / "돼지갈비 찜" → "돼지갈비찜"
//
// 배치 전략: 한 번의 Claude 호출에 30~50건 묶어 처리. 입력·출력 모두 배열.
// 입력 순서 = 출력 순서 (입력 index 로 매핑).
//
// 모델: claude-haiku-4-5-20251001
// 비용: 1 호출 ≈ output 800 tokens × $5/1M = $0.004. 500건이면 ~10 호출 = $0.05.

import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

export interface NormalizedName {
  original: string         // 입력 원본
  canonical: string        // 정규화 결과 (변경 없으면 original 동일)
}

export class RecipeNameNormalizeError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = "RecipeNameNormalizeError"
  }
}

const SYSTEM_PROMPT = `You normalize Korean food/recipe names to their canonical form, for matching against another Korean recipe database (식약처 COOKRCP01).

You receive an array of Korean recipe names. For each name, output the canonical/standard form. Rules:
- Fix common misspellings (e.g., "김치찌게" → "김치찌개", "된장찌게" → "된장찌개", "햄버그" → "햄버거", "도너츠" → "도넛").
- Remove redundant spacing inside compound nouns (e.g., "돼지갈비 찜" → "돼지갈비찜").
- Expand or contract to the standard form found in Korean dictionaries / food databases.
- If the name is already canonical, return it unchanged.
- Preserve the meaning — do not change to a different dish.
- Output Korean only. No English. No punctuation cleanup beyond spacing.

Output through the tool. The output array MUST be the same length as the input array, in the same order.`

const TOOL: Anthropic.Tool = {
  name: "report_normalized_names",
  description: "Submit canonical Korean forms for the input recipe names.",
  input_schema: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            original: { type: "string", description: "Input name verbatim." },
            canonical: { type: "string", description: "Canonical Korean form." },
          },
          required: ["original", "canonical"],
        },
      },
    },
    required: ["results"],
  },
}

const MAX_BATCH_SIZE = 40

// 단일 배치 처리 — Claude 1 호출. 입력 순서 보존 기대하지만 안 맞으면 original 매칭으로 복구.
async function normalizeBatch(names: string[]): Promise<NormalizedName[]> {
  if (names.length === 0) return []

  const userMessage = `Input names (${names.length}):\n${names
    .map((n, i) => `${i + 1}. ${n}`)
    .join("\n")}\n\nProduce canonical forms through the tool.`

  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content: userMessage }],
    })
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      throw new RecipeNameNormalizeError(`Anthropic API ${err.status}: ${err.message}`, err)
    }
    throw new RecipeNameNormalizeError(
      `Anthropic 호출 실패: ${err instanceof Error ? err.message : String(err)}`,
      err
    )
  }

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL.name
  )
  if (!toolBlock) {
    throw new RecipeNameNormalizeError("Haiku 응답에 tool_use 블록 없음")
  }

  const input = toolBlock.input as { results?: unknown }
  if (!Array.isArray(input.results)) {
    throw new RecipeNameNormalizeError("응답 schema 위반")
  }

  // 결과 → Map<original, canonical> 로 변환. Claude 가 순서를 뒤섞거나 일부 누락해도 복구.
  const byOriginal = new Map<string, string>()
  for (const r of input.results) {
    if (typeof r !== "object" || r === null) continue
    const o = r as { original?: unknown; canonical?: unknown }
    if (typeof o.original !== "string" || typeof o.canonical !== "string") continue
    const orig = o.original.trim()
    const canon = o.canonical.trim()
    if (orig.length > 0 && canon.length > 0) byOriginal.set(orig, canon)
  }

  // 입력 순서대로 매핑. 누락 → 원본 그대로 (안전 fallback).
  return names.map((n) => ({
    original: n,
    canonical: byOriginal.get(n) ?? n,
  }))
}

// 배치 분할 후 순차 처리. parallel 처리는 rate-limit 보수적으로 회피.
export async function normalizeRecipeNames(
  names: string[]
): Promise<NormalizedName[]> {
  const out: NormalizedName[] = []
  for (let i = 0; i < names.length; i += MAX_BATCH_SIZE) {
    const batch = names.slice(i, i + MAX_BATCH_SIZE)
    try {
      const result = await normalizeBatch(batch)
      out.push(...result)
    } catch (err) {
      console.warn(
        `[recipe-name-normalize] 배치 ${i}-${i + batch.length} 실패 — 원본 fallback:`,
        err instanceof Error ? err.message : String(err)
      )
      // 실패 배치는 원본 그대로 — 매칭 안 되면 다음 단계 (Unsplash) 로 넘어감.
      out.push(...batch.map((n) => ({ original: n, canonical: n })))
    }
  }
  return out
}
