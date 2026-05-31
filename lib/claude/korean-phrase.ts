// HangeulGo Phase 1 — 오늘의 표현 Claude Haiku 4.5 생성
//
// 입력: 드라마 컨텍스트 (ko + en 제목) + difficulty 힌트
// 출력: 학습 카드에 그대로 채울 수 있는 구조화 JSON
//
// 모델: claude-haiku-4-5 (CLAUDE.md §6 AI 처리 원칙)
// 구조화 출력: tool_use 강제 — 자유 텍스트 / 마크다운 응답 거부 (JSON parse 실패 방지)
// 비용: Haiku 4.5 ≈ $0.001/회. 결정적 회전 + DB 캐싱 → 1일 1콜.
// 저작권: 드라마 대사 원문 직접 인용 금지 — "이 드라마에서 자주 나올 법한" 학습 예시 생성.

import Anthropic from "@anthropic-ai/sdk"

// ANTHROPIC_API_KEY 누락 시 SDK 가 런타임 throw 함. 모듈 로드 시점에 경고만 찍어 디버깅 단축.
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn(
    "[claude/korean-phrase] ANTHROPIC_API_KEY env 누락 — Claude 호출 시 실패 예정"
  )
} else {
  console.log(
    `[claude/korean-phrase] ANTHROPIC_API_KEY OK length=${process.env.ANTHROPIC_API_KEY.length}`
  )
}

const client = new Anthropic()

const MODEL = "claude-haiku-4-5"

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

// 호출부가 실패 원인을 응답에 박제할 수 있도록 detail 반환.
export type GenerateKoreanPhraseResult =
  | { ok: true; payload: KoreanPhrasePayload }
  | { ok: false; reason: string; detail?: string }

const PHRASE_SYSTEM_PROMPT = `You are a Korean language tutor for UnfoldK HangeulGo, a Hallyu-themed Korean learning app for global K-drama fans.

Generate ONE Korean phrase in the conversational style typical of the given K-drama. Strict rules:

- The phrase should be 2~6 words — short enough to memorize, useful in everyday Korean.
- Do NOT quote any actual line from the drama directly. Generate an inspired example phrase only.
- Prefer phrases learners can immediately use (greetings, feelings, asking, agreeing, common reactions).
- difficulty:
  - "beginner"     = basic everyday phrase, ≤3 words, no honorific complexity
  - "intermediate" = polite form 요/-습니다 or short clause connectors
  - "advanced"     = nuanced expressions, honorifics, idiomatic
- word_breakdown: 2~4 logical units (eojeol or particle group). Each unit needs surface form (word), romanization, and a short English meaning.
- synonyms: 1~2 similar Korean expressions (or empty array if none natural).
- antonyms: 0~2 opposite Korean expressions (or empty array if none natural).
- romanization: Revised Romanization (RR), no hyphens, lowercase except start of sentence.
- english: natural 1-line English equivalent (no surrounding quotes).

Use the report_korean_phrase tool to return the structured output.`

// tool_use 강제 — 모델이 자유 텍스트로 응답할 수 없게 막아 JSON parse 실패 차단.
const PHRASE_TOOL: Anthropic.Tool = {
  name: "report_korean_phrase",
  description: "Report one Korean learning phrase inspired by a K-drama (NOT a direct quote).",
  input_schema: {
    type: "object",
    properties: {
      korean: { type: "string" },
      romanization: { type: "string" },
      english: { type: "string" },
      word_breakdown: {
        type: "array",
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            word: { type: "string" },
            romanization: { type: "string" },
            meaning: { type: "string" },
          },
          required: ["word", "romanization", "meaning"],
        },
      },
      synonyms: {
        type: "array",
        maxItems: 2,
        items: { type: "string" },
      },
      antonyms: {
        type: "array",
        maxItems: 2,
        items: { type: "string" },
      },
      difficulty: {
        type: "string",
        enum: ["beginner", "intermediate", "advanced"],
      },
    },
    required: [
      "korean",
      "romanization",
      "english",
      "word_breakdown",
      "synonyms",
      "antonyms",
      "difficulty",
    ],
  },
}

export interface GenerateKoreanPhraseInput {
  dramaKo: string       // 한국어 드라마명
  dramaEn: string       // 영문 드라마명
  difficultyHint?: "beginner" | "intermediate" | "advanced"
}

