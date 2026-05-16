// 블로그 본문 자동 생성 — Claude Haiku 4.5
//
// 흐름:
//   1. Haiku 가 TOPIC_POOL 중 1개 선택
//   2. 선택된 토픽에 맞춰 title / slug / description / tags / unsplashQuery / bodyMdx 생성
//   3. tool_use 로 구조화 출력 강제 (JSON parsing 실패 위험 제거)
//
// 모델: claude-haiku-4-5-20251001 (CLAUDE.md §2 명시 버전).
// 비용 가이드: 1포스트 ≈ output 1.5K tokens × $5/1M ≈ $0.0075/day = $2.7/year (지속 가능).
//
// 안전장치:
//   - 토픽 ID 는 TOOL 의 enum 으로 제한 (할루시네이션 토픽 차단)
//   - bodyMdx 길이 최소 800자 / 최대 8000자 (너무 짧거나 길면 실패로 간주)
//   - title 60자 이하, slug kebab-case 검증
//   - 실패는 throw — 호출자(run.ts) 가 GitHub push 까지 진행 안 함

import Anthropic from "@anthropic-ai/sdk"
import { TOPIC_POOL, type TopicId } from "./topics"

const client = new Anthropic()

const SYSTEM_PROMPT = `You are the staff editor for UnfoldK (unfoldk.com), an English-language Hallyu (Korean wave) media brand for K-pop, K-drama, K-food, and Korean-language fans worldwide.

You write one short, smart blog post per day. Voice:
- Confident, warm, slightly playful — like a friend who knows the scene.
- Plain English. Short paragraphs. Active voice. No corporate buzzwords.
- Educational > hyped. Curiosity > clickbait.
- Speak to a global audience: never assume the reader is Korean.

Critical rules:
- DO NOT invent specific facts you cannot verify: exact dates, real chart positions, real song titles tied to "this week", real album names, real episode counts, real ticket prices. Speak in patterns, themes, and well-known evergreen examples only.
- It's fine to reference universally known artists / dramas (BTS, BLACKPINK, NewJeans, Squid Game, Crash Landing on You, Parasite) — they are public knowledge.
- Markdown is MDX-safe. Headings, lists, blockquotes, bold/italic only. No HTML tags. No raw JSX. No code fences for content (only for actual code).
- No emojis.
- NO LINKS OF ANY KIND in bodyMdx. Zero. This means:
    - No markdown link syntax [text](url) — not for external sites, not for internal pages, not for anchors. Forbidden everywhere.
    - No bare URLs (http://, https://, www., domain.com).
    - No reference-style links ([text][1]) or footnote markers.
    - No image markdown ![alt](url).
  If you want to mention a source, a site, or an UnfoldK service, refer to it in plain prose by name only. Example: write "KpopStats sorts artists by listeners first" (good) — NOT "[KpopStats](/kpop) sorts..." (forbidden).
- End the body with a final paragraph that points the reader toward a relevant UnfoldK service by name (HallyuCalendar, KpopStats, KdramaMatch, HangeulGo, or KfoodKit), in plain text only — no link. Pick the service most relevant to the topic.
- DO NOT include a frontmatter block, title heading (# Title), image, or "Photo by ... on Unsplash" credit in bodyMdx. Those are added by the system.
- Length: 600–1200 words of MDX body. Aim for ~800.`

// Anthropic tool_use 스키마 — JSON.parse 실패 위험 제거 + 필드 enum 강제
const TOPIC_IDS = TOPIC_POOL.map((t) => t.id) as readonly TopicId[]

// SDK Tool 타입은 mutable string[] 요구 → readonly 제거 위해 `as const` 사용 안 함
const POST_TOOL: Anthropic.Tool = {
  name: "publish_blog_post",
  description:
    "Submit the finished blog post draft. The system will add frontmatter, attach the Unsplash image, and commit the file. Pick exactly one topicId from the allowed pool.",
  input_schema: {
    type: "object",
    properties: {
      topicId: {
        type: "string",
        enum: TOPIC_IDS,
        description: "Which topic from the pool this post is about.",
      },
      title: {
        type: "string",
        description: "Post title. Sentence case, 40–70 characters, no surrounding quotes.",
      },
      slug: {
        type: "string",
        pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        description:
          "URL-safe kebab-case slug (lowercase a-z, 0-9, hyphens). 3–80 characters. No date prefix — the system adds the date.",
      },
      description: {
        type: "string",
        description:
          "One-sentence summary used for the listing card and OG description. 90–180 characters.",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description:
          "2–4 tags from this controlled vocabulary: K-pop, K-drama, Comebacks, Charts, Data, Learning, Korean language, Recipes, Korean food, Behind the scenes.",
      },
      unsplashQuery: {
        type: "string",
        description:
          "2–4 word Unsplash search query for a cover photo. English nouns only. Avoid copyrighted-looking terms (artist names, drama titles). Examples: 'kpop concert stage', 'korean street food', 'seoul night skyline'.",
      },
      bodyMdx: {
        type: "string",
        description:
          "Full MDX body, 600–1200 words. No frontmatter, no top-level # heading (that's the title), no cover image markdown, no image-credit line. ZERO LINKS — no [text](url), no bare URLs, no markdown images. Mention sources and UnfoldK services in plain prose only. Start with a short hook paragraph.",
      },
    },
    required: ["topicId", "title", "slug", "description", "tags", "unsplashQuery", "bodyMdx"],
  },
}

export interface GeneratedPost {
  topicId: TopicId
  title: string
  slug: string
  description: string
  tags: string[]
  unsplashQuery: string
  bodyMdx: string
}

