import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const revalidate = 3600

// GET /api/kpop/chart-attack/lastfm-chart
// kpop_stats_daily 의 lastfm_listeners 기반 K-pop 주간 글로벌 차트 (Top 20)
// 정렬: 최신 lastfm_listeners DESC
// 순위 변동: 7일 전 listeners 기준 이전 순위와 비교
// 별도 API 호출 없이 기존 수집 데이터 100% 재활용

export interface LastfmChartItem {
  rank: number
  artist_id: string
  name: string
  name_ko: string | null
  thumbnail_url: string | null
  lastfm_listeners: number | null
  lastfm_playcount: number | null
  listener_change: number | null    // 7일 전 대비 청취자 변동 (절대값)
  listener_change_pct: number | null  // 7일 전 대비 청취자 변동 (%)
  rank_change: number | null          // 7일 전 순위 대비 변동 (양수=상승, 음수=하락, null=신규)
  data_date: string
}

interface StatsRow {
  artist_id: string
  date: string
  lastfm_listeners: number | null
  lastfm_playcount: number | null
}

interface ArtistRow {
  id: string
  name: string
  name_ko: string | null
  thumbnail_url: string | null
}

export async function GET() {
  const supabase = createSupabaseAdminClient()

  // 1. 활성 아티스트 목록
  const { data: artistsData, error: artistsErr } = await supabase
    .from("kpop_artists")
    .select("id, name, name_ko, thumbnail_url")
    .eq("is_active", true)

  if (artistsErr) {
    return NextResponse.json({ items: [] }, { status: 500 })
  }

  const artists = (artistsData ?? []) as ArtistRow[]
  if (artists.length === 0) return NextResponse.json({ items: [] })

  const artistIds = artists.map(a => a.id)
  const artistMap = new Map(artists.map(a => [a.id, a]))

  // 2. 최근 30일 stats — artist_id별 최신 / 7일 전 행 분리
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30)

  const { data: statsData } = await supabase
    .from("kpop_stats_daily")
    .select("artist_id, date, lastfm_listeners, lastfm_playcount")
    .in("artist_id", artistIds)
    .gte("date", thirtyDaysAgo.toISOString().slice(0, 10))
    .order("date", { ascending: false })

  const allStats = (statsData ?? []) as StatsRow[]

  // artist_id → 최신 row, 7일(±1) 전 row
  const latestMap = new Map<string, StatsRow>()
  const olderMap = new Map<string, StatsRow>()

  for (const s of allStats) {
    if (!latestMap.has(s.artist_id)) {
      latestMap.set(s.artist_id, s)
    } else if (!olderMap.has(s.artist_id)) {
      const latestDate = latestMap.get(s.artist_id)!.date
      const dayDiff = (new Date(latestDate).getTime() - new Date(s.date).getTime()) / 86400000
      if (dayDiff >= 6) {
        olderMap.set(s.artist_id, s)
      }
    }
  }

  // 3. 현재 순위 — lastfm_listeners DESC
  const ranked = artists
    .map(a => {
      const latest = latestMap.get(a.id)
      return { artist: a, latest: latest ?? null, listeners: latest?.lastfm_listeners ?? null }
    })
    .filter(r => r.listeners !== null)  // listeners 없는 아티스트 제외
    .sort((a, b) => (b.listeners ?? 0) - (a.listeners ?? 0))

  // 4. 7일 전 순위 — olderMap listeners 기준
  const previousRanked = artists
    .map(a => ({ artistId: a.id, listeners: olderMap.get(a.id)?.lastfm_listeners ?? null }))
    .filter(r => r.listeners !== null)
    .sort((a, b) => (b.listeners ?? 0) - (a.listeners ?? 0))

  const prevRankMap = new Map<string, number>()
  previousRanked.forEach((r, i) => prevRankMap.set(r.artistId, i + 1))

  // 5. 결과 구성 (Top 20)
  const items: LastfmChartItem[] = ranked.slice(0, 20).map((r, i) => {
    const currentRank = i + 1
    const prevRank = prevRankMap.get(r.artist.id)
    const rankChange = prevRank !== undefined && olderMap.has(r.artist.id)
      ? prevRank - currentRank
      : null

    const older = olderMap.get(r.artist.id)
    const listenerChange = older?.lastfm_listeners !== null && older?.lastfm_listeners !== undefined && r.listeners !== null
      ? r.listeners - older.lastfm_listeners
      : null
    const listenerChangePct = listenerChange !== null && older?.lastfm_listeners
      ? Math.round((listenerChange / older.lastfm_listeners) * 1000) / 10
      : null

    return {
      rank: currentRank,
      artist_id: r.artist.id,
      name: r.artist.name,
      name_ko: r.artist.name_ko,
      thumbnail_url: r.artist.thumbnail_url,
      lastfm_listeners: r.listeners,
      lastfm_playcount: r.latest?.lastfm_playcount ?? null,
      listener_change: listenerChange,
      listener_change_pct: listenerChangePct,
      rank_change: rankChange,
      data_date: r.latest?.date ?? "",
    }
  })

  return NextResponse.json({ items, generated_at: new Date().toISOString() })
}