export async function generateKoreanPhrase(
  input: GenerateKoreanPhraseInput
): Promise<GenerateKoreanPhraseResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, reason: "missing_api_key" }
  }

  const userMessage = `Drama (Korean): ${input.dramaKo}
Drama (English): ${input.dramaEn}
${input.difficultyHint ? `Suggested difficulty: ${input.difficultyHint}` : ""}

Generate one short Korean phrase inspired by the show's tone (NOT a direct quote). Use the report_korean_phrase tool.`

  console.log(
    `[claude/korean-phrase] 호출 시작 model=${MODEL} drama=${input.dramaEn} (${input.dramaKo})`
  )

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1000,
      tools: [PHRASE_TOOL],
      tool_choice: { type: "tool", name: "report_korean_phrase" },
      system: PHRASE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    })

    console.log(
      `[claude/korean-phrase] 응답 received stop_reason=${response.stop_reason} usage=${JSON.stringify(response.usage)}`
    )

    const toolBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    )
    if (!toolBlock) {
      const types = response.content.map((b) => b.type).join(",")
      const textPreview = response.content
        .find((b): b is Anthropic.TextBlock => b.type === "text")
        ?.text.slice(0, 200)
      console.error(
        `[claude/korean-phrase] tool_use block 없음 — content=[${types}] preview=${textPreview ?? "(none)"}`
      )
      return {
        ok: false,
        reason: "no_tool_use_block",
        detail: `content=[${types}] stop_reason=${response.stop_reason}`,
      }
    }

    const normalized = normalizePhrase(toolBlock.input)
    if (!normalized) {
      console.error(
        `[claude/korean-phrase] 필수 필드 누락 input=${JSON.stringify(toolBlock.input).slice(0, 300)}`
      )
      return {
        ok: false,
        reason: "invalid_payload",
        detail: `tool_input=${JSON.stringify(toolBlock.input).slice(0, 200)}`,
      }
    }

    return { ok: true, payload: normalized }
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      const apiBody = (err as unknown as { error?: { error?: { type?: string; message?: string } } })
        .error?.error
      const detail = `status=${err.status} type=${apiBody?.type ?? "?"} message=${apiBody?.message ?? err.message}`
      console.error(`[claude/korean-phrase] APIError ${detail} input=${JSON.stringify(input)}`)
      return { ok: false, reason: `api_error_${err.status}`, detail }
    }
    if (err instanceof Error) {
      console.error(
        `[claude/korean-phrase] 예외 name=${err.name} message=${err.message} stack=${err.stack?.split("\n").slice(0, 3).join(" | ")}`
      )
      return { ok: false, reason: "exception", detail: `${err.name}: ${err.message}` }
    }
    console.error("[claude/korean-phrase] 알 수 없는 예외:", String(err))
    return { ok: false, reason: "unknown_exception", detail: String(err) }
  }
}

// tool_use input 객체를 KoreanPhrasePayload 로 정규화. 필수 필드 누락 시 null.
function normalizePhrase(raw: unknown): KoreanPhrasePayload | null {
  if (typeof raw !== "object" || raw === null) return null
  const obj = raw as Record<string, unknown>

  const korean = typeof obj.korean === "string" ? obj.korean.trim() : ""
  const english = typeof obj.english === "string" ? obj.english.trim() : ""
  if (!korean || !english) return null

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
}

// ============================================================
// 배치 생성 — 중급/고급 문장 패턴 표현 (scripts/generate-drama-phrases.ts 전용)
// ============================================================

const SENTENCE_SYSTEM_PROMPT = `You are a Korean language tutor for UnfoldK HangeulGo, a Hallyu-themed Korean learning app for global K-drama fans.

Generate THREE Korean sentences inspired by the tone and themes of the given K-drama. Strict rules:

- Do NOT quote any actual line from the drama directly. Generate inspired example sentences only.
- Each sentence must be grammatically complete and naturally usable in conversation.
- difficulty "intermediate": 5–12 words, grammar patterns like -고/-아서/-(으)면/-(으)려고, polite -요/-습니다 form. Everyday situations: expressing feelings, asking questions, making plans, describing events.
- difficulty "advanced": 8–18 words, complex patterns like -(으)ㄹ 것 같다/-(으)ㄴ/는데/honorifics/-기 때문에/idiomatic expressions. Nuanced emotions, formal speech, indirect expressions.
- word_breakdown: 3–5 logical units per sentence (eojeol or particle group).
- synonyms: 1–2 alternatives (or empty).
- antonyms: 0–1 opposite (or empty).
- romanization: Revised Romanization (RR), lowercase.
- english: natural English equivalent, no surrounding quotes.

Use the report_korean_phrases tool to return all three structured phrases at once.`

const SENTENCE_TOOL: Anthropic.Tool = {
  name: "report_korean_phrases",
  description: "Report three Korean learning sentences inspired by a K-drama (NOT direct quotes).",
  input_schema: {
    type: "object",
    properties: {
      phrases: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            korean:       { type: "string" },
            romanization: { type: "string" },
            english:      { type: "string" },
            word_breakdown: {
              type: "array",
              maxItems: 5,
              items: {
                type: "object",
                properties: {
                  word:         { type: "string" },
                  romanization: { type: "string" },
                  meaning:      { type: "string" },
                },
                required: ["word", "romanization", "meaning"],
              },
            },
            synonyms: { type: "array", maxItems: 2, items: { type: "string" } },
            antonyms: { type: "array", maxItems: 1, items: { type: "string" } },
          },
          required: ["korean", "romanization", "english", "word_breakdown", "synonyms", "antonyms"],
        },
      },
    },
    required: ["phrases"],
  },
}

