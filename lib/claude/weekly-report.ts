// 주간 한류 리포트 자동 생성 — Claude Haiku 4.5
//
// 매주 월요일 09:00 UTC Vercel Cron 에서 호출.
// tool_use 로 7섹션 구조화 출력 강제 → weekly_reports 테이블에 캐싱.
//
// 섹션 구성:
//   1. comebacks   — 이번 주 컴백 & 신보 (HallyuCalendar 연계)
//   2. dramas      — 지금 뜨는 드라마 TOP 3 (KdramaMatch 연계)
//   3. korean      — 이번 주 한국어 표현 1개 (HangeulGo 연계)
//   4. food        — 이번 주 K-Food 1개 (KfoodKit 연계)
//   5. travel      — 한국 여행 픽 — 촬영지/축제 (Curation K 연계)
//   6. trends      — 글로벌 팬 커뮤니티 트렌드 키워드
//   7. preview     — 다음 주 예고 (HallyuCalendar 연계)

import Anthropic from "@anthropic-ai/sdk"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const client = new Anthropic()

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export interface ReportSection {
  title: string    // 섹션 제목 (영어)
  content: string  // 본문 (100–200자, 영어)
  cta: string      // "자세히 보기 →" 텍스트 (영어)
  href: string     // 연계 서비스 경로
}

export interface WeeklyReportContent {
  week_start: string         // YYYY-MM-DD (해당 주 월요일)
  headline: string           // 주간 한 줄 헤드라인
  comebacks: ReportSection
  dramas: ReportSection
  korean: ReportSection
  food: ReportSection
  travel: ReportSection
  trends: ReportSection
  preview: ReportSection
}

export interface WeeklyReportRow {
  id: string
  week_start: string
  content_json: WeeklyReportContent
  created_at: string
}

export class WeeklyReportError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = "WeeklyReportError"
  }
}

// ─── 시스템 프롬프트 ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the weekly editor for UnfoldK (unfoldk.com), an English-language Hallyu media brand for K-pop, K-drama, K-food, and Korean-language fans worldwide.

Every Monday you produce "This Week in Hallyu" — a concise 7-section digest that fans can read in 5 minutes.

Voice rules:
- Confident, warm, slightly playful. Like a knowledgeable friend who lives the Hallyu scene.
- Plain English. Short sentences. Active voice. No corporate buzzwords.
- Global audience: never assume the reader is Korean or in Korea.
- Educational and curious, not hyped or clickbait.

Content rules:
- DO NOT invent specific facts you cannot verify: exact chart numbers, real comeback dates tied to "this week", real album or song titles, real OTT episode counts, real ticket prices.
- Speak in patterns, themes, moods, and well-known evergreen examples (BTS, BLACKPINK, NewJeans, Squid Game, etc. are fine as anchors).
- Each section: 80–160 characters of content. Tight and scannable.
- No markdown in content fields. Plain prose only.
- No emojis.`

// ─── tool_use 스키마 ──────────────────────────────────────────────────────────

const REPORT_TOOL: Anthropic.Tool = {
  name: "publish_weekly_report",
  description: "Submit the finished weekly Hallyu digest. All 7 sections required.",
  input_schema: {
    type: "object",
    properties: {
      headline: {
        type: "string",
        description: "One punchy headline for this week's digest. 50–90 characters. No surrounding quotes.",
      },
      comebacks_title: { type: "string", description: "Section heading for comebacks & new releases. Max 50 chars." },
      comebacks_content: { type: "string", description: "80–160 chars. Thematic overview of K-pop activity this week — genres, vibes, artist categories (solos, groups). No invented titles." },
      dramas_title: { type: "string", description: "Section heading for trending dramas. Max 50 chars." },
      dramas_content: { type: "string", description: "80–160 chars. Mood and genre overview of what's drawing viewers this week — romance, thriller, fantasy. Mention OTT platforms by name (Netflix, Disney+, tvN) thematically." },
      korean_title: { type: "string", description: "Section heading for the Korean expression. Max 50 chars." },
      korean_content: { type: "string", description: "80–160 chars. Introduce one useful Korean phrase or word fans hear in dramas or K-pop. Include Hangul, romanization, and a brief usage note." },
      food_title: { type: "string", description: "Section heading for K-Food pick. Max 50 chars." },
      food_content: { type: "string", description: "80–160 chars. Spotlight one Korean dish — what it is, when Koreans eat it, why drama fans love it." },
      travel_title: { type: "string", description: "Section heading for Korea travel pick. Max 50 chars." },
      travel_content: { type: "string", description: "80–160 chars. Highlight one filming location, cultural festival, or hidden gem in Korea worth knowing about." },
      trends_title: { type: "string", description: "Section heading for fan community trends. Max 50 chars." },
      trends_content: { type: "string", description: "80–160 chars. 3–5 trending themes, hashtags, or topics circulating in the global Hallyu fan community this week." },
      preview_title: { type: "string", description: "Section heading for next week preview. Max 50 chars." },
      preview_content: { type: "string", description: "80–160 chars. Tease what's coming next week — upcoming comebacks, drama premieres, or events. Thematic only, no invented specifics." },
    },
    required: [
      "headline",
      "comebacks_title", "comebacks_content",
      "dramas_title", "dramas_content",
      "korean_title", "korean_content",
      "food_title", "food_content",
      "travel_title", "travel_content",
      "trends_title", "trends_content",
      "preview_title", "preview_content",
    ],
  },
}

// ─── 생성 함수 ────────────────────────────────────────────────────────────────

function getWeekStart(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = d.getUTCDay() // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day  // 해당 주 월요일로 조정
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

function userPrompt(weekStart: string): string {
  return `Today is Monday ${weekStart}. Write this week's Hallyu digest using the publish_weekly_report tool.

