// KpopStats 스토리텔링 강화 — Claude Haiku 생성 함수 3종
// 1. generateArtistInsight  — 아티스트 이번 주 동향 한 줄 (50자 이내)
// 2. generateWeeklyKpopReport — 주간 K팝 트렌드 요약 (3~5문장)
// 3. generateArtistGuide      — 입문자 가이드 (추천 곡 5개 + 소개)
//
// CLAUDE.md AI 처리 원칙: Haiku 4.5, 프롬프트 캐싱, 응답 DB 캐싱.
// 사용자 노출 텍스트에 "AI"·"Claude" 표기 금지 — 생성 결과에 포함 시 호출자가 필터.

import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()
const MODEL = "claude-haiku-4-5-20251001"

// ─── 1. 아티스트 이번 주 동향 한 줄 인사이트 ─────────────────

export async function generateArtistInsight(
  artistName: string,
  listenersNow: number,
  listenersPrev: number | null
): Promise<string> {
  const growthPct =
    listenersPrev && listenersPrev > 0
      ? Math.round(((listenersNow - listenersPrev) / listenersPrev) * 100)
      : null

  const { content } = await client.messages.create({
    model: MODEL,
    max_tokens: 120,
    system: [
      {
        type: "text",
        text: `You write ultra-brief K-pop trend insights for UnfoldK.
Rules:
- Max 55 characters (strict)
- Present tense, no artist name in the text
- Focus on likely reason: comeback, viral, collab, award, drama OST
- No hedging words ("seems", "might", "could")
- Output ONLY the insight, nothing else`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Artist: ${artistName}
Monthly listeners: ${listenersNow.toLocaleString()}${
          growthPct !== null ? ` (${growthPct > 0 ? "+" : ""}${growthPct}% vs last week)` : ""
        }

Write a max-55-char insight about why they're trending this week.`,
      },
    ],
  })

  const raw = content.find((b) => b.type === "text")?.text?.trim() ?? ""
  return raw.slice(0, 80) // safety trim
}

// ─── 2. 주간 K팝 트렌드 요약 (3~5문장) ──────────────────────

export async function generateWeeklyKpopReport(
  topArtists: Array<{
    name: string
    listeners: number
    weeklyGrowth: number | null
  }>
): Promise<string> {
  const artistList = topArtists
    .slice(0, 10)
    .map((a, i) => {
      const g =
        a.weeklyGrowth != null && a.weeklyGrowth !== 0
          ? ` (${a.weeklyGrowth > 0 ? "+" : ""}${a.weeklyGrowth.toLocaleString()} listeners)`
          : ""
      return `${i + 1}. ${a.name}: ${a.listeners.toLocaleString()} monthly listeners${g}`
    })
    .join("\n")

  const { content } = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: [
      {
        type: "text",
        text: `You write a concise weekly K-pop trend report for UnfoldK's global fan community.
Rules:
- 3 to 5 sentences, English
- Based strictly on the chart data provided — no invented facts
- Mention rising artists and notable listener shifts
- Neutral, informative tone (not hype, not fan-speak)
- Output ONLY the report text — no title, no headers`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `This week's K-pop chart (Last.fm monthly listeners):\n${artistList}\n\nWrite the weekly trend report.`,
      },
    ],
  })

  return content.find((b) => b.type === "text")?.text?.trim() ?? ""
}

// ─── 3. 아티스트 입문 가이드 ─────────────────────────────────

export interface ArtistGuide {
  intro: string
  songs: Array<{ title: string; description: string }>
}

const GUIDE_TOOL: Anthropic.Tool = {
  name: "publish_artist_guide",
  description: "Publish a structured fan entry guide for a K-pop artist",
  input_schema: {
    type: "object" as const,
    properties: {
      intro: {
        type: "string",
        description: "2-3 sentences about the artist's appeal for new fans",
      },
      song_1_title: { type: "string" },
      song_1_desc: { type: "string", description: "One sentence, max 80 chars" },
      song_2_title: { type: "string" },
      song_2_desc: { type: "string" },
      song_3_title: { type: "string" },
      song_3_desc: { type: "string" },
      song_4_title: { type: "string" },
      song_4_desc: { type: "string" },
      song_5_title: { type: "string" },
      song_5_desc: { type: "string" },
    },
    required: [
      "intro",
      "song_1_title", "song_1_desc",
      "song_2_title", "song_2_desc",
      "song_3_title", "song_3_desc",
      "song_4_title", "song_4_desc",
      "song_5_title", "song_5_desc",
    ],
  },
}

export async function generateArtistGuide(artistName: string): Promise<ArtistGuide> {
  const { content } = await client.messages.create({
    model: MODEL,
    max_tokens: 900,
    tools: [GUIDE_TOOL],
    tool_choice: { type: "tool", name: GUIDE_TOOL.name },
    system: [
      {
        type: "text",
        text: `You create fan entry guides for K-pop artists for the UnfoldK platform.
Rules:
- Songs must be real, officially released tracks by the artist
- Pick songs that represent different sides of the artist
- Intro: welcoming tone for someone completely new to K-pop
- Song descriptions: explain why it's a good starting point (not just "it's good")
- All text in English`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Create a new fan entry guide for: ${artistName}`,
      },
    ],
  })

  const toolBlock = content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
  if (!toolBlock) throw new Error("generateArtistGuide: no tool_use block")

  const inp = toolBlock.input as Record<string, string>
  return {
    intro: inp.intro ?? "",
    songs: [1, 2, 3, 4, 5].map((n) => ({
      title: inp[`song_${n}_title`] ?? "",
      description: inp[`song_${n}_desc`] ?? "",
    })),
  }
}