export interface GenerateDramaPhrasesInput {
  dramaKo: string
  dramaEn: string
  difficulty: "intermediate" | "advanced"
}

export type GenerateDramaPhrasesResult =
  | { ok: true; payloads: KoreanPhrasePayload[] }
  | { ok: false; reason: string; detail?: string }

export async function generateDramaPhrases(
  input: GenerateDramaPhrasesInput
): Promise<GenerateDramaPhrasesResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, reason: "missing_api_key" }
  }

  const userMessage = `Drama (Korean): ${input.dramaKo}
Drama (English): ${input.dramaEn}
Difficulty: ${input.difficulty}

Generate three ${input.difficulty} Korean sentences inspired by this drama's tone and themes. Use the report_korean_phrases tool.`

  console.log(
    `[claude/korean-phrase] generateDramaPhrases 호출 model=${MODEL} drama=${input.dramaEn} difficulty=${input.difficulty}`
  )

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      tools: [SENTENCE_TOOL],
      tool_choice: { type: "tool", name: "report_korean_phrases" },
      system: SENTENCE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    })

    const toolBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    )
    if (!toolBlock) {
      return { ok: false, reason: "no_tool_use_block" }
    }

    const raw = toolBlock.input as { phrases?: unknown[] }
    const phrases = Array.isArray(raw?.phrases) ? raw.phrases : []
    const payloads: KoreanPhrasePayload[] = phrases
      .map((p) => normalizePhrase(p))
      .filter((p): p is KoreanPhrasePayload => p !== null)
      .map((p) => ({ ...p, difficulty: input.difficulty }))

    if (payloads.length === 0) {
      return { ok: false, reason: "invalid_payload", detail: JSON.stringify(raw).slice(0, 200) }
    }

    return { ok: true, payloads }
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      const detail = `status=${err.status} message=${err.message}`
      console.error(`[claude/korean-phrase] generateDramaPhrases APIError ${detail}`)
      return { ok: false, reason: `api_error_${err.status}`, detail }
    }
    if (err instanceof Error) {
      return { ok: false, reason: "exception", detail: `${err.name}: ${err.message}` }
    }
    return { ok: false, reason: "unknown_exception", detail: String(err) }
  }
}

// ============================================================
// Pro 전용 — AI 문법 설명
// ============================================================

export type GenerateGrammarResult =
  | { ok: true; text: string }
  | { ok: false; reason: string; detail?: string }

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
): Promise<GenerateGrammarResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, reason: "missing_api_key" }
  }

  const userMessage = `Korean phrase: ${korean}
English meaning: ${english}
Difficulty: ${difficulty}

Explain the grammar.`

  console.log(
    `[claude/korean-grammar] 호출 시작 model=${MODEL} korean=${korean} difficulty=${difficulty}`
  )

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      system: GRAMMAR_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    })

    console.log(
      `[claude/korean-grammar] 응답 received stop_reason=${response.stop_reason} usage=${JSON.stringify(response.usage)}`
    )

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    )
    if (!textBlock) {
      const types = response.content.map((b) => b.type).join(",")
      console.error(`[claude/korean-grammar] text block 없음 — content=[${types}]`)
      return {
        ok: false,
        reason: "no_text_block",
        detail: `content=[${types}] stop_reason=${response.stop_reason}`,
      }
    }

    const text = textBlock.text.trim()
    if (text.length === 0) {
      console.error("[claude/korean-grammar] 빈 응답")
      return { ok: false, reason: "empty_text" }
    }

    return { ok: true, text: text.length > 1500 ? text.slice(0, 1500) : text }
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      const apiBody = (err as unknown as { error?: { error?: { type?: string; message?: string } } })
        .error?.error
      const detail = `status=${err.status} type=${apiBody?.type ?? "?"} message=${apiBody?.message ?? err.message}`
      console.error(`[claude/korean-grammar] APIError ${detail}`)
      return { ok: false, reason: `api_error_${err.status}`, detail }
    }
    if (err instanceof Error) {
      console.error(
        `[claude/korean-grammar] 예외 name=${err.name} message=${err.message}`
      )
      return { ok: false, reason: "exception", detail: `${err.name}: ${err.message}` }
    }
    console.error("[claude/korean-grammar] 알 수 없는 예외:", String(err))
    return { ok: false, reason: "unknown_exception", detail: String(err) }
  }
}
