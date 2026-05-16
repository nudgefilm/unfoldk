// Discord 봇 응답에 필요한 데이터 fetch 모듈 — cron 일일 포스팅 + 슬래시 명령 양쪽이 동일 소스 사용.
//
// 외부 의존:
//   - hallyu_calendar_events (M+0) — daily-schedule / /comeback
//   - kpop_artists + kpop_stats_daily (M+1) — kpop-charts / /chart
//   - TMDB API (M+0) — drama-updates / /drama
//   - lib/discord/korean-phrases.ts — korean-phrase / /korean (HangeulGo 백엔드 미구현)
//
// 모든 외부 호출은 호출 측에서 try/catch — fallback 은 Embed 빌더 단에서 "no data" 메시지.

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { fetchCurrentlyAiringKoreanDramas, type TmdbTvShow } from "@/lib/api/tmdb"
import { getDailyKoreanPhrase, type KoreanPhrase } from "@/lib/discord/korean-phrases"

export interface ScheduleItem {
  title: string
  artist_or_drama: string
  event_date: string // ISO
  type: "comeback" | "drama" | "concert" | "fanmeet"
}

export interface ChartItem {
  rank: number
  name: string
  lastfm_listeners: number | null
  youtube_subscribers: number | null
}

// UTC 기준 [today 00:00, +1day) 윈도우
function utcTodayWindow(): { from: string; to: string } {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const end = new Date(start.getTime() + 86_400_000)
  return { from: start.toISOString(), to: end.toISOString() }
}

// UTC 기준 [now, +7day) 윈도우
function utcWeekAheadWindow(): { from: string; to: string } {
  const now = new Date()
  const end = new Date(now.getTime() + 7 * 86_400_000)
  return { from: now.toISOString(), to: end.toISOString() }
}

export async function fetchTodaySchedule(limit = 10): Promise<ScheduleItem[]> {
  const supabase = createSupabaseAdminClient()
  const { from, to } = utcTodayWindow()
  const { data, error } = await supabase
    .from("hallyu_calendar_events")
    .select("title, artist_or_drama, event_date, type")
    .gte("event_date", from)
    .lt("event_date", to)
    .order("event_date", { ascending: true })
    .limit(limit)
  if (error) {
    console.error("[discord/data] fetchTodaySchedule:", error.message)
    return []
  }
  return (data ?? []) as ScheduleItem[]
}

export async function fetchWeeklyComebacks(limit = 10): Promise<ScheduleItem[]> {
  const supabase = createSupabaseAdminClient()
  const { from, to } = utcWeekAheadWindow()
  const { data, error } = await supabase
    .from("hallyu_calendar_events")
    .select("title, artist_or_drama, event_date, type")
    .eq("type", "comeback")
    .gte("event_date", from)
    .lt("event_date", to)
    .order("event_date", { ascending: true })
    .limit(limit)
  if (error) {
    console.error("[discord/data] fetchWeeklyComebacks:", error.message)
    return []
  }
  return (data ?? []) as ScheduleItem[]
}

export async function fetchTop10Chart(): Promise<ChartItem[]> {
  const supabase = createSupabaseAdminClient()

  // 최신 통계 날짜 — 어제/오늘 둘 다 가능 (cron 시점에 따라 변동)
  const { data: latestRow, error: latestErr } = await supabase
    .from("kpop_stats_daily")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (latestErr || !latestRow) {
    console.error("[discord/data] fetchTop10Chart latest date:", latestErr?.message)
    return []
  }

  const { data, error } = await supabase
    .from("kpop_stats_daily")
    .select("lastfm_listeners, youtube_subscribers, kpop_artists!inner(name)")
    .eq("date", latestRow.date)
    .not("lastfm_listeners", "is", null)
    .order("lastfm_listeners", { ascending: false })
    .limit(10)
  if (error) {
    console.error("[discord/data] fetchTop10Chart:", error.message)
    return []
  }

  // Supabase join 결과 — kpop_artists 는 단일 객체 (!inner) 지만 타입이 array 로 추론될 수 있어 안전 접근
  type Row = {
    lastfm_listeners: number | null
    youtube_subscribers: number | null
    kpop_artists: { name: string } | { name: string }[]
  }
  const rows = (data ?? []) as Row[]
  return rows.map((row, idx) => {
    const artist = Array.isArray(row.kpop_artists) ? row.kpop_artists[0] : row.kpop_artists
    return {
      rank: idx + 1,
      name: artist?.name ?? "Unknown",
      lastfm_listeners: row.lastfm_listeners,
      youtube_subscribers: row.youtube_subscribers,
    }
  })
}

export async function fetchAiringDramas(limit = 5): Promise<TmdbTvShow[]> {
  try {
    return await fetchCurrentlyAiringKoreanDramas(limit)
  } catch (err) {
    console.error("[discord/data] fetchAiringDramas:", err)
    return []
  }
}

export function fetchTodayKoreanPhrase(): KoreanPhrase {
  return getDailyKoreanPhrase()
}