Cover these seven areas naturally:
1. K-pop comebacks & new releases — what's dropping this week, what vibes to expect
2. Trending K-dramas — genres pulling viewers in right now, OTT landscape
3. Korean expression of the week — something fans will encounter in content
4. K-Food spotlight — a dish fans see on screen
5. Korea travel pick — one filming location, festival, or hidden gem
6. Global fan community trends — what topics are buzzing across the fandom
7. Next week preview — what to look forward to

Keep each section tight: 80–160 characters of clean, fan-friendly English prose.`
}

export async function generateWeeklyReport(now = new Date()): Promise<WeeklyReportContent> {
  const weekStart = getWeekStart(now)

  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: [REPORT_TOOL],
      tool_choice: { type: "tool", name: REPORT_TOOL.name },
      messages: [{ role: "user", content: userPrompt(weekStart) }],
    })
  } catch (err) {
    throw new WeeklyReportError(
      `Anthropic API 호출 실패: ${err instanceof Error ? err.message : String(err)}`,
      err
    )
  }

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === REPORT_TOOL.name
  )
  if (!toolBlock) throw new WeeklyReportError("tool_use 블록 없음")

  const i = toolBlock.input as Record<string, string>

  const missing = REPORT_TOOL.input_schema.required?.find((k) => !i[k])
  if (missing) throw new WeeklyReportError(`필수 필드 누락: ${missing}`)

  const makeSection = (
    title: string,
    content: string,
    cta: string,
    href: string
  ): ReportSection => ({ title, content, cta, href })

  return {
    week_start: weekStart,
    headline: i.headline,
    comebacks: makeSection(i.comebacks_title, i.comebacks_content, "See this week's calendar →", "/calendar"),
    dramas: makeSection(i.dramas_title, i.dramas_content, "Find your next K-drama →", "/drama"),
    korean: makeSection(i.korean_title, i.korean_content, "Learn more expressions →", "/korean"),
    food: makeSection(i.food_title, i.food_content, "Explore K-Food recipes →", "/food"),
    travel: makeSection(i.travel_title, i.travel_content, "Discover filming spots →", "/curation-k"),
    trends: makeSection(i.trends_title, i.trends_content, "Track your artists →", "/kpop"),
    preview: makeSection(i.preview_title, i.preview_content, "Add to your calendar →", "/calendar"),
  }
}

// ─── DB 저장 ──────────────────────────────────────────────────────────────────

export async function saveWeeklyReport(content: WeeklyReportContent): Promise<WeeklyReportRow> {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from("weekly_reports")
    .insert({ week_start: content.week_start, content_json: content })
    .select()
    .single()

  if (error) throw new WeeklyReportError(`DB 저장 실패: ${error.message}`, error)
  return data as WeeklyReportRow
}

export async function getWeeklyReport(weekStart: string): Promise<WeeklyReportRow | null> {
  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from("weekly_reports")
    .select()
    .eq("week_start", weekStart)
    .maybeSingle()
  return (data as WeeklyReportRow | null) ?? null
}

export async function listWeeklyReports(limit = 10): Promise<WeeklyReportRow[]> {
  const admin = createSupabaseAdminClient()
  const { data } = await admin
    .from("weekly_reports")
    .select()
    .order("week_start", { ascending: false })
    .limit(limit)
  return (data ?? []) as WeeklyReportRow[]
}
