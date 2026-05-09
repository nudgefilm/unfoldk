import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { KpopArtistsManager } from "@/components/admin/kpop-artists-manager"
import { AdminErrorBanner } from "@/components/admin/admin-error-banner"
import { formatPostgrestError } from "@/lib/admin/format-error"

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

type LoadResult =
  | { ok: true; artists: AdminKpopArtistRow[] }
  | { ok: false; error: string }

async function loadArtists(): Promise<LoadResult> {
  const supabase = createSupabaseAdminClient()

  const { data: artists, error } = await supabase
    .from("kpop_artists")
    .select("id, name, name_ko, debut_year, youtube_channel_id, lastfm_name, thumbnail_url, is_active, created_at")
    .order("name", { ascending: true })
    .limit(500)

  if (error) {
    // 빈 배열 fallback 금지 — 권한/네트워크 오류를 화면에 가시화 (2026-05-09 인시던트 회고)
    console.error("[admin/kpop] 조회 실패:", error)
    return { ok: false, error: formatPostgrestError(error) }
  }

  // 최신 stats join — 부가 정보라 실패해도 메인 카탈로그는 노출
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
    const { data: statsData, error: statsError } = await supabase
      .from("kpop_stats_daily")
      .select("artist_id, date, youtube_subscribers, youtube_total_views, lastfm_listeners")
      .in("artist_id", ids)
      .order("date", { ascending: false })
    if (statsError) {
      console.error("[admin/kpop] stats lookup 실패 (수치 미표시):", statsError)
    } else {
      for (const row of (statsData ?? []) as StatsRow[]) {
        if (!latestMap.has(row.artist_id)) latestMap.set(row.artist_id, row)
      }
    }
  }

  const merged = (artists ?? []).map((a) => {
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

  return { ok: true, artists: merged }
}

export default async function AdminKpopPage() {
  const result = await loadArtists()
  const totalCount = result.ok ? result.artists.length : 0
  const activeCount = result.ok ? result.artists.filter((a) => a.is_active).length : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold mb-1">KpopStats</h1>
        <p className="text-muted-foreground text-sm">
          {result.ok
            ? `총 ${totalCount.toLocaleString()}명 · 활성 ${activeCount.toLocaleString()}명`
            : "조회 실패"}
        </p>
      </div>

      {!result.ok && (
        <AdminErrorBanner
          title="아티스트 조회 실패"
          detail={result.error}
          logPrefix="[admin/kpop]"
        />
      )}

      {result.ok && <KpopArtistsManager artists={result.artists} />}
    </div>
  )
}
