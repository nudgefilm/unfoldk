// KpopStats Artist Comparison — Claude Haiku 인사이트 생성
// 팬덤 충성도·성장 모멘텀·글로벌 분포를 종합해 2~3문장 인사이트 생성.
// CLAUDE.md: Haiku 4.5, 프롬프트 캐싱, 응답 DB 캐싱 (24h).

import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()
const MODEL = "claude-haiku-4-5-20251001"

export interface ComparisonInsightInput {
  artistA: { name: string; listeners: number | null; plays: number | null; growth30d: number | null }
  artistB: { name: string; listeners: number | null; plays: number | null; growth30d: number | null }
  topCountriesA: string[]   // 상위 3개국 이름
  topCountriesB: string[]
}

export async function generateComparisonInsight(
  data: ComparisonInsightInput
): Promise<string> {
  const loyaltyA =
    data.artistA.listeners && data.artistA.plays
      ? (data.artistA.plays / data.artistA.listeners).toFixed(1)
      : null
  const loyaltyB =
    data.artistB.listeners && data.artistB.plays
      ? (data.artistB.plays / data.artistB.listeners).toFixed(1)
      : null

  const lines = [
    `Artist A: ${data.artistA.name}`,
    `  Monthly listeners: ${data.artistA.listeners?.toLocaleString() ?? "N/A"}`,
    loyaltyA ? `  Plays per listener: ${loyaltyA}` : null,
    data.artistA.growth30d != null ? `  30-day listener growth: ${data.artistA.growth30d > 0 ? "+" : ""}${data.artistA.growth30d.toFixed(1)}%` : null,
    data.topCountriesA.length ? `  Top countries: ${data.topCountriesA.join(", ")}` : null,
    "",
    `Artist B: ${data.artistB.name}`,
    `  Monthly listeners: ${data.artistB.listeners?.toLocaleString() ?? "N/A"}`,
    loyaltyB ? `  Plays per listener: ${loyaltyB}` : null,
    data.artistB.growth30d != null ? `  30-day listener growth: ${data.artistB.growth30d > 0 ? "+" : ""}${data.artistB.growth30d.toFixed(1)}%` : null,
    data.topCountriesB.length ? `  Top countries: ${data.topCountriesB.join(", ")}` : null,
  ].filter((l): l is string => l !== null).join("\n")

  const { content } = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: [
      {
        type: "text",
        text: `You write concise, data-driven K-pop artist comparison insights for UnfoldK.
Rules:
- 2 to 3 sentences, English
- Compare fan loyalty (plays per listener), growth momentum (listener % change), and geographic reach
- Neutral, factual tone — no hype
- Do NOT mention "AI", "Claude", or any tool names
- Output ONLY the insight text, nothing else`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Compare these two K-pop artists based on the data below:\n\n${lines}\n\nWrite a 2-3 sentence comparison insight.`,
      },
    ],
  })

  return content.find((b) => b.type === "text")?.text?.trim() ?? ""
}
