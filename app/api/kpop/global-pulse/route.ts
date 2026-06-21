import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const revalidate = 3600

export async function GET() {
  const admin = createSupabaseAdminClient()

  // ── Rising This Week (7일 청취자 증가량 상위 5명) ─────────────────────────
  const { data: latestRow } = await admin
    .from("kpop_stats_daily")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle()

  type RisingArtist = { id: string; name_en: string; image_url: string | null; listeners_7d: number; listeners_change: number }

  let risingArtists: RisingArtist[] = []
  if (latestRow) {
    const latestDate = (latestRow as { date: string }).date
    const { data: current } = await admin
      .from("kpop_stats_daily")
      .select("artist_id, lastfm_listeners")
      .eq("date", latestDate)
      .not("lastfm_listeners", "is", null)
      .order("lastfm_listeners", { ascending: false })
      .limit(30)

    if (current && current.length > 0) {
      const currentRows = current as { artist_id: string; lastfm_listeners: number }[]
      const artistIds = currentRows.map(r => r.artist_id)

      const sevenDaysAgo = new Date(latestDate)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const pastDate = sevenDaysAgo.toISOString().split("T")[0]
      const pastDateMinus2 = new Date(sevenDaysAgo.getTime() - 2 * 86400_000).toISOString().split("T")[0]

      const [pastRes, artistsRes] = await Promise.all([
        admin
          .from("kpop_stats_daily")
          .select("artist_id, lastfm_listeners")
          .in("artist_id", artistIds)
          .lte("date", pastDate)
          .gte("date", pastDateMinus2)
          .not("lastfm_listeners", "is", null),
        admin
          .from("kpop_artists")
          .select("id, name, thumbnail_url")
          .in("id", artistIds),
      ])

      const pastMap = new Map<string, number>()
      for (const r of (pastRes.data ?? []) as { artist_id: string; lastfm_listeners: number }[]) {
        const prev = pastMap.get(r.artist_id)
        if (!prev || r.lastfm_listeners > prev) pastMap.set(r.artist_id, r.lastfm_listeners)
      }
      const artistMap = new Map(
        ((artistsRes.data ?? []) as { id: string; name: string; thumbnail_url: string | null }[]).map(a => [a.id, a])
      )

      risingArtists = currentRows
        .map(r => {
          const past = pastMap.get(r.artist_id) ?? r.lastfm_listeners
          const artist = artistMap.get(r.artist_id)
          return {
            id: r.artist_id,
            name_en: artist?.name ?? "—",
            image_url: artist?.thumbnail_url ?? null,
            listeners_7d: r.lastfm_listeners,
            listeners_change: r.lastfm_listeners - past,
          }
        })
        .filter(a => a.listeners_change > 0)
        .sort((a, b) => b.listeners_change - a.listeners_change)
        .slice(0, 5)
    }
  }

  // ── Country No.1 (국가별 1위 아티스트) ─────────────────────────────────────
  type CountryTopArtist = { country_code: string; artist_name: string; listeners: number }
  let countryTopArtists: CountryTopArtist[] = []

  const { data: latestWeekRow } = await admin
    .from("kpop_country_charts")
    .select("week_start")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestWeekRow) {
    const latestWeek = (latestWeekRow as { week_start: string }).week_start
    const { data: countryData } = await admin
      .from("kpop_country_charts")
      .select("country_code, artist_name, listeners")
      .eq("week_start", latestWeek)
      .eq("rank", 1)
      .not("artist_name", "is", null)
      .order("listeners", { ascending: false })
      .limit(20)

    if (countryData) {
      const seen = new Set<string>()
      countryTopArtists = (countryData as CountryTopArtist[])
        .filter(r => r.artist_name)
        .filter(r => {
          const key = r.artist_name.toLowerCase()
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .slice(0, 10)
    }
  }

  // ── Top K-Dramas (인기도 기준 상위 5편) ────────────────────────────────────
  const { data: dramaData } = await admin
    .from("dramas")
    .select("id, title, poster_url, year, popularity")
    .eq("is_active", true)
    .not("popularity", "is", null)
    .order("popularity", { ascending: false })
    .limit(5)

  return NextResponse.json({
    risingArtists,
    countryTopArtists,
    topDramas: dramaData ?? [],
  })
}
