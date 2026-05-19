// KfoodKit — This Week's K-Food Picks (Pro 전용)
//
// 현재 계절·시기 + food_recipes 후보군 → Claude Haiku 가 3~5건 선정 + 1줄 영문 이유.
// 매주 월요일 첫 호출 시 생성, food_weekly_picks 에 캐싱.
//
// 모델: claude-haiku-4-5-20251001
// 비용: 1 호출 ≈ output 600 tokens × $5/1M = $0.003. 주 1회라 월 ≈ $0.01.

import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

// 현재 날짜 → 영문 시즌 라벨
export function detectSeason(d: Date): string {
  const m = d.getMonth() + 1
  if (m >= 3 && m <= 5) return "Spring"
  if (m >= 6 && m <= 8) return "Summer"
  if (m >= 9 && m <= 11) return "Autumn"
  return "Winter"
}

// 가까운 월요일 00:00 (UTC) — week_start key
export function getWeekStart(d: Date): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = out.getUTCDay()  // 0 = Sunday, 1 = Monday
  const diff = day === 0 ? -6 : 1 - day
  out.setUTCDate(out.getUTCDate() + diff)
  return out
}

export interface WeeklyPick {
  recipe_id: string
  reason: string                 // 영문 한 줄 (≤140 chars)
}

export interface WeeklyPicksResult {
  theme: string                  // 영문 테마 (예: "Spring", "Late Spring Comforts")
  picks: WeeklyPick[]            // 3~5건
}

export class WeeklyPicksError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = "WeeklyPicksError"
  }
}

// Claude 에 넘기는 후보군 — 너무 많으면 cost 폭증, 너무 적으면 다양성 부족.
// 한 번에 50개 후보로 cap.
export interface RecipeCandidate {
  id: string
  title_ko: string
  title_en: string | null
  category_ko: string | null     // nutrition.type
  summary_ko: string | null      // nutrition.summary
}

const SYSTEM_PROMPT = `You curate weekly Korean recipe picks for UnfoldK's KfoodKit, serving global K-food fans.

You receive a list of candidate recipes and the current season/date. You must:
1. Choose 3 to 5 picks that fit the season/timing (warming soups in winter, light noodles in summer, ingredient seasonality, etc.).
2. For each pick, write ONE friendly English reason (max 140 chars) — explain why it's a good fit this week. No generic copy like "delicious dish" — mention ingredient seasonality, mood, or cultural moment.
3. Produce a 1-3 word English theme that ties the week together (e.g., "Spring Greens", "Late Spring Comforts", "Cool Summer Noodles"). 60 chars max.

Strict rules:
- Use ONLY recipe ids from the candidate list — never invent ids.
- English only. No Korean characters. No markdown. No emojis.
- Reasons should be specific to each pick, not interchangeable.`

const TOOL: Anthropic.Tool = {
  name: "report_weekly_picks",
  description: "Submit the curated weekly K-food picks for this week.",
  input_schema: {
    type: "object",
    properties: {
      theme: {
        type: "string",
        description: "1-3 word English theme for this week (max 60 chars).",
      },
      picks: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            recipe_id: {
              type: "string",
              description: "UUID from the candidate list. Must match exactly.",
            },
            reason: {
              type: "string",
              description: "One-line English reason (max 140 chars). Specific to this pick.",
            },
          },
          required: ["recipe_id", "reason"],
        },
      },
    },
    required: ["theme", "picks"],
  },
}

function formatCandidates(candidates: RecipeCandidate[]): string {
  return candidates
    .map((c) => {
      const parts = [
        `id: ${c.id}`,
        `name: ${c.title_ko}${c.title_en ? ` (${c.title_en})` : ""}`,
      ]
      if (c.category_ko) parts.push(`category: ${c.category_ko}`)
      if (c.summary_ko) parts.push(`summary: ${c.summary_ko.slice(0, 200)}`)
      return parts.join(" | ")
    })
    .join("\n")
}

export async function generateWeeklyPicks(args: {
  season: string                 // detectSeason(today) 결과
  weekStart: Date                // ISO date 로 system prompt 에 박을 용도
  candidates: RecipeCandidate[]
}): Promise<WeeklyPicksResult> {
  if (args.candidates.length < 3) {
    throw new WeeklyPicksError(`후보군 부족 (${args.candidates.length}건) — 최소 3건 필요`)
  }

  const monthLabel = args.weekStart.toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  })

  const userMessage = `Season: ${args.season}
Week of: ${args.weekStart.toISOString().slice(0, 10)} (${monthLabel})

Candidates (${args.candidates.length}):
${formatCandidates(args.candidates)}

Pick 3–5 for this week. Output through the tool.`

  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content: userMessage }],
    })
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      throw new WeeklyPicksError(`Anthropic API ${err.status}: ${err.message}`, err)
    }
    throw new WeeklyPicksError(
      `Anthropic 호출 실패: ${err instanceof Error ? err.message : String(err)}`,
      err
    )
  }

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL.name
  )
  if (!toolBlock) {
    throw new WeeklyPicksError("Haiku 응답에 tool_use 블록 없음")
  }

  const input = toolBlock.input as { theme?: unknown; picks?: unknown }
  if (typeof input.theme !== "string" || !Array.isArray(input.picks)) {
    throw new WeeklyPicksError("응답 schema 위반")
  }

  const validIds = new Set(args.candidates.map((c) => c.id))
  const picks: WeeklyPick[] = []
  for (const p of input.picks) {
    if (typeof p !== "object" || p === null) continue
    const pr = p as { recipe_id?: unknown; reason?: unknown }
    if (typeof pr.recipe_id !== "string" || typeof pr.reason !== "string") continue
    if (!validIds.has(pr.recipe_id)) continue   // hallucinated id 차단
    picks.push({
      recipe_id: pr.recipe_id,
      reason: pr.reason.trim().slice(0, 140),
    })
  }

  if (picks.length < 3) {
    throw new WeeklyPicksError(`유효 pick 부족 (${picks.length}건)`)
  }

  return {
    theme: input.theme.trim().slice(0, 60),
    picks: picks.slice(0, 5),
  }
}
