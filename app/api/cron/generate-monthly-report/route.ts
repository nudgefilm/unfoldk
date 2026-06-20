import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { verifyCronAuth } from "@/lib/cron/auth"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const anthropic = new Anthropic()

// ─── 날짜 헬퍼 ────────────────────────────────────────────────────────────────

function getMonthBounds(now: Date) {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth() // 0-indexed, current month

  const lastMonthStart = new Date(Date.UTC(y, m - 1, 1))
  const lastMonthEnd   = new Date(Date.UTC(y, m, 0))     // day 0 = last day of prev month
  const nextMonthStart = new Date(Date.UTC(y, m + 1, 1))
  const nextMonthEnd   = new Date(Date.UTC(y, m + 2, 0))
  const yearMonth      = `${y}-${String(m + 1).padStart(2, "0")}` // 현재 월 (리포트 생성월)

  return {
    lastMonthStart: lastMonthStart.toISOString().slice(0, 10),
    lastMonthEnd:   lastMonthEnd.toISOString().slice(0, 10),
    nextMonthStart: nextMonthStart.toISOString(),
    nextMonthEnd:   nextMonthEnd.toISOString(),
    yearMonth,
    dataYear:       lastMonthStart.getUTCFullYear(),
  }
}

// ─── 데이터 집계 함수 ──────────────────────────────────────────────────────────

type Admin = ReturnType<typeof createSupabaseAdminClient>

async function getTopRisingArtists(
  admin: Admin,
  startDate: string,
  endDate: string,
  limit = 5
) {
  const { data } = await admin
    .from("kpop_stats_daily")
    .select("artist_id, date, lastfm_listeners")
    .gte("date", startDate)
    .lte("date", endDate)
    .not("lastfm_listeners", "is", null)
    .gt("lastfm_listeners", 0)
    .order("date", { ascending: true })
    .limit(10000)

  if (!data?.length) return []

  type Row = { artist_id: string; date: string; lastfm_listeners: number }
  const artistData = new Map<string, { first: number; last: number }>()

  for (const row of data as Row[]) {
    const existing = artistData.get(row.artist_id)
    if (!existing) {
      artistData.set(row.artist_id, { first: row.lastfm_listeners, last: row.lastfm_listeners })
    } else {
      existing.last = row.lastfm_listeners // 날짜 오름차순이므로 마지막이 최신값
    }
  }

  const changes = Array.from(artistData.entries())
    .map(([artist_id, { first, last }]) => ({
      artist_id,
      change_pct: first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : 0,
      start_listeners: first,
      end_listeners: last,
    }))
    .filter((a) => a.change_pct > 0)
    .sort((a, b) => b.change_pct - a.change_pct)
    .slice(0, limit)

  if (changes.length === 0) return []

  const { data: artists } = await admin
    .from("kpop_artists")
    .select("id, name")
    .in("id", changes.map((c) => c.artist_id))

  const nameMap = new Map(
    ((artists ?? []) as Array<{ id: string; name: string }>).map((a) => [a.id, a.name])
  )

  return changes.map((c) => ({
    id: c.artist_id,
    name: nameMap.get(c.artist_id) ?? "Unknown",
    change_pct: c.change_pct,
    start_listeners: c.start_listeners,
    end_listeners: c.end_listeners,
  }))
}

async function getCountryTrends(admin: Admin, startDate: string, endDate: string) {
  const { data } = await admin
    .from("kpop_country_charts")
    .select("week_start, country_code, artist_name")
    .gte("week_start", startDate)
    .lte("week_start", endDate)
    .eq("rank", 1)
    .order("week_start", { ascending: true })

  if (!data?.length) return []

  type Row = { week_start: string; country_code: string; artist_name: string }
  const countryData = new Map<string, { start: string; end: string }>()

  for (const row of data as Row[]) {
    const existing = countryData.get(row.country_code)
    if (!existing) {
      countryData.set(row.country_code, { start: row.artist_name, end: row.artist_name })
    } else {
      existing.end = row.artist_name
    }
  }

  return Array.from(countryData.entries())
    .slice(0, 5)
    .map(([country_code, { start, end }]) => ({
      country_code,
      start_artist: start,
      end_artist: end,
      changed: start !== end,
    }))
}

async function getTopDramas(admin: Admin, dataYear: number) {
  const { data } = await admin
    .from("dramas")
    .select("id, title, genre, popularity, platform")
    .eq("is_active", true)
    .gte("year", dataYear - 1)
    .order("popularity", { ascending: false })
    .not("popularity", "is", null)
    .limit(5)

  return ((data ?? []) as Array<{
    id: string
    title: string
    genre: string | null
    popularity: number
    platform: string | null
  }>).map((d) => ({
    id: d.id,
    title: d.title,
    genre: d.genre,
    popularity: d.popularity,
    platform: d.platform,
  }))
}

async function getUpcomingEvents(admin: Admin, nextMonthStart: string, nextMonthEnd: string) {
  const { data } = await admin
    .from("hallyu_calendar_events")
    .select("id, title, artist_or_drama, event_date, type")
    .in("type", ["comeback", "concert", "fanmeet"])
    .gte("event_date", nextMonthStart)
    .lte("event_date", nextMonthEnd)
    .order("event_date", { ascending: true })
    .limit(5)

  return ((data ?? []) as Array<{
    id: string
    title: string
    artist_or_drama: string
    event_date: string
    type: string
  }>)
}

