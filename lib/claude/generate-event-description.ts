// Hallyu Calendar 이벤트 한 줄 설명 자동 생성 — Claude Haiku 4.5
//
// 사용:
//   const desc = await generateEventDescription(title, artistOrDrama, type)
//   // 성공 → 영어 한 문장 (~100자), 실패 → null
//
// 설계 메모:
// - 모델: claude-haiku-4-5 (input $1/M, output $5/M — 이벤트 1건 ≈ $0.0005)
// - 출력: 1문장, 최대 100자, 영어. 영어권 K-pop·K-drama 팬 톤.
// - 시스템 프롬프트: cache_control 마커 부착. 단, Haiku 4.5 의 cache 최소 prefix 는
//   4096 토큰이라 현재(~600 토큰) 프롬프트는 실제 캐시되지 않음 (silent no-op, no harm).
//   향후 프롬프트가 4096 토큰 초과로 확장되면 자동으로 캐시 활성화됨.
// - 실패 시 null 반환 — 인제스트 라우트는 description 없이 이벤트 저장 계속 진행.

import Anthropic from "@anthropic-ai/sdk"

// 모듈 로드 시 1회 인스턴스화 — ANTHROPIC_API_KEY 환경변수 자동 사용
const client = new Anthropic()

export type EventType = "comeback" | "drama" | "concert" | "fanmeet"

// 시스템 프롬프트 — 캐시 키 안정성 위해 절대 동적 값(타임스탬프, ID) 삽입 금지
const SYSTEM_PROMPT = `You are a copywriter for UnfoldK, a Hallyu (Korean wave) calendar service for English-speaking K-pop and K-drama fans worldwide.

Write a single, engaging one-line description for a calendar event. Strict rules:
- Output exactly ONE sentence, maximum 100 characters
- Friendly, enthusiastic tone — match how fans talk about their favorites
- Include the artist or drama name naturally in the sentence
- Convey what type of event it is and build anticipation
- Plain English only — no Korean characters, no markdown, no emojis, no surrounding quotes
- Output the sentence directly with no preamble like "Here is..." or "Sure,"

Examples:
- comeback (aespa, "aespa - Whiplash MV"): aespa is back! The iconic K-pop quartet drops their highly anticipated new album.
- drama (Queen of Tears, "Queen of Tears Finale"): Queen of Tears hits its emotional finale — don't miss the conclusion of this hit romance.
- concert (BTS, "BTS World Tour Tokyo"): BTS takes the stage for an unforgettable live experience fans have been waiting for.
- fanmeet (NewJeans, "NewJeans Bunnies Camp"): NewJeans gathers their Bunnies for an intimate fanmeet packed with surprises.`

export async function generateEventDescription(
  title: string,
  artistOrDrama: string,
  type: EventType
): Promise<string | null> {
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 200,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          // prompt caching 활성화 (현재 프롬프트 길이는 임계값 미만 → 향후 확장 대비)
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Type: ${type}\nArtist or Drama: ${artistOrDrama}\nTitle: ${title}\n\nWrite the description.`,
        },
      ],
    })

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    )
    if (!textBlock) return null

    const description = textBlock.text.trim()
    if (description.length === 0) return null

    // 모델이 가끔 길게 쓰는 경우 방어 — 200자 초과면 실패로 간주
    if (description.length > 200) {
      console.warn(
        "[claude/generate-event-description] 응답이 200자 초과 — null 반환:",
        description.slice(0, 50)
      )
      return null
    }

    return description
  } catch (err) {
    // 네트워크 오류·rate limit·인증 실패 등 모두 null 반환 — 인제스트 계속 진행
    if (err instanceof Anthropic.APIError) {
      console.error(
        `[claude/generate-event-description] API error ${err.status}:`,
        err.message
      )
    } else {
      console.error(
        "[claude/generate-event-description] 예외:",
        err instanceof Error ? err.message : String(err)
      )
    }
    return null
  }
}
