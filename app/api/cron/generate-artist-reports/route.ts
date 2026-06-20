import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { verifyCronAuth } from "@/lib/cron/auth"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const anthropic = new Anthropic()

// ─── 날짜 헬퍼 ────────────────────────────────────────────────────────────────

function getWeekStart(): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Claude Haiku 요약 생성 ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the stats analyst for UnfoldK, a Hallyu fan platform. Given K-pop artist streaming data, write concise weekly summaries for Hallyu Pass members. Be factual and insight-driven. Plain English only. No markdown. No emojis. Max 2 sentences.`

const SUMMARY_TOOL: Anthropic.Tool = {
  name: "submit_summary",
  description: "Submit the 2-sentence weekly artist summary.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description:
          "Exactly 2 sentences. Sentence 1: what the listener data suggests this week (trend analysis). Sentence 2: what fans should watch for next week. Max 220 characters total.",
      },
    },
    required: ["summary"],
  },
}

interface ArtistStats {
  name: string
  listenerCount: number
  listenerChange: number
  topCountryCodes: string[]
  newEventsCount: number
}

async function generateSummary(stats: ArtistStats): Promise<string> {
  const changeSign = stats.listenerChange >= 0 ? "+" : ""
  const prompt = `Artist: ${stats.name}
Global Last.fm listeners: ${stats.listenerCount.toLocaleString("en-US")} (${changeSign}${stats.listenerChange.toLocaleString("en-US")} vs last week)
Top countries: ${stats.topCountryCodes.length > 0 ? stats.topCountryCodes.join(", ") : "N/A"}
New calendar events this week: ${stats.newEventsCount}

