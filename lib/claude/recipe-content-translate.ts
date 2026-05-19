// KfoodKit — 재료·조리법 영문 번역 (Claude Haiku 단일 tool_use)
//
// 입력: ingredients_ko: string[] (재료명) + instructions_ko: string[] (단계별 텍스트)
// 출력: { ingredients_en, instructions_en } — 입력과 동일 길이·인덱스 매핑
//
// 모델: claude-haiku-4-5-20251001
// 비용: 1 호출 ≈ output 500~800 tokens × $5/1M ≈ $0.003. 537 backfill 시 < $2.

import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

export interface RecipeContentTranslateResult {
  ingredients_en: string[]
  instructions_en: string[]
}

export class RecipeContentTranslateError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = "RecipeContentTranslateError"
  }
}

const SYSTEM_PROMPT = `You translate Korean recipe content (ingredient names and cooking steps) into clear, concise English for UnfoldK's KfoodKit (global K-food fans).

Rules:
- Output ONLY through the tool. Plain English. No Korean characters. No markdown.
- ingredients_en[i] must be the English equivalent of ingredients_ko[i]:
  · For common Korean ingredients use the widely accepted Romanized name when no equivalent exists ("gochujang", "doenjang", "kimchi").
  · For generic ingredients use English ("rice", "beef brisket", "soy sauce", "spinach").
  · Keep it short (≤40 chars). No quantity, no parenthetical notes.
- instructions_en[i] must be the English version of instructions_ko[i]:
  · One or two short sentences. Faithful to the Korean step — do not add new techniques.
  · Use imperative voice ("Soak the rice in cold water for 30 minutes.").
  · ≤240 chars per step.
- The output arrays MUST be the same length as the inputs and in the same order. If an input is empty, output an empty string at that index.`

const TOOL: Anthropic.Tool = {
  name: "report_recipe_content_translation",
  description: "Submit English translations for the recipe's ingredients and instructions.",
  input_schema: {
    type: "object",
    properties: {
      ingredients_en: {
        type: "array",
        items: { type: "string", description: "English ingredient name (≤40 chars)." },
      },
      instructions_en: {
        type: "array",
        items: { type: "string", description: "English step text (imperative, ≤240 chars)." },
      },
    },
    required: ["ingredients_en", "instructions_en"],
  },
}

export async function translateRecipeContent(args: {
  ingredients_ko: string[]
  instructions_ko: string[]
}): Promise<RecipeContentTranslateResult> {
  // 빈 입력 → 빈 결과 (Claude 호출 회피)
  if (args.ingredients_ko.length === 0 && args.instructions_ko.length === 0) {
    return { ingredients_en: [], instructions_en: [] }
  }

  const userMessage = [
    `Ingredients (${args.ingredients_ko.length}):`,
    ...args.ingredients_ko.map((s, i) => `${i + 1}. ${s}`),
    "",
    `Instructions (${args.instructions_ko.length}):`,
    ...args.instructions_ko.map((s, i) => `${i + 1}. ${s}`),
    "",
    "Produce the translation through the tool — preserve order and length.",
  ].join("\n")

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
      throw new RecipeContentTranslateError(
        `Anthropic API ${err.status}: ${err.message}`,
        err
      )
    }
    throw new RecipeContentTranslateError(
      `Anthropic 호출 실패: ${err instanceof Error ? err.message : String(err)}`,
      err
    )
  }

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL.name
  )
  if (!toolBlock) {
    throw new RecipeContentTranslateError("Haiku 응답에 tool_use 블록 없음")
  }

  const input = toolBlock.input as {
    ingredients_en?: unknown
    instructions_en?: unknown
  }
  const ingArr = input.ingredients_en
  const insArr = input.instructions_en
  if (!Array.isArray(ingArr) || !Array.isArray(insArr)) {
    throw new RecipeContentTranslateError("응답 schema 위반")
  }

  // 길이 정합 — Claude 가 짧게/길게 반환할 경우 입력 길이에 맞춤.
  // 부족하면 빈 문자열 padding / 초과하면 자름.
  const ingPadded = args.ingredients_ko.map((_, i) => {
    const v: unknown = ingArr[i]
    return typeof v === "string" ? v.trim().slice(0, 80) : ""
  })
  const insPadded = args.instructions_ko.map((_, i) => {
    const v: unknown = insArr[i]
    return typeof v === "string" ? v.trim().slice(0, 400) : ""
  })

  return {
    ingredients_en: ingPadded,
    instructions_en: insPadded,
  }
}
