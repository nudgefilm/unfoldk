// KdramaMatch 취향 기반 추천 — Claude Haiku 4.5
//
// 입력:  사용자 genres/moods/platforms + 후보 드라마 리스트(이미 DB 에서 1차 필터링)
// 출력:  ranked drama IDs (≤30) + 각 추천 한 줄 이유 — plan 별 슬라이스는 호출자(API)에서
//
// 설계:
//   - 모델: claude-haiku-4-5 (input $1/M, output $5/M)
//   - 출력: JSON 배열 — { id, reason } — strict parse
//   - 후보가 비어있으면 호출 skip → 빈 결과 반환
//   - 실패 시 fallback: rating·genre 매칭 단순 정렬 (Claude 없이도 동작)

import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

export interface RecommendCandidate {
  id: string
  title: string
  title_ko: string | null
  genre: string | null
  year: number | null
  platform: string | null
  rating: number | null
  overview: string | null
}

export interface RecommendInput {
  genres: string[]
  moods: string[]
  platforms: string[]
  candidates: RecommendCandidate[]
}

export interface RecommendItem {
  id: string
  reason: string
}

export interface RecommendResult {
  items: RecommendItem[]
  source: "claude" | "fallback"
  note?: string
}

const SYSTEM_PROMPT = `You are a K-drama recommender for UnfoldK, an English-language Hallyu service.

You receive a user's taste profile (genres, moods, platforms) and a candidate drama list.
Pick up to 30 best matches and rank them by fit. Quality over quantity — if fewer
than 30 strong matches exist, return only the strong ones.

Output STRICT JSON only — an array of objects with this exact shape:
[{"id": "<candidate id>", "reason": "<one-sentence English reason, max 80 chars>"}, ...]

Rules:
- Only use IDs from the provided candidate list — never invent IDs.
- Reason must be one short sentence highlighting why this drama matches the user's taste.
- No markdown, no preamble, no surrounding text — only the JSON array.
- If no candidates match well, return an empty array [].`

export async function recommendDramas(input: RecommendInput): Promise<RecommendResult> {
  if (input.candidates.length === 0) {
    return { items: [], source: "fallback", note: "no candidates" }
  }

  // 후보 리스트 압축 — 토큰 절약 (id, title, genre, year, rating, overview 첫 200자)
  const candidatesPayload = input.candidates.slice(0, 60).map((c) => ({
    id: c.id,
    title: c.title,
    genre: c.genre ?? "",
    year: c.year ?? "",
    rating: c.rating ?? "",
    platform: c.platform ?? "",
    overview: (c.overview ?? "").slice(0, 200),
  }))

  const userMessage = `Taste:
- Genres: ${input.genres.join(", ") || "(none)"}
- Moods: ${input.moods.join(", ") || "(none)"}
- Platforms: ${input.platforms.join(", ") || "(none)"}

Candidates:
${JSON.stringify(candidatesPayload)}

Return up to 10 ranked recommendations as a JSON array.`

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 3000, // 30 항목 × {id+reason} ≈ 1.8K 토큰, 여유 두고 3K
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
    if (!textBlock) {
      return fallbackRank(input, "no text block from claude")
    }

    const raw = textBlock.text.trim()
    // 모델이 가끔 ```json ... ``` 으로 감싸는 경우 방어
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return fallbackRank(input, "claude output not valid json")
    }

    if (!Array.isArray(parsed)) {
      return fallbackRank(input, "claude output not array")
    }

    const validIds = new Set(input.candidates.map((c) => c.id))
    const items: RecommendItem[] = []
    for (const entry of parsed) {
      if (typeof entry !== "object" || entry === null) continue
      const obj = entry as Record<string, unknown>
      if (typeof obj.id !== "string" || !validIds.has(obj.id)) continue
      const reason = typeof obj.reason === "string" ? obj.reason.slice(0, 200) : ""
      items.push({ id: obj.id, reason })
      if (items.length >= 30) break
    }

    if (items.length === 0) {
      return fallbackRank(input, "claude returned 0 valid items")
    }

    return { items, source: "claude" }
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error(`[claude/recommend-dramas] API error ${err.status}:`, err.message)
    } else {
      console.error(
        "[claude/recommend-dramas] 예외:",
        err instanceof Error ? err.message : String(err)
      )
    }
    return fallbackRank(input, "claude error")
  }
}

// ─── 개인화 추천 (Pro) ───────────────────────────────────────

export interface WatchlistEntry {
  dramaTitle: string
  status: "watching" | "want_to_watch" | "completed"
}

export interface RatingEntry {
  dramaTitle: string
  rating: number // 0–5
}

export interface PersonalizedRecommendInput {
  genres: string[]
  moods: string[]
  platforms: string[]
  candidates: RecommendCandidate[]
  watchlist: WatchlistEntry[]
  ratings: RatingEntry[]
}

export interface PersonalizedRecommendItem {
  id: string
  reason: string
  personalizedReason: string
}

export interface PersonalizedRecommendResult {
  items: PersonalizedRecommendItem[]
  source: "claude" | "fallback"
  note?: string
}

