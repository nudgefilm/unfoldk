import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// GET /api/kpop/comparison-data?a={artist_a_id}&b={artist_b_id}
// 두 아티스트 비교 데이터: 충성도 지수, 30일 히스토리, 프로필 정보

export const dynamic = "force-dynamic"

export interface ArtistCompareStats {
  id: string
  name: string
  thumbnail_url: string | null
  listeners: number | null
  plays: number | null
  loyalty: number | null       // plays / listeners
  growth30d: number | null     // % change
  history: Array<{ date: string; listeners: number | null }>
  debut_year: number | null    // mb_debut_date 에서 연도 추출
  mb_member_count: number | null  // mb_members 배열 길이 (없으면 member_count fallback)
  lastfm_tags: string[] | null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const aId = url.searchParams.get("a")
  const bId = url.searchParams.get("b")

  if (!aId || !bId || aId === bId) {
    return NextResponse.json({ error: "a and b must be different valid UUIDs" }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()

  // 1. 아티스트 기본 정보 + 프로필 컬럼
  const { data: artists } = await admin
    .from("kpop_artists")
    .select("id, name, thumbnail_url, mb_debut_date, mb_members, lastfm_tags, member_count")
    .in("id", [aId, bId])

  if (!artists || artists.length < 2) {
    return NextResponse.json({ error: "Artist not found" }, { status: 404 })
  }

  type ArtistRow = {
    id: string
    name: string
    thumbnail_url: string | null
    mb_debut_date: string | null
    mb_members: Array<{ name: string; role?: string; active?: boolean }> | null
    lastfm_tags: string[] | null
    member_count: number | null
  }
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

  // 5. 최종 응답 조립
  function buildArtist(id: string): ArtistCompareStats {
    const info = artistMap.get(id)!
    const stat = latestStats.find((s) => s.artist_id === id)
    const hist = histMap[id] ?? []
    const listeners = stat?.lastfm_listeners ?? null
    const plays = stat?.lastfm_playcount ?? null
    const loyalty = listeners && plays && listeners > 0
      ? parseFloat((plays / listeners).toFixed(1))
      : null

    // mb_debut_date → 연도
    const debut_year = info.mb_debut_date
      ? new Date(info.mb_debut_date).getUTCFullYear()
      : null

    // mb_members 배열 길이, 없으면 member_count fallback
    const mb_member_count = Array.isArray(info.mb_members)
      ? info.mb_members.length
      : (info.member_count ?? null)

    return {
      id,
      name: info.name,
      thumbnail_url: info.thumbnail_url,
      listeners,
      plays,
      loyalty,
      growth30d: calcGrowth(hist),
      history: hist,
      debut_year,
      mb_member_count,
      lastfm_tags: info.lastfm_tags ?? null,
    }
  }

  return NextResponse.json({
    artistA: buildArtist(aId),
    artistB: buildArtist(bId),
  })
}
