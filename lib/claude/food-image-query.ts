// KfoodKit — Unsplash 친화적 영문 검색어 생성 (Claude Haiku 배치)
//
// 한글 음식명 → Unsplash 검색에 적합한 5-10 단어 영문 쿼리.
//   예: "냉이된장찌개" → "Korean doenjang jjigae spring greens soup"
//        "잡채" → "Korean japchae sweet potato noodles"
//
// 검색어가 너무 generic ("Korean food") 이면 Unsplash 가 음식과 무관한 풍경 등 반환.
// 너무 specific ("냉이된장찌개 with 봄나물") 이면 0건. 5-10 단어 + 핵심 재료 + romanization
// 조합이 sweet spot.
//
// 배치 입력 / 출력. 입력 순서 보존 기대.
// 모델: claude-haiku-4-5-20251001
// 비용: 출력 800 tokens × $5/1M = $0.004 / 배치. 300건이면 ~8 호출 = $0.03.

import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

export interface FoodImageQuery {
  original: string         // 한글 입력 (예: "잡채")
  query: string            // 영문 검색어 (예: "Korean japchae sweet potato noodles")
}

export class FoodImageQueryError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = "FoodImageQueryError"
  }
}

const SYSTEM_PROMPT = `You generate Unsplash search queries for Korean recipe images. Goal: find a real photo of the actual dish, not generic Korean scenery.

Rules for each query:
- 5–10 words, English only. No punctuation, no quotes.
- ALWAYS include the Romanized Korean name of the dish (e.g., "bibimbap", "doenjang jjigae", "japchae").
- ALWAYS include "Korean" somewhere as a category anchor.
- Include 1–2 key ingredients or visual descriptors when distinctive (e.g., "noodles", "soup", "rice bowl", "stew", "pancake", "tteok rice cake").
- Avoid hyper-specific modifiers that would zero out results (no people's names, no exact restaurants).
- Skip filler words ("recipe", "homemade", "delicious").

Examples:
- "비빔밥" → "Korean bibimbap rice bowl with vegetables"
- "냉이된장찌개" → "Korean doenjang jjigae spring greens soup"
- "잡채" → "Korean japchae sweet potato noodles"
- "떡볶이" → "Korean tteokbokki spicy rice cakes"

Output through the tool. The output array MUST be the same length as the input array, in the same order.`

const TOOL: Anthropic.Tool = {
  name: "report_image_queries",
  description: "Submit Unsplash search queries for each Korean recipe name.",
  input_schema: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            original: { type: "string", description: "Korean input name verbatim." },
            query: {
              type: "string",
              description: "Unsplash search query, 5-10 English words. No punctuation.",
            },
          },
          required: ["original", "query"],
        },
      },
    },
    required: ["results"],
  },
}

const MAX_BATCH_SIZE = 40

async function generateBatch(names: string[]): Promise<FoodImageQuery[]> {
  if (names.length === 0) return []

  const userMessage = `Korean recipe names (${names.length}):\n${names
    .map((n, i) => `${i + 1}. ${n}`)
    .join("\n")}\n\nProduce Unsplash search queries through the tool.`

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
      throw new FoodImageQueryError(`Anthropic API ${err.status}: ${err.message}`, err)
    }
    throw new FoodImageQueryError(
      `Anthropic 호출 실패: ${err instanceof Error ? err.message : String(err)}`,
      err
    )
  }

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL.name
  )
  if (!toolBlock) {
    throw new FoodImageQueryError("Haiku 응답에 tool_use 블록 없음")
  }

  const input = toolBlock.input as { results?: unknown }
  if (!Array.isArray(input.results)) {
    throw new FoodImageQueryError("응답 schema 위반")
  }

  const byOriginal = new Map<string, string>()
  for (const r of input.results) {
    if (typeof r !== "object" || r === null) continue
    const o = r as { original?: unknown; query?: unknown }
    if (typeof o.original !== "string" || typeof o.query !== "string") continue
    const orig = o.original.trim()
    const q = o.query.trim()
    if (orig.length > 0 && q.length > 0) byOriginal.set(orig, q)
  }

  // 누락 → 안전한 fallback ("Korean <원문> dish" — 동작은 떨어지지만 Unsplash 가 일부 결과 줌)
  return names.map((n) => ({
    original: n,
    query: byOriginal.get(n) ?? `Korean ${n} dish`,
  }))
}

export async function generateFoodImageQueries(
  names: string[]
): Promise<FoodImageQuery[]> {
  const out: FoodImageQuery[] = []
  for (let i = 0; i < names.length; i += MAX_BATCH_SIZE) {
    const batch = names.slice(i, i + MAX_BATCH_SIZE)
    try {
      const result = await generateBatch(batch)
      out.push(...result)
    } catch (err) {
      console.warn(
        `[food-image-query] 배치 ${i}-${i + batch.length} 실패:`,
        err instanceof Error ? err.message : String(err)
      )
      out.push(...batch.map((n) => ({ original: n, query: `Korean ${n} dish` })))
    }
  }
  return out
}
