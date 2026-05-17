// HangeulGo Phase 1 — 오늘의 표현 Claude Haiku 4.5 생성
//
// 입력: 드라마 컨텍스트 (ko + en 제목) + difficulty 힌트
// 출력: 학습 카드에 그대로 채울 수 있는 구조화 JSON
//
// 비용: Haiku 4.5 ≈ $0.001/회. 결정적 회전 + DB 캐싱 → 1일 1콜.
// 저작권: 드라마 대사 원문 직접 인용 금지 — "이 드라마에서 자주 나올 법한" 학습 예시 생성.

import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic()

export interface KoreanPhrasePayload {
  korean: string                            // "보고 싶었어"
  romanization: string                      // "Bogo sipeosseo"
  english: string                           // "I missed you"
  word_breakdown: Array<{
    word: string                            // "보고"
    romanization: string                    // "bogo"
    meaning: string                         // "to see"
  }>
  synonyms: string[]                        // ["그리웠어"]
  antonyms: string[]                        // ["잊었어"]
  difficulty: "beginner" | "intermediate" | "advanced"
}

const SYSTEM_PROMPT = `You are a Korean language tutor for UnfoldK HangeulGo, a Hallyu-themed Korean learning app for global K-drama fans.

Generate ONE Korean phrase in the conversational style typical of the given K-drama. Strict rules:

- The phrase should be 2~6 words — short enough to memorize, useful in everyday Korean.
- Do NOT quote any actual line from the drama directly. Generate an inspired example phrase only.
- Prefer phrases learners can immediately use (greetings, feelings, asking, agreeing, common reactions).
- difficulty:
  - "beginner"     = basic everyday phrase, ≤3 words, no honorific complexity
  - "intermediate" = polite form 요/-습니다 or short clause connectors
  - "advanced"     = nuanced expressions, honorifics, idiomatic
- word_breakdown: split the Korean phrase into 2~4 logical units (eojeol or particle group). Each unit needs the surface form (word), its romanization, and a short English meaning.
- synonyms: 1~2 similar Korean expressions (or empty array if none natural).
- antonyms: 0~2 opposite Korean expressions (or empty array if none natural).
- romanization: Revised Romanization (RR), no hyphens, lowercase except start of sentence.
- english: natural 1-line English equivalent (no quotes around it).
- No markdown, no preamble — output STRICT JSON only matching this exact shape:

{
  "korean": "...",
  "romanization": "...",
  "english": "...",
  "word_breakdown": [{"word": "...", "romanization": "...", "meaning": "..."}],
  "synonyms": ["..."],
  "antonyms": ["..."],
  "difficulty": "beginner|intermediate|advanced"
}`

export interface GenerateKoreanPhraseInput {
  dramaKo: string       // 한국어 드라마명
  dramaEn: string       // 영문 드라마명
  difficultyHint?: "beginner" | "intermediate" | "advanced"
}

export async function generateKoreanPhrase(
  input: GenerateKoreanPhraseInput
): Promise<KoreanPhrasePayload | null> {
  const userMessage = `Drama (Korean): ${input.dramaKo}
Drama (English): ${input.dramaEn}
${input.difficultyHint ? `Suggested difficulty: ${input.difficultyHint}` : ""}

Generate one short Korean phrase inspired by the show's tone (NOT a direct quote). Output the JSON.`

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 600,
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
      console.error("[claude/korean-phrase] JSON parse 실패:", cleaned.slice(0, 200))
      return null
    }

    if (!parsed || typeof parsed !== "object") return null
    const obj = parsed as Record<string, unknown>

    // 필수 필드 검증
    const korean = typeof obj.korean === "string" ? obj.korean.trim() : ""
    const english = typeof obj.english === "string" ? obj.english.trim() : ""
    if (!korean || !english) {
      console.error("[claude/korean-phrase] korean/english 누락:", obj)
      return null
    }

    const difficulty =
      obj.difficulty === "beginner" ||
      obj.difficulty === "intermediate" ||
      obj.difficulty === "advanced"
        ? obj.difficulty
        : "beginner"

    const wb = Array.isArray(obj.word_breakdown) ? obj.word_breakdown : []
    const word_breakdown: KoreanPhrasePayload["word_breakdown"] = []
    for (const item of wb) {
      if (typeof item !== "object" || item === null) continue
      const x = item as Record<string, unknown>
      if (typeof x.word !== "string") continue
      word_breakdown.push({
        word: x.word,
        romanization: typeof x.romanization === "string" ? x.romanization : "",
        meaning: typeof x.meaning === "string" ? x.meaning : "",
      })
    }

    const toStringArr = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []

    return {
      korean,
      romanization: typeof obj.romanization === "string" ? obj.romanization : "",
      english,
      word_breakdown,
      synonyms: toStringArr(obj.synonyms),
      antonyms: toStringArr(obj.antonyms),
      difficulty,
    }
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error(`[claude/korean-phrase] API error ${err.status}:`, err.message)
    } else {
      console.error(
        "[claude/korean-phrase] 예외:",
        err instanceof Error ? err.message : String(err)
      )
    }
    return null
  }
}

// ============================================================
// Pro 전용 — AI 문법 설명
// ============================================================

const GRAMMAR_SYSTEM_PROMPT = `You are a Korean grammar tutor for UnfoldK HangeulGo. Explain the grammatical structure of a Korean phrase for English-speaking learners.

Strict rules:
- Output 2-4 short paragraphs in English (max ~500 chars total).
- Identify the main grammar pattern(s) — verb conjugation, particle, sentence ending, honorific level.
- Explain when and how the pattern is used in conversation.
- Cite the relevant word forms from the phrase itself.
- Do NOT translate the phrase word-for-word (the learner already has that). Focus on STRUCTURE.
- Plain English, no markdown headings, no emojis, no preamble, no surrounding quotes.

Output the explanation directly.`

export async function generateGrammarExplanation(
  korean: string,
  english: string,
  difficulty: string
): Promise<string | null> {
  const userMessage = `Korean phrase: ${korean}
English meaning: ${english}
Difficulty: ${difficulty}

Explain the grammar.`

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 700,
      system: [
        {
          type: "text",
          text: GRAMMAR_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    })

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    )
    if (!textBlock) return null

    const text = textBlock.text.trim()
    if (text.length === 0) return null
    if (text.length > 1500) return text.slice(0, 1500)
    return text
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error(`[claude/korean-grammar] API error ${err.status}:`, err.message)
    } else {
      console.error(
        "[claude/korean-grammar] 예외:",
        err instanceof Error ? err.message : String(err)
      )
    }
    return null
  }
}