// ─── Claude Haiku 인사이트 생성 ───────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the data analyst for UnfoldK, a Hallyu fan platform. Write monthly trend insights for Hallyu Pass members based on streaming and entertainment data. Be analytical, insightful, and fan-focused. Plain English. No markdown. No emojis. 3-4 sentences.`

const INSIGHT_TOOL: Anthropic.Tool = {
  name: "submit_insight",
  description: "Submit the monthly Hallyu trend insight.",
  input_schema: {
    type: "object" as const,
    properties: {
      insight: {
        type: "string",
        description:
          "3-4 sentences. Sentence 1-2: K-pop streaming landscape and notable trends. Sentence 3: drama and content highlights. Sentence 4: forward-looking fan engagement tip for next month. Max 450 characters.",
      },
    },
    required: ["insight"],
  },
}

interface TopArtist { id: string; name: string; change_pct: number; start_listeners: number; end_listeners: number }
interface CountryTrend { country_code: string; start_artist: string; end_artist: string; changed: boolean }
interface TopDrama { id: string; title: string; genre: string | null; popularity: number; platform: string | null }
interface UpcomingEvent { id: string; title: string; artist_or_drama: string; event_date: string; type: string }

interface ReportContent {
  data_period: { start: string; end: string }
  top_artists: TopArtist[]
  country_trends: CountryTrend[]
  top_dramas: TopDrama[]
  upcoming_events: UpcomingEvent[]
}

function buildPrompt(content: ReportContent, month: string): string {
  const artists = content.top_artists.length
    ? content.top_artists
        .map((a, i) => `${i + 1}. ${a.name}: +${a.change_pct}% (+${(a.end_listeners - a.start_listeners).toLocaleString("en-US")})`)
        .join("\n")
    : "No data"

  const countries = content.country_trends.length
    ? content.country_trends
        .map((c) =>
          c.changed
            ? `${c.country_code}: ${c.start_artist} → ${c.end_artist}`
            : `${c.country_code}: ${c.end_artist} (no change)`
        )
        .join("\n")
    : "No data"

  const dramas = content.top_dramas.length
    ? content.top_dramas
        .map((d, i) => `${i + 1}. "${d.title}"${d.genre ? ` (${d.genre})` : ""}`)
        .join("\n")
    : "No data"

  const events = content.upcoming_events.length
    ? content.upcoming_events
        .map((e) => {
          const dt = new Date(e.event_date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          })
          return `• ${e.artist_or_drama} — ${e.type} — ${dt}`
        })
        .join("\n")
    : "No events scheduled"

  return `Month: ${month}

Top Rising K-pop Artists (Last.fm listener growth):
${artists}

Country #1 Trends (Last.fm geo):
${countries}

Top Dramas by TMDB Popularity:
${dramas}

Upcoming Next Month:
${events}

Write the 3-4 sentence monthly insight using the submit_insight tool.`
}

async function generateInsight(content: ReportContent, month: string): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: [INSIGHT_TOOL],
      tool_choice: { type: "tool", name: INSIGHT_TOOL.name },
      messages: [{ role: "user", content: buildPrompt(content, month) }],
    })
    const toolBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    )
    return (toolBlock?.input as { insight?: string })?.insight ?? ""
  } catch {
    return ""
  }
}

// ─── Cron 핸들러 ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const admin = createSupabaseAdminClient()
  const now = new Date()
  const { lastMonthStart, lastMonthEnd, nextMonthStart, nextMonthEnd, yearMonth, dataYear } =
    getMonthBounds(now)

  // 1. year_month unique — 중복 생성 방지
  const { data: existing } = await admin
    .from("monthly_trend_reports")
    .select("id")
    .eq("year_month", yearMonth)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, message: "Report already exists", yearMonth })
  }

  // 2. 데이터 집계
  const [topArtists, countryTrends, topDramas, upcomingEvents] = await Promise.all([
    getTopRisingArtists(admin, lastMonthStart, lastMonthEnd),
    getCountryTrends(admin, lastMonthStart, lastMonthEnd),
    getTopDramas(admin, dataYear),
    getUpcomingEvents(admin, nextMonthStart, nextMonthEnd),
  ])

  const reportContent: ReportContent = {
    data_period: { start: lastMonthStart, end: lastMonthEnd },
    top_artists: topArtists,
    country_trends: countryTrends,
    top_dramas: topDramas,
    upcoming_events: upcomingEvents,
  }

  // 3. Claude Haiku 인사이트 생성
  const dataMonth = new Date(lastMonthStart + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
  const summaryText = await generateInsight(reportContent, dataMonth)

  // 4. monthly_trend_reports 저장
  const { error } = await admin.from("monthly_trend_reports").insert({
    year_month: yearMonth,
    report_content: reportContent,
    summary_text: summaryText,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    yearMonth,
    topArtistsCount: topArtists.length,
    countryTrendsCount: countryTrends.length,
    topDramasCount: topDramas.length,
    upcomingEventsCount: upcomingEvents.length,
  })
}