export class BlogGenerationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = "BlogGenerationError"
  }
}

function userPrompt(todayIso: string): string {
  const topicList = TOPIC_POOL.map(
    (t) => `  - ${t.id} — ${t.label}\n      Guidance: ${t.englishPrompt}`
  ).join("\n")
  return `Today's date: ${todayIso}

Topic pool (pick exactly one):
${topicList}

Pick the topic that feels freshest today, then write the post and submit via the publish_blog_post tool. Remember the critical rules in your instructions: no invented facts, MDX-safe markdown, and end with a soft link back to the most relevant UnfoldK service.`
}

// kebab-case 검증 — Anthropic schema pattern 만으론 LLM 위반 가능, 코드 측 한 번 더 확인.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export async function generateBlogPost(todayIso: string): Promise<GeneratedPost> {
  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      // tool_choice 로 도구 호출 강제 — 일반 텍스트 응답 방지
      tools: [POST_TOOL],
      tool_choice: { type: "tool", name: POST_TOOL.name },
      messages: [
        {
          role: "user",
          content: userPrompt(todayIso),
        },
      ],
    })
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      throw new BlogGenerationError(
        `Anthropic API error ${err.status}: ${err.message}`,
        err
      )
    }
    throw new BlogGenerationError(
      `Anthropic 호출 실패: ${err instanceof Error ? err.message : String(err)}`,
      err
    )
  }

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === POST_TOOL.name
  )
  if (!toolBlock) {
    throw new BlogGenerationError("Haiku 응답에 tool_use 블록 없음 (정책 위반)")
  }

  const input = toolBlock.input as Partial<GeneratedPost>

  // 코드 측 재검증 — schema 만 믿지 않음
  if (!input.topicId || !TOPIC_IDS.includes(input.topicId as TopicId)) {
    throw new BlogGenerationError(`topicId 누락/허용 외: ${String(input.topicId)}`)
  }
  if (!input.title || typeof input.title !== "string" || input.title.length < 10 || input.title.length > 100) {
    throw new BlogGenerationError(`title 길이 범위 외 (10–100자): ${input.title?.length}`)
  }
  if (!input.slug || typeof input.slug !== "string" || !SLUG_RE.test(input.slug) || input.slug.length > 80) {
    throw new BlogGenerationError(`slug 형식 위반: ${String(input.slug)}`)
  }
  if (!input.description || typeof input.description !== "string" || input.description.length < 30) {
    throw new BlogGenerationError(`description 너무 짧음: ${input.description?.length}`)
  }
  if (!Array.isArray(input.tags) || input.tags.length === 0 || input.tags.length > 6) {
    throw new BlogGenerationError(`tags 개수 범위 외 (1–6): ${input.tags?.length}`)
  }
  if (!input.unsplashQuery || typeof input.unsplashQuery !== "string" || input.unsplashQuery.length < 3) {
    throw new BlogGenerationError(`unsplashQuery 너무 짧음`)
  }
  if (
    !input.bodyMdx ||
    typeof input.bodyMdx !== "string" ||
    input.bodyMdx.length < 800 ||
    input.bodyMdx.length > 8000
  ) {
    throw new BlogGenerationError(
      `bodyMdx 길이 범위 외 (800–8000자): ${input.bodyMdx?.length}`
    )
  }
  // frontmatter / 상단 # 헤딩 / image-credit 라인 혼입 차단
  if (input.bodyMdx.startsWith("---") || /\n---\n/.test(input.bodyMdx.slice(0, 200))) {
    throw new BlogGenerationError("bodyMdx 가 frontmatter 를 포함함 (정책 위반)")
  }
  if (/^#\s/.test(input.bodyMdx.trim())) {
    throw new BlogGenerationError("bodyMdx 상단에 H1(#) 사용됨 — 시스템이 title 자동 렌더")
  }

  // 본문 링크 전면 차단 — 외부 URL, 내부 경로, mailto, 마크다운 이미지 모두 금지.
  // ① bare URL (http://, https://, www.)
  const bareUrlRe = /(?:https?:\/\/|\bwww\.)\S+/i
  const bareMatch = input.bodyMdx.match(bareUrlRe)
  if (bareMatch) {
    throw new BlogGenerationError(
      `bodyMdx 에 URL 포함 (정책 위반 — 본문 무링크): ${bareMatch[0].slice(0, 60)}`
    )
  }
  // ② 마크다운 링크 [text](url) — 종류 무관 모두 거부
  const linkMatch = input.bodyMdx.match(/\[([^\]]+)\]\(([^)]+)\)/)
  if (linkMatch) {
    throw new BlogGenerationError(
      `bodyMdx 에 마크다운 링크 포함 (정책 위반 — 본문 무링크): ${linkMatch[0].slice(0, 80)}`
    )
  }
  // ③ 마크다운 이미지 ![alt](url) — 위 ② 가 잡아내지만 명시적으로 한 번 더
  if (/!\[[^\]]*\]\([^)]+\)/.test(input.bodyMdx)) {
    throw new BlogGenerationError("bodyMdx 에 마크다운 이미지 포함 (정책 위반 — 본문 무링크)")
  }

  return {
    topicId: input.topicId as TopicId,
    title: input.title.trim(),
    slug: input.slug.trim(),
    description: input.description.trim(),
    tags: input.tags.map((t) => String(t).trim()).filter(Boolean),
    unsplashQuery: input.unsplashQuery.trim(),
    bodyMdx: input.bodyMdx.trim(),
  }
}
