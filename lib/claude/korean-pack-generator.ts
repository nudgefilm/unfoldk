// HangeulGo Drama Learning Pack — Claude Haiku 4.5 로 드라마별 학습 표현 5개 일괄 생성.
//
// 입력: 드라마 메타 (한글 제목 + 영문 제목)
// 출력: KoreanPhrasePayload[] (5건)
//
// 모델: claude-haiku-4-5 (CLAUDE.md §6 AI 처리 원칙)
// 비용: 드라마 1편 ≈ output 1800 토큰 × $5/1M = $0.009. 일 cap 으로 통제.
//
// 안전장치:
//   - 드라마 1편당 최대 MAX_PHRASES_PER_DRAMA (=5) 보장 (모델 폭주 차단)
//   - tool_use 구조화 출력 강제 — 자유 텍스트 응답 거부 (할루시네이션 / JSON 파싱 실패 차단)
//   - 모르는 드라마 → 빈 배열 반환 (filming-spots 와 동일 정책)
//   - 드라마 대사 원문 직접 인용 금지 — "이 드라마에서 자주 나올 법한" 학습 예시 생성

import Anthropic from "@anthropic-ai/sdk"
import type { KoreanPhrasePayload } from "@/lib/claude/korean-phrase"

const client = new Anthropic()

export const MAX_PHRASES_PER_DRAMA = 5

const SYSTEM_PROMPT = `You are a Korean language tutor for UnfoldK HangeulGo, a Hallyu-themed Korean learning app for global K-drama fans.

Given a K-drama, generate exactly ${MAX_PHRASES_PER_DRAMA} short Korean learning phrases inspired by the drama's tone and recurring conversational themes. Strict rules:

- Generate INSPIRED example phrases — DO NOT quote any actual line from the drama directly.
- Each phrase: 2~6 words, useful in everyday Korean (greetings, feelings, asking, agreeing, common reactions).
- Cover a MIX of difficulty levels across the 5 phrases (e.g. 2 beginner / 2 intermediate / 1 advanced) — not all the same level.
- difficulty:
  - "beginner"     = basic everyday phrase, ≤3 words, no honorific complexity
  - "intermediate" = polite form 요/-습니다 or short clause connectors
  - "advanced"     = nuanced expressions, honorifics, idiomatic
- word_breakdown: split each Korean phrase into 2~4 logical units (eojeol or particle group). Each unit needs surface form (word), romanization, and a short English meaning.
- synonyms: 1~2 similar Korean expressions per phrase (or empty array if none natural).
- antonyms: 0~2 opposite Korean expressions per phrase (or empty array if none natural).
- romanization: Revised Romanization (RR), no hyphens, lowercase except start of sentence.
- english: natural 1-line English equivalent (no surrounding quotes).
- If you do not have reliable knowledge of this specific drama, return an empty phrases array.`

// tool_use schema — Claude 가 자유 텍스트 대신 정확한 구조로 출력하도록 강제.
const PACK_TOOL: Anthropic.Tool = {
  name: "report_korean_pack",
  description:
    "Report a learning pack of Korean phrases inspired by a K-drama. Return an empty array if the drama is unknown.",
  input_schema: {
    type: "object",
    properties: {
      phrases: {
        type: "array",
        maxItems: MAX_PHRASES_PER_DRAMA,
        items: {
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
      },
    },
    required: ["phrases"],
  },
}

export interface GenerateKoreanPackInput {
  dramaKo: string | null
  dramaEn: string
}

export async function generateKoreanPack(
  input: GenerateKoreanPackInput
): Promise<KoreanPhrasePayload[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "[claude/korean-pack-generator] ANTHROPIC_API_KEY 누락 — generateKoreanPack abort"
    )
    return []
  }

  const userMessage = `Drama (English): ${input.dramaEn}
${input.dramaKo ? `Drama (Korean): ${input.dramaKo}` : ""}

Generate exactly ${MAX_PHRASES_PER_DRAMA} short Korean learning phrases inspired by the drama. Use the report_korean_pack tool. Return an empty array if you don't have reliable knowledge of this specific show.`

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2000,
      tools: [PACK_TOOL],
      tool_choice: { type: "tool", name: "report_korean_pack" },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    })

    const toolBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    )
    if (!toolBlock) {
      console.warn("[claude/korean-pack-generator] tool_use block 없음")
      return []
    }

    const parsed = toolBlock.input as { phrases?: unknown }
    if (!parsed || !Array.isArray(parsed.phrases)) {
      console.warn("[claude/korean-pack-generator] phrases 배열 아님")
      return []
    }

    const valid: KoreanPhrasePayload[] = []
    for (const raw of parsed.phrases) {
      const phrase = normalizePhrase(raw)
      if (phrase) valid.push(phrase)
      if (valid.length >= MAX_PHRASES_PER_DRAMA) break
    }
    return valid
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      const body = (err as unknown as { error?: { error?: { type?: string; message?: string } } })
        .error?.error
      console.error(
        `[claude/korean-pack-generator] APIError status=${err.status} type=${
          body?.type ?? "?"
        } message=${body?.message ?? err.message} drama=${input.dramaEn}`
      )
    } else if (err instanceof Error) {
      console.error(
        `[claude/korean-pack-generator] 예외 name=${err.name} message=${err.message} drama=${input.dramaEn}`
      )
    } else {
      console.error("[claude/korean-pack-generator] 알 수 없는 예외:", String(err))
    }
    return []
  }
}

// tool_use 결과의 한 phrase 객체를 KoreanPhrasePayload 로 정규화. 형식 위반 시 null.
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
