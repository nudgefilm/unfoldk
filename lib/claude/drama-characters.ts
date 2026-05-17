// KdramaMatch Phase 2 — Pro 전용 AI 캐릭터 관계도 (Claude Haiku 4.5)
//
// 입력: 드라마 제목 + cast_members + overview
// 출력: 영문 텍스트 관계도 — 주요 인물 + 인물 간 관계 설명
//
// 비용: Haiku 4.5 ≈ $0.001/회. drama_ai_characters 캐싱.
// 실패: null 반환.

import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

export interface DramaCharactersInput {
  title: string
  overview: string | null
  cast: Array<{ name: string; character: string }>
}

const SYSTEM_PROMPT = `You are a K-drama analyst for UnfoldK, an English-language Hallyu service.

Generate a TEXT-based character relationship map based ONLY on the cast list and synopsis. Strict rules:

- Format the output as a list of 4-6 main characters, each with:
  - Character name + actor name
  - One-line role description
  - One-line relationship to other characters in the list
- Use this exact format (one character per block, blank line between):
  CHARACTER (Actor): role description.
  → relationship line.
- Do NOT invent relationships not implied by the synopsis.
- Do NOT use spoilers.
- Plain English only, no markdown headings, no emojis, no surrounding quotes, no preamble.

Output the character blocks directly with no introduction.`

export async function generateDramaCharacters(
  input: DramaCharactersInput
): Promise<string | null> {
  if (input.cast.length === 0) {
    return null
  }

  const castLine = input.cast
    .slice(0, 8)
    .map((c) => `${c.character} (played by ${c.name})`)
    .join("\n- ")

  const userMessage = `Title: ${input.title}

Synopsis:
${input.overview ?? "(synopsis unavailable)"}

Main cast (top-billed):
- ${castLine}

Write the character relationship map.`

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1000,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    })

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    )
    if (!textBlock) return null

    const content = textBlock.text.trim()
    if (content.length === 0) return null
    if (content.length > 2000) return content.slice(0, 2000)
    return content
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error(`[claude/drama-characters] API error ${err.status}:`, err.message)
    } else {
      console.error(
        "[claude/drama-characters] 예외:",
        err instanceof Error ? err.message : String(err)
      )
    }
    return null
  }
}