Write the 2-sentence weekly summary using the submit_summary tool.`

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: [SUMMARY_TOOL],
      tool_choice: { type: "tool", name: SUMMARY_TOOL.name },
      messages: [{ role: "user", content: prompt }],
    })
    const toolBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    )
    return (toolBlock?.input as { summary?: string })?.summary ?? ""
  } catch {
    return ""
  }
}

// ─── 아티스트 1건 처리 ─────────────────────────────────────────────────────────

interface ArtistRecord {
  artist_id: string
  name: string
}

type ProcessResult = { status: "saved" | "skipped" | "error"; reason?: string }

async function processArtist(
  artist: ArtistRecord,
  weekStart: string,
  admin: ReturnType<typeof createSupabaseAdminClient>
): Promise<ProcessResult> {
  try {
    // 1. 멱등성 체크 — 이미 이번 주 리포트 있으면 건너뜀
    const { data: existing } = await admin
      .from("artist_weekly_reports")
      .select("id")
      .eq("artist_id", artist.artist_id)
      .eq("week_start", weekStart)
      .maybeSingle()

    if (existing) return { status: "skipped", reason: "already_exists" }

    // 2. 최근 8일 kpop_stats_daily → 리스너 수 + 주간 증감
    const { data: statRows } = await admin
      .from("kpop_stats_daily")
      .select("lastfm_listeners, date")
      .eq("artist_id", artist.artist_id)
      .order("date", { ascending: false })
      .limit(8)

    const rows = (statRows ?? []) as Array<{ lastfm_listeners: number; date: string }>
    const listenerCount = rows[0]?.lastfm_listeners ?? 0
    const prevListeners = rows.length > 1 ? rows[rows.length - 1].lastfm_listeners : listenerCount
    const listenerChange = listenerCount - prevListeners
    const hasListenerData = rows.length > 0

    // 3. 최근 국가별 청취자 TOP 3 — kpop_country_charts
    const { data: latestCountryWeek } = await admin
      .from("kpop_country_charts")
      .select("week_start")
      .eq("artist_id", artist.artist_id)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle()

    let topCountries: Array<{ country_code: string; listeners: number }> = []
    if (latestCountryWeek) {
      const cw = latestCountryWeek as { week_start: string }
      const { data: countryRows } = await admin
        .from("kpop_country_charts")
        .select("country_code, listeners")
        .eq("artist_id", artist.artist_id)
        .eq("week_start", cw.week_start)
        .order("listeners", { ascending: false })
        .limit(3)
      topCountries = ((countryRows ?? []) as Array<{ country_code: string; listeners: number }>).map(
        (r) => ({ country_code: r.country_code, listeners: r.listeners })
      )
    }

    // 4. 이번 주 새 이벤트 수 — hallyu_calendar_events (아티스트명 일치 기준)
    const weekEnd = addDays(weekStart, 7)
    const { count: eventsCount } = await admin
      .from("hallyu_calendar_events")
      .select("*", { count: "exact", head: true })
      .ilike("artist_or_drama", artist.name)
      .gte("event_date", weekStart)
      .lt("event_date", weekEnd)

    const newEventsCount = eventsCount ?? 0

    // 5. Claude Haiku 요약 생성
    const summaryText = await generateSummary({
      name: artist.name,
      listenerCount,
      listenerChange,
      topCountryCodes: topCountries.map((c) => c.country_code),
      newEventsCount,
    })

    // 6. artist_weekly_reports 저장
    const { error: insertErr } = await admin.from("artist_weekly_reports").insert({
      artist_id: artist.artist_id,
      week_start: weekStart,
      listener_count: listenerCount,
      listener_change: listenerChange,
      top_countries: topCountries,
      new_events_count: newEventsCount,
      summary_text: summaryText,
    })

    if (insertErr) return { status: "error", reason: `insert_failed: ${insertErr.message}` }

    return { status: "saved", reason: hasListenerData ? undefined : "no_listener_data" }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { status: "error", reason: msg }
  }
}

// ─── Cron 핸들러 ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const weekStart = getWeekStart()

  // ── 소스 A: kpop_artist_follows (KpopStats Track 버튼) ─────────────────────
  const { data: followRows, error: followErr } = await admin
    .from("kpop_artist_follows")
    .select("artist_id")

  if (followErr) return NextResponse.json({ error: followErr.message }, { status: 500 })

  const artistIdSet = new Set<string>(
    ((followRows ?? []) as Array<{ artist_id: string }>).map((r) => r.artist_id)
  )
  const sourceACount = artistIdSet.size

  // ── 소스 B: user_calendar_subscriptions → hallyu_calendar_events → kpop_artists ──
  // HallyuCalendar Set Reminder 또는 Track 버튼 경유 구독에서 아티스트 추출
  const { data: subRows } = await admin
    .from("user_calendar_subscriptions")
    .select("event_id")

  const eventIds = [...new Set(
    ((subRows ?? []) as Array<{ event_id: string }>).map((r) => r.event_id)
  )]

  if (eventIds.length > 0) {
    const { data: eventRows } = await admin
      .from("hallyu_calendar_events")
      .select("artist_or_drama")
      .in("id", eventIds)

    const eventNames = new Set<string>()
    for (const row of (eventRows ?? []) as Array<{ artist_or_drama: string | null }>) {
      const n = row.artist_or_drama?.trim().toLowerCase()
      if (n) eventNames.add(n)
    }

    if (eventNames.size > 0) {
      const { data: allArtists } = await admin
        .from("kpop_artists")
        .select("id, name, name_ko")
        .eq("is_active", true)
        .limit(2000)

      for (const a of (allArtists ?? []) as Array<{ id: string; name: string; name_ko: string | null }>) {
        const n = a.name.toLowerCase()
        const nko = a.name_ko?.toLowerCase() ?? null
        const matched = [...eventNames].some((en) => {
          if (en.includes(n)) return true
          if (nko && en.includes(nko)) return true
          return false
        })
        if (matched) artistIdSet.add(a.id)
      }
    }
  }

  const uniqueArtistIds = [...artistIdSet]

  if (uniqueArtistIds.length === 0) {
    return NextResponse.json({ ok: true, weekStart, total: 0, saved: 0, skipped: 0, errors: 0, sourceA: 0, sourceB: 0 })
  }

  // 아티스트 이름 조회
  const { data: artistRows } = await admin
    .from("kpop_artists")
    .select("id, name")
    .in("id", uniqueArtistIds)

  const artists: ArtistRecord[] = ((artistRows ?? []) as Array<{ id: string; name: string }>).map(
    (r) => ({ artist_id: r.id, name: r.name })
  )

  // 5개 단위 병렬 처리 (Claude rate limit 고려)
  const BATCH = 5
  const details: Array<{ name: string; status: string; reason?: string }> = []

  for (let i = 0; i < artists.length; i += BATCH) {
    const batch = artists.slice(i, i + BATCH)
    const batchResults = await Promise.all(
      batch.map((a) => processArtist(a, weekStart, admin))
    )
    batch.forEach((a, idx) => {
      const r = batchResults[idx]
      details.push({ name: a.name, status: r.status, ...(r.reason ? { reason: r.reason } : {}) })
    })
  }

  return NextResponse.json({
    ok: true,
    weekStart,
    total: artists.length,
    saved: details.filter((r) => r.status === "saved").length,
    skipped: details.filter((r) => r.status === "skipped").length,
    errors: details.filter((r) => r.status === "error").length,
    sourceA: sourceACount,
    sourceB: artists.length - sourceACount,
    details,
  })
}
