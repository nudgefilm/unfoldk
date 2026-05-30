import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// GET /api/kpop/comparison-data?a={artist_a_id}&b={artist_b_id}
// 두 아티스트 비교 데이터: 충성도 지수, 30일 히스토리, 국가별 분포

export const dynamic = "force-dynamic"

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", GB: "United Kingdom", PH: "Philippines",
  TH: "Thailand", ID: "Indonesia", BR: "Brazil",
  FR: "France", DE: "Germany", AU: "Australia", CA: "Canada",
}

export interface ArtistCompareStats {
  id: string
  name: string
  thumbnail_url: string | null
  listeners: number | null
  plays: number | null
  loyalty: number | null       // plays / listeners
  growth30d: number | null     // % change
  history: Array<{ date: string; listeners: number | null }>
}

export interface CountryCompareRow {
  country_code: string
  country_name: string
  a_listeners: number | null
  b_listeners: number | null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const aId = url.searchParams.get("a")
  const bId = url.searchParams.get("b")

  if (!aId || !bId || aId === bId) {
    return NextResponse.json({ error: "a and b must be different valid UUIDs" }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()

  // 1. 아티스트 기본 정보
  const { data: artists } = await admin
    .from("kpop_artists")
    .select("id, name, thumbnail_url")
    .in("id", [aId, bId])

  if (!artists || artists.length < 2) {
    return NextResponse.json({ error: "Artist not found" }, { status: 404 })
  }

  type ArtistRow = { id: string; name: string; thumbnail_url: string | null }
  const artistMap = new Map((artists as ArtistRow[]).map((a) => [a.id, a]))

  // 2. 최신 stats (listeners, plays)
  const { data: latestDateRow } = await admin
    .from("kpop_stats_daily")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle()

  const latestDate = latestDateRow?.date as string | null

  type StatRow = { artist_id: string; lastfm_listeners: number | null; lastfm_playcount: number | null }
  let latestStats: StatRow[] = []
  if (latestDate) {
    const { data } = await admin
      .from("kpop_stats_daily")
      .select("artist_id, lastfm_listeners, lastfm_playcount")
      .in("artist_id", [aId, bId])
      .eq("date", latestDate)
    latestStats = (data ?? []) as StatRow[]
  }

  // 3. 30일 히스토리 (listeners)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30)

  type HistRow = { artist_id: string; date: string; lastfm_listeners: number | null }
  const { data: histData } = await admin
    .from("kpop_stats_daily")
    .select("artist_id, date, lastfm_listeners")
    .in("artist_id", [aId, bId])
    .gte("date", thirtyDaysAgo.toISOString().slice(0, 10))
    .order("date", { ascending: true })

  const histMap: Record<string, Array<{ date: string; listeners: number | null }>> = { [aId]: [], [bId]: [] }
  for (const row of (histData ?? []) as HistRow[]) {
    histMap[row.artist_id]?.push({ date: row.date, listeners: row.lastfm_listeners })
  }

  // 4. 성장률 계산
  function calcGrowth(hist: Array<{ listeners: number | null }>): number | null {
    const first = hist.find((h) => h.listeners != null)?.listeners
    const last = [...hist].reverse().find((h) => h.listeners != null)?.listeners
    if (!first || !last || first === 0) return null
    return parseFloat((((last - first) / first) * 100).toFixed(1))
  }

  // 5. 국가별 분포 (kpop_country_charts)
  const { data: ccLatest } = await admin
    .from("kpop_country_charts")
    .select("week_start")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle()

  type CCRow = { country_code: string; artist_id: string | null; listeners: number | null }
  let countries: CountryCompareRow[] = []
  if (ccLatest) {
    const { data: ccData } = await admin
      .from("kpop_country_charts")
      .select("country_code, artist_id, listeners")
      .in("artist_id", [aId, bId])
      .eq("week_start", ccLatest.week_start)

    const ccByCountry = new Map<string, { a: number | null; b: number | null }>()
    for (const row of (ccData ?? []) as CCRow[]) {
      if (!row.artist_id) continue
      if (!ccByCountry.has(row.country_code)) {
        ccByCountry.set(row.country_code, { a: null, b: null })
      }
      const entry = ccByCountry.get(row.country_code)!
      if (row.artist_id === aId) entry.a = row.listeners
      else if (row.artist_id === bId) entry.b = row.listeners
    }

    countries = Array.from(ccByCountry.entries())
      .map(([code, val]) => ({
        country_code: code,
        country_name: COUNTRY_NAMES[code] ?? code,
        a_listeners: val.a,
        b_listeners: val.b,
      }))
      .sort((x, y) => {
        const xMax = Math.max(x.a_listeners ?? 0, x.b_listeners ?? 0)
        const yMax = Math.max(y.a_listeners ?? 0, y.b_listeners ?? 0)
        return yMax - xMax
      })
      .slice(0, 5)
  }

  // 6. 최종 응답 조립
  function buildArtist(id: string): ArtistCompareStats {
    const info = artistMap.get(id)!
    const stat = latestStats.find((s) => s.artist_id === id)
    const hist = histMap[id] ?? []
    const listeners = stat?.lastfm_listeners ?? null
    const plays = stat?.lastfm_playcount ?? null
    const loyalty = listeners && plays && listeners > 0
      ? parseFloat((plays / listeners).toFixed(1))
      : null
    return {
      id,
      name: info.name,
      thumbnail_url: info.thumbnail_url,
      listeners,
      plays,
      loyalty,
      growth30d: calcGrowth(hist),
      history: hist,
    }
  }

  return NextResponse.json({
    artistA: buildArtist(aId),
    artistB: buildArtist(bId),
    countries,
  })
}
