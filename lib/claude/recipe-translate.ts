// KfoodKit — 레시피 영문 변환 (Claude Haiku tool_use)
//
// 입력: 한글 음식명 + SUMRY + (optional) 재료 일부 + (optional) TY_NM
// 출력: { title_en, description_en }  — 한 호출에 두 필드 동시 생성
//
// 모델: claude-haiku-4-5-20251001 (CLAUDE.md §6 — 가벼운 추출·매핑)
// 비용: 1 호출 ≈ output 150 tokens × $5/1M = $0.00075. 537 레시피 백필도 < $0.5.

import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

export interface RecipeTranslateResult {
  title_en: string
  description_en: string
}

export class RecipeTranslateError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = "RecipeTranslateError"
  }
}

const SYSTEM_PROMPT = `You translate Korean recipe metadata into English for UnfoldK's KfoodKit, a platform for global K-food fans.

Rules:
- Output ONLY through the tool. Plain English, no markdown, no Korean characters in either field.
- title_en: short English name (Romanize if no common translation; e.g., "비빔밥" → "Bibimbap"). Max 60 chars.
- description_en: ONE friendly sentence (max 160 chars) that captures what this dish is and why a fan would try it. Avoid generic "delicious Korean dish" — mention texture, flavor, or signature ingredient.`

const TRANSLATE_TOOL: Anthropic.Tool = {
  name: "report_recipe_translation",
  description: "Submit English title and one-line description for a Korean recipe.",
  input_schema: {
    type: "object",
    properties: {
      title_en: {
        type: "string",
        description: "Short English/Romanized recipe name. Max 60 chars. No quotes.",
      },
      description_en: {
        type: "string",
        description: "One-sentence English description, max 160 chars. No markdown.",
      },
    },
    required: ["title_en", "description_en"],
  },
}

export async function translateRecipe(args: {
  title_ko: string
  summary_ko?: string | null
  category_ko?: string | null      // TY_NM (예: "밥", "국&찌개")
  main_ingredients?: string[]      // 상위 3-5 재료명 (한글)
}): Promise<RecipeTranslateResult> {
  const titleKo = args.title_ko.trim().slice(0, 200)
  if (titleKo.length === 0) {
    throw new RecipeTranslateError("title_ko 빈 값")
  }

  const userParts: string[] = [`Korean name: ${titleKo}`]
  if (args.category_ko?.trim()) userParts.push(`Category: ${args.category_ko.trim()}`)
  if (args.summary_ko?.trim()) userParts.push(`Korean summary: ${args.summary_ko.trim().slice(0, 400)}`)
  if (args.main_ingredients && args.main_ingredients.length > 0) {
    userParts.push(`Main ingredients (Korean): ${args.main_ingredients.slice(0, 5).join(", ")}`)
  }
  userParts.push("\nProduce the translation through the tool.")

  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [TRANSLATE_TOOL],
      tool_choice: { type: "tool", name: TRANSLATE_TOOL.name },
      messages: [{ role: "user", content: userParts.join("\n") }],
    })
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      throw new RecipeTranslateError(`Anthropic API ${err.status}: ${err.message}`, err)
    }
    throw new RecipeTranslateError(
      `Anthropic 호출 실패: ${err instanceof Error ? err.message : String(err)}`,
      err
    )
  }

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock =>
      b.type === "tool_use" && b.name === TRANSLATE_TOOL.name
  )
  if (!toolBlock) {
    throw new RecipeTranslateError("Haiku 응답에 tool_use 블록 없음")
  }

  const input = toolBlock.input as Partial<RecipeTranslateResult>
  if (typeof input.title_en !== "string" || typeof input.description_en !== "string") {
    throw new RecipeTranslateError("응답 schema 위반")
  }

  const title_en = input.title_en.trim().slice(0, 60)
  const description_en = input.description_en.trim().slice(0, 160)
  if (title_en.length === 0) {
    throw new RecipeTranslateError("title_en 빈 값")
  }

  return { title_en, description_en }
}
