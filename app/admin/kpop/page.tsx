import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { KpopArtistsManager } from "@/components/admin/kpop-artists-manager"

export const dynamic = "force-dynamic"

export interface AdminKpopArtistRow {
  id: string
  name: string
  name_ko: string | null
  debut_year: number | null
  youtube_channel_id: string | null
  lastfm_name: string | null
  thumbnail_url: string | null
  is_active: boolean
  created_at: string
  // join 된 최신 stats — 빈 row 도 있을 수 있음
  latest_subscribers: number | null
  latest_total_views: number | null
  latest_lastfm_listeners: number | null
  latest_date: string | null
}

async function loadArtists(): Promise<AdminKpopArtistRow[]> {
  const supabase = createSupabaseAdminClient()

  const { data: artists, error } = await supabase
    .from("kpop_artists")
    .select("id, name, name_ko, debut_year, youtube_channel_id, lastfm_name, thumbnail_url, is_active, created_at")
    .order("name", { ascending: true })
    .limit(500)

  if (error) {
    console.error("[admin/kpop] 조회 실패:", error.message)
    return []
  }

  // 최신 stats join
  type StatsRow = {
    artist_id: string
    date: string
    youtube_subscribers: number | null
    youtube_total_views: number | null
    lastfm_listeners: number | null
  }
  const ids = (artists ?? []).map((a) => (a as { id: string }).id)
  const latestMap = new Map<string, StatsRow>()
  if (ids.length > 0) {
    const { data: statsData } = await supabase
      .from("kpop_stats_daily")
      .select("artist_id, date, youtube_subscribers, youtube_total_views, lastfm_listeners")
      .in("artist_id", ids)
      .order("date", { ascending: false })
    for (const row of (statsData ?? []) as StatsRow[]) {
      if (!latestMap.has(row.artist_id)) latestMap.set(row.artist_id, row)
    }
  }

  return (artists ?? []).map((a) => {
    const r = a as Omit<AdminKpopArtistRow, "latest_subscribers" | "latest_total_views" | "latest_lastfm_listeners" | "latest_date">
    const latest = latestMap.get(r.id)
    return {
      ...r,
      latest_subscribers: latest?.youtube_subscribers ?? null,
      latest_total_views: latest?.youtube_total_views ?? null,
      latest_lastfm_listeners: latest?.lastfm_listeners ?? null,
      latest_date: latest?.date ?? null,
    }
  })
}

export default async function AdminKpopPage() {
  const artists = await loadArtists()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold mb-1">KpopStats</h1>
        <p className="text-muted-foreground text-sm">
          총 {artists.length.toLocaleString()}명 · 활성 {artists.filter((a) => a.is_active).length.toLocaleString()}명
        </p>
      </div>

      <KpopArtistsManager artists={artists} />
    </div>
  )
}
