// KpopStats 주간 인제스트 — 매주 월요일 04:00 UTC
// 1. 청취자 급증 Top 3 아티스트 Claude 인사이트 생성 + DB 저장
// 2. 주간 K팝 트렌드 리포트 생성 + DB 저장
// ※ 국가별 차트 수집은 daily ingest (lib/ingest/kpop-stats.ts) 로 이관

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  generateArtistInsight,
  generateWeeklyKpopReport,
} from "@/lib/claude/kpop-weekly"

// 이번 주 월요일 (UTC) YYYY-MM-DD
function getWeekStart(now = new Date()): string {
  const d = new Date(now)
  const day = d.getUTCDay() // 0=Sun, 1=Mon … 6=Sat
  const diff = day === 0 ? 6 : day - 1
  d.setUTCDate(d.getUTCDate() - diff)
  return d.toISOString().slice(0, 10)
}

export interface KpopWeeklyIngestResult {
  source: "kpop-weekly"
  weekStart: string
  skipped: boolean
  insightsGenerated: number
  reportGenerated: boolean
  countryChartsCollected: number
  errors: string[]
}

export async function runKpopWeeklyIngest(): Promise<KpopWeeklyIngestResult> {
  const admin = createSupabaseAdminClient()
  const weekStart = getWeekStart()
  const errors: string[] = []

  // 멱등 체크: report + country charts 모두 존재해야 완전 스킵
  // report 있고 charts 없으면 charts 수집만 재실행
  const [{ data: existingReport }, { count: existingChartCount }] = await Promise.all([
    admin.from("kpop_weekly_report").select("week_start").eq("week_start", weekStart).maybeSingle(),
    admin.from("kpop_country_charts").select("*", { count: "exact", head: true }).eq("week_start", weekStart),
  ])
  const reportDone = !!existingReport
  const chartsDone = (existingChartCount ?? 0) > 0

  if (reportDone && chartsDone) {
    return {
      source: "kpop-weekly",
      weekStart,
      skipped: true,
      insightsGenerated: 0,
      reportGenerated: false,
      countryChartsCollected: 0,
      errors: [],
    }
  }

  // ── Step 1: 청취자 성장 순위 계산 ──────────────────────────
  // 최신 날짜와 7일 전 날짜의 kpop_stats_daily 비교
  const { data: latestDateRow } = await admin
    .from("kpop_stats_daily")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle()

  const latestDate = latestDateRow?.date as string | null
  let trendingArtists: Array<{
    artistId: string
    name: string
    listeners: number
    prev: number | null
    growth: number
  }> = []

  if (latestDate) {
    // 최신 날짜 stats
    type StatRow = { artist_id: string; lastfm_listeners: number | null; kpop_artists: { name: string } | null }

    const { data: latestStats } = await admin
      .from("kpop_stats_daily")
      .select("artist_id, lastfm_listeners, kpop_artists!inner(name)")
      .eq("date", latestDate)
      .not("lastfm_listeners", "is", null)

    // 7일 전 stats (3일 범위 내 가장 최신)
    const prevDateTarget = new Date(latestDate)
    prevDateTarget.setUTCDate(prevDateTarget.getUTCDate() - 7)
    const prevFrom = new Date(prevDateTarget)
    prevFrom.setUTCDate(prevFrom.getUTCDate() - 3)

    const { data: prevStats } = await admin
      .from("kpop_stats_daily")
      .select("artist_id, lastfm_listeners, date")
      .lte("date", prevDateTarget.toISOString().slice(0, 10))
      .gte("date", prevFrom.toISOString().slice(0, 10))
      .not("lastfm_listeners", "is", null)
      .order("date", { ascending: false })

    // 아티스트당 가장 최신 prev row
    const prevMap = new Map<string, number>()
    for (const r of (prevStats ?? []) as { artist_id: string; lastfm_listeners: number }[]) {
      if (!prevMap.has(r.artist_id)) prevMap.set(r.artist_id, r.lastfm_listeners)
    }

    trendingArtists = ((latestStats ?? []) as unknown as StatRow[])
      .map((r) => {
        const artistName =
          r.kpop_artists && !Array.isArray(r.kpop_artists)
            ? r.kpop_artists.name
            : Array.isArray(r.kpop_artists) && r.kpop_artists.length > 0
            ? (r.kpop_artists as { name: string }[])[0].name
            : null
        if (!artistName || !r.lastfm_listeners) return null
        const prev = prevMap.get(r.artist_id) ?? null
        return {
          artistId: r.artist_id,
          name: artistName,
          listeners: r.lastfm_listeners,
          prev,
          growth: prev ? r.lastfm_listeners - prev : 0,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.growth - a.growth)
  }

  // Top 3 (급상승) — 인사이트 생성 대상
  const top3 = trendingArtists.slice(0, 3)
  // Top 10 — 리포트 생성 대상
  const top10 = trendingArtists.slice(0, 10)

  // ── Step 2: 아티스트 인사이트 생성 (report 미존재 시만) ──────
  let insightsGenerated = 0
  if (!reportDone) for (const artist of top3) {
    try {
      const insight = await generateArtistInsight(artist.name, artist.listeners, artist.prev)
      if (!insight) continue

      const { error } = await admin.from("kpop_weekly_insights").upsert(
        {
          week_start: weekStart,
          artist_id: artist.artistId,
          insight_text: insight,
        },
        { onConflict: "week_start,artist_id" }
      )
      if (error) {
        errors.push(`insight upsert ${artist.name}: ${error.message}`)
      } else {
        insightsGenerated++
      }
    } catch (err) {
      errors.push(`insight generate ${artist.name}: ${String(err)}`)
    }
  }

  // ── Step 3: 주간 리포트 생성 (report 미존재 시만) ───────────
  let reportGenerated = false
  if (!reportDone && top10.length > 0) {
    try {
      const reportText = await generateWeeklyKpopReport(
        top10.map((a) => ({ name: a.name, listeners: a.listeners, weeklyGrowth: a.growth }))
      )
      if (reportText) {
        const { error } = await admin.from("kpop_weekly_report").upsert(
          { week_start: weekStart, report_text: reportText },
          { onConflict: "week_start" }
        )
        if (error) {
          errors.push(`report upsert: ${error.message}`)
        } else {
          reportGenerated = true
        }
      }
    } catch (err) {
      errors.push(`report generate: ${String(err)}`)
    }
  }

  // 국가별 차트 수집은 daily ingest(lib/ingest/kpop-stats.ts)로 이관.
  // weekly는 insights + report 생성만 담당.

  return {
    source: "kpop-weekly",
    weekStart,
    skipped: false,
    insightsGenerated,
    reportGenerated,
    countryChartsCollected: 0,
    errors,
  }
}
