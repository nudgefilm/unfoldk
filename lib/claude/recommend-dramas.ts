// KdramaMatch 취향 기반 추천 — Claude Haiku 4.5
//
// 입력:  사용자 genres/moods/platforms + 후보 드라마 리스트(이미 DB 에서 1차 필터링)
// 출력:  ranked drama IDs (≤10) + 각 추천 한 줄 이유
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
Pick up to 10 best matches and rank them by fit.

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
      max_tokens: 1500,
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
      if (items.length >= 10) break
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

  const items: RecommendItem[] = scored.slice(0, 10).map(({ c }) => ({
    id: c.id,
    reason: c.genre
      ? `Top-rated ${c.genre} pick that matches your taste.`
      : "Popular K-drama in your selection.",
  }))

  return { items, source: "fallback", note }
}