// 시청 이력 + 평점 → Claude 프롬프트 삽입용 컨텍스트 문자열.
// 최대 15개 완료작 / 5개 시청 중 / 상위 10개 평점만 포함 (토큰 절약).
export function buildPersonalizedPrompt(
  watchlist: WatchlistEntry[],
  ratings: RatingEntry[]
): string {
  const completed = watchlist.filter((w) => w.status === "completed")
  const watching = watchlist.filter((w) => w.status === "watching")
  const topRated = ratings
    .filter((r) => r.rating >= 4)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 10)

  const lines: string[] = []
  if (completed.length > 0)
    lines.push(`Completed: ${completed.slice(0, 15).map((w) => w.dramaTitle).join(", ")}`)
  if (watching.length > 0)
    lines.push(`Watching now: ${watching.slice(0, 5).map((w) => w.dramaTitle).join(", ")}`)
  if (topRated.length > 0)
    lines.push(
      `Highly rated (4+/5): ${topRated.map((r) => `${r.dramaTitle} (${r.rating}/5)`).join(", ")}`
    )

  return lines.length > 0 ? lines.join("\n") : "(No watch history yet)"
}

const PERSONALIZED_SYSTEM_PROMPT = `You are a K-drama recommender for UnfoldK, an English-language Hallyu service.

You receive a user's taste profile — completed dramas, ratings, genre/mood preferences — plus a candidate list.
Pick up to 30 best matches, ranked by personal fit.

Output STRICT JSON only — an array of objects:
[{"id":"<id>","reason":"<1-sentence, max 80 chars>","personalizedReason":"<2-sentence explanation referencing their watch history or ratings, max 200 chars>"}, ...]

Rules:
- Only use IDs from the provided candidate list — never invent IDs.
- reason: concise generic match reason (≤80 chars).
- personalizedReason: reference patterns from their completed/rated dramas (≤200 chars).
- No markdown, no preamble — only the JSON array.
- If no strong matches, return [].`

export async function recommendDramasPersonalized(
  input: PersonalizedRecommendInput
): Promise<PersonalizedRecommendResult> {
  if (input.candidates.length === 0) {
    return { items: [], source: "fallback", note: "no candidates" }
  }

  const historyContext = buildPersonalizedPrompt(input.watchlist, input.ratings)

  const candidatesPayload = input.candidates.slice(0, 60).map((c) => ({
    id: c.id,
    title: c.title,
    genre: c.genre ?? "",
    year: c.year ?? "",
    rating: c.rating ?? "",
    platform: c.platform ?? "",
    overview: (c.overview ?? "").slice(0, 200),
  }))

  const userMessage = `Watch History:
${historyContext}

Genre preferences: ${input.genres.join(", ") || "(none)"}
Mood preferences: ${input.moods.join(", ") || "(none)"}

Candidates:
${JSON.stringify(candidatesPayload)}

Return up to 30 ranked personalized recommendations as a JSON array.`

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000, // 30 항목 × {id+reason+personalizedReason} ≈ 3.5K 토큰
      system: [
        {
          type: "text",
          text: PERSONALIZED_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    })

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    )
    if (!textBlock) {
      return personalizedFallback(input, "no text block from claude")
    }

    const raw = textBlock.text.trim()
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return personalizedFallback(input, "claude output not valid json")
    }

    if (!Array.isArray(parsed)) {
      return personalizedFallback(input, "claude output not array")
    }

    const validIds = new Set(input.candidates.map((c) => c.id))
    const items: PersonalizedRecommendItem[] = []
    for (const entry of parsed) {
      if (typeof entry !== "object" || entry === null) continue
      const obj = entry as Record<string, unknown>
      if (typeof obj.id !== "string" || !validIds.has(obj.id)) continue
      const reason = typeof obj.reason === "string" ? obj.reason.slice(0, 200) : ""
      const personalizedReason =
        typeof obj.personalizedReason === "string"
          ? obj.personalizedReason.slice(0, 300)
          : ""
      items.push({ id: obj.id, reason, personalizedReason })
      if (items.length >= 30) break
    }

    if (items.length === 0) {
      return personalizedFallback(input, "claude returned 0 valid items")
    }

    return { items, source: "claude" }
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error(
        `[claude/recommend-dramas personalized] API error ${err.status}:`,
        err.message
      )
    } else {
      console.error(
        "[claude/recommend-dramas personalized] 예외:",
        err instanceof Error ? err.message : String(err)
      )
    }
    return personalizedFallback(input, "claude error")
  }
}

function personalizedFallback(
  input: PersonalizedRecommendInput,
  note: string
): PersonalizedRecommendResult {
  const base = fallbackRank(input, note)
  return {
    ...base,
    items: base.items.map((item) => ({ ...item, personalizedReason: "" })),
  }
}

// fallback: Claude 미작동 시 단순 매칭 — genre 일치 + rating 내림차순
function fallbackRank(input: RecommendInput, note: string): RecommendResult {
  const wantedGenres = new Set(input.genres.map((g) => g.toLowerCase()))
  const wantedPlatforms = new Set(input.platforms.map((p) => p.toLowerCase()))

  const scored = input.candidates.map((c) => {
    let score = 0
    if (c.genre && wantedGenres.has(c.genre.toLowerCase())) score += 3
    if (c.platform && wantedPlatforms.has(c.platform.toLowerCase())) score += 2
    if (c.rating != null) score += c.rating // 0~5
    return { c, score }
  })

  scored.sort((a, b) => b.score - a.score)

  const items: RecommendItem[] = scored.slice(0, 30).map(({ c }) => ({
    id: c.id,
    reason: c.genre
      ? `Top-rated ${c.genre} pick that matches your taste.`
      : "Popular K-drama in your selection.",
  }))

  return { items, source: "fallback", note }
}
