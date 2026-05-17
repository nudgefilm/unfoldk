// KdramaMatch Phase 2 — Pro 전용 AI 에피소드 요약 (Claude Haiku 4.5)
//
// 입력: 드라마 제목 + overview + episode_count + cast (옵션)
// 출력: 영문 에피소드 요약 — 시놉시스 기반 추론, 사실 단정 금지
//
// 비용: Haiku 4.5 ≈ $0.001/회. drama_ai_summaries 캐싱으로 1회 호출 후 재사용.
// 실패: null 반환 → API 라우트가 500 처리.

import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

export interface DramaSummaryInput {
  title: string
  overview: string | null
  numberOfEpisodes: number | null
  numberOfSeasons: number | null
  genre: string | null
  cast: Array<{ name: string; character: string }>
}

const SYSTEM_PROMPT = `You are a K-drama writer for UnfoldK, an English-language Hallyu service for global fans.

Generate an engaging episode-arc summary based ONLY on the official synopsis and cast list provided. Strict rules:

- Output 2-3 short paragraphs in English (max ~600 chars total).
- Highlight overall narrative arc + key emotional beats + character dynamics.
- Use the provided cast names + characters where they enrich the summary.
- Do NOT invent specific plot twists, episode numbers, or details not in the synopsis.
- Do NOT use spoilers like "in the finale" or "she dies in episode 12".
- Friendly, enthusiastic tone — match how fans discuss their favorites.
- Plain English only, no markdown, no emojis, no surrounding quotes, no preamble.

Output the summary text directly with no headings.`

export async function generateDramaSummary(
  input: DramaSummaryInput
): Promise<string | null> {
  if (!input.overview || input.overview.trim().length < 20) {
    // 시놉시스 부족 → 요약 품질 보장 불가, skip
    return null
  }

  const castLine =
    input.cast.length > 0
      ? input.cast
          .slice(0, 6)
          .map((c) => `${c.name} as ${c.character}`)
          .join(", ")
      : "(cast not available)"

  const userMessage = `Title: ${input.title}
Genre: ${input.genre ?? "(unknown)"}
Episodes: ${input.numberOfEpisodes ?? "?"} (${input.numberOfSeasons ?? 1} season(s))
Cast: ${castLine}

Official synopsis:
${input.overview}

Write the episode-arc summary.`

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 800,
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

    const summary = textBlock.text.trim()
    if (summary.length === 0) return null
    // 1500자 초과는 비정상 (max_tokens 800 ≈ 600-1200자 정상범위)
    if (summary.length > 1500) return summary.slice(0, 1500)
    return summary
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error(`[claude/drama-summary] API error ${err.status}:`, err.message)
    } else {
      console.error(
        "[claude/drama-summary] 예외:",
        err instanceof Error ? err.message : String(err)
      )
    }
    return null
  }
}
