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

// ============================================================
// 어드민 수동 입력 이벤트용 — 사실 확인 안 된 구체 정보 금지 (안전 모드)
// ============================================================
//
// 차이점:
// - 인제스트(rich) 모드는 source title 이 검증된 외부 API 결과물이라 마케팅 카피 자유로움.
// - 어드민 수동 입력은 title/artist/date 만 검증됨. 앨범명·장소·가격·에피소드 등은
//   추측 금지 — 1~2문장 안전 안내 + "공식 채널 확인" 지향.

const SAFE_SYSTEM_PROMPT = `You are a copywriter for UnfoldK, a Hallyu (Korean wave) calendar service for English-speaking K-pop and K-drama fans worldwide.

This description is for a MANUALLY-ENTERED event where ONLY the artist/drama name, event type, and date are verified. Anything else (album name, song title, venue, ticket price, episode number, plot detail) CANNOT be assumed and must NOT be invented.

Strict rules:
- Output 1-2 short sentences in English, maximum 200 characters total.
- Use ONLY the provided artist/drama name, event type, and date.
- Do NOT mention albums, songs, venues, prices, episode counts, tour names, or any other specifics.
- Always end with a fallback like "Check official channels for details." or "See official sources for the latest info."
- Plain English only — no Korean characters, no markdown, no emojis, no surrounding quotes, no preamble.
- Friendly but neutral tone — avoid hype superlatives that could mislead.

Examples:
- comeback (BTS, 2026-06-15): BTS has a comeback event scheduled for June 15, 2026. Check official channels for details.
- drama (Queen of Tears, 2026-07-01): A Queen of Tears event is scheduled for July 1, 2026. See official sources for the latest info.
- concert (BLACKPINK, 2026-09-20): BLACKPINK has a concert scheduled for September 20, 2026. Check official channels for details.
- fanmeet (NewJeans, 2026-08-10): NewJeans has a fanmeet planned for August 10, 2026. See official channels for the latest details.`

export async function generateSafeEventDescription(
  artistOrDrama: string,
  type: EventType,
  eventDate: string
): Promise<string | null> {
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 200,
      system: [
        {
          type: "text",
          text: SAFE_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Type: ${type}\nArtist or Drama: ${artistOrDrama}\nDate: ${eventDate}\n\nWrite the description.`,
        },
      ],
    })

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    )
    if (!textBlock) return null

    const description = textBlock.text.trim()
    if (description.length === 0) return null

    // 1~2 문장 + 안내 fallback 까지 포함하면 200자 빠듯할 수 있어 300자로 안전망
    if (description.length > 300) {
      console.warn(
        "[claude/generate-safe-event-description] 응답이 300자 초과 — null 반환:",
        description.slice(0, 50)
      )
      return null
    }

    return description
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error(
        `[claude/generate-safe-event-description] API error ${err.status}:`,
        err.message
      )
    } else {
      console.error(
        "[claude/generate-safe-event-description] 예외:",
        err instanceof Error ? err.message : String(err)
      )
    }
    return null
  }
}
