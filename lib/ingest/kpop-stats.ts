// KpopStats 일별 통계 인제스트 로직
// cron(/api/cron/ingest-kpop-stats) + 어드민 수동 갱신 양쪽에서 import 해 재사용
//
// 흐름:
//   1. kpop_artists 활성 아티스트 조회 (선택: 단일 아티스트만 갱신)
//   2. YouTube 채널 통계 일괄 조회 (channels.list, 50명/call, 1 unit/call)
//   3. Last.fm artist.getinfo 병렬 조회 (rate limit ~ 5 req/s, 25명 정도면 안전)
//   4. 어제(8일전) total_views 와 비교해 weekly_views 계산
//   5. kpop_stats_daily upsert (artist_id, date 유니크)
//
// 비용:
//   - YouTube: 25명 → channels.list 1회 = 1 unit/일 (10,000 daily quota 의 0.01%)
//   - Last.fm: 25명 → 25 calls (병렬 5개 chunk)
//
// 멱등성:
//   - 같은 날짜로 재실행하면 동일 row 가 update 됨 (artist_id, date unique)

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { getChannelStats } from "@/lib/api/youtube"
import { getArtistInfo } from "@/lib/api/lastfm"

export interface KpopStatsIngestResult {
  source: "kpop-stats"
  artistsScanned: number
  youtubeFetched: number
  lastfmFetched: number
  upserted: number
  errors: string[]
  note?: string
}

interface KpopArtistRow {
  id: string
  name: string
  youtube_channel_id: string | null
  lastfm_name: string | null
}

// 단일 또는 다수 아티스트 통계 갱신
// artistIds 가 비어있으면 활성 아티스트 전체
export async function runKpopStatsIngest(
  artistIds?: string[]
): Promise<KpopStatsIngestResult> {
  const supabase = createSupabaseAdminClient()
  const errors: string[] = []

  // 1. 대상 아티스트 조회
  let query = supabase
    .from("kpop_artists")
    .select("id, name, youtube_channel_id, lastfm_name")
    .eq("is_active", true)

  if (artistIds && artistIds.length > 0) {
    query = query.in("id", artistIds)
  }

  const { data: artistsData, error: artistsErr } = await query
  if (artistsErr) {
    return {
      source: "kpop-stats",
      artistsScanned: 0,
      youtubeFetched: 0,
      lastfmFetched: 0,
      upserted: 0,
      errors: [`artists fetch 실패: ${artistsErr.message}`],
    }
  }

  const artists = (artistsData ?? []) as KpopArtistRow[]
  if (artists.length === 0) {
    return {
      source: "kpop-stats",
      artistsScanned: 0,
      youtubeFetched: 0,
      lastfmFetched: 0,
      upserted: 0,
      errors: [],
      note: "대상 아티스트 없음",
    }
  }

  // 2. YouTube 채널 통계 — channel_id 있는 아티스트만
  const ytChannelIds = artists
    .map((a) => a.youtube_channel_id)
    .filter((id): id is string => !!id && id.length > 0)

  let ytStatsMap = new Map<
    string,
    { subscribers: number | null; totalViews: number | null }
  >()
  let youtubeFetched = 0
  if (ytChannelIds.length > 0) {
    try {
      const ytStats = await getChannelStats(ytChannelIds)
      youtubeFetched = ytStats.length
      for (const s of ytStats) {
        ytStatsMap.set(s.channelId, {
          subscribers: s.subscribers,
          totalViews: s.totalViews,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[ingest-kpop-stats] YouTube 호출 실패:", msg)
      errors.push(`YouTube 호출 실패: ${msg}`)
    }
  }

  // 3. Last.fm 아티스트 info — chunk 5개씩 병렬 (rate limit 보호)
  const lastfmStatsMap = new Map<
    string,
    { listeners: number | null; playcount: number | null }
  >()
  const lastfmTargets = artists.filter((a) => a.lastfm_name && a.lastfm_name.length > 0)

  for (let i = 0; i < lastfmTargets.length; i += 5) {
    const chunk = lastfmTargets.slice(i, i + 5)
    const results = await Promise.all(
      chunk.map(async (a) => {
        try {
          const info = await getArtistInfo(a.lastfm_name as string)
          return { artist: a, info }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          errors.push(`Last.fm "${a.name}" 실패: ${msg}`)
          return { artist: a, info: null }
        }
      })
    )
    for (const r of results) {
      if (r.info) {
        lastfmStatsMap.set(r.artist.id, {
          listeners: r.info.listeners,
          playcount: r.info.playcount,
        })
      }
    }
  }
  const lastfmFetched = lastfmStatsMap.size

  // 4. 7일전 total_views 와 비교해 weekly_views 계산
  //    오늘 stats row 가 만들어지기 전이라 어제 row 의 weekly_views 는
  //    "지난 7일 누적"으로 의미상 충분.
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setUTCDate(today.getUTCDate() - 7)

  const { data: olderStatsData } = await supabase
    .from("kpop_stats_daily")
    .select("artist_id, youtube_total_views, date")
    .in("artist_id", artists.map((a) => a.id))
    .lte("date", sevenDaysAgo.toISOString().slice(0, 10))
    .order("date", { ascending: false })

  type OlderRow = { artist_id: string; youtube_total_views: number | null; date: string }
  const olderRows = (olderStatsData ?? []) as OlderRow[]

  // artist_id 별 가장 최근(7일전 이전) row 만 사용
  const olderTotalMap = new Map<string, number>()
  for (const r of olderRows) {
    if (!olderTotalMap.has(r.artist_id) && r.youtube_total_views !== null) {
      olderTotalMap.set(r.artist_id, Number(r.youtube_total_views))
    }
  }

  // 5. upsert 행 생성
  const todayStr = today.toISOString().slice(0, 10)
  const rows = artists.map((a) => {
    const yt = a.youtube_channel_id ? ytStatsMap.get(a.youtube_channel_id) : null
    const lfm = lastfmStatsMap.get(a.id)
    const todayTotal = yt?.totalViews ?? null
    const olderTotal = olderTotalMap.get(a.id) ?? null
    const weeklyViews =
      todayTotal !== null && olderTotal !== null
        ? Math.max(0, todayTotal - olderTotal)
        : null

    return {
      artist_id: a.id,
      date: todayStr,
      youtube_subscribers: yt?.subscribers ?? null,
      youtube_total_views: todayTotal,
      youtube_weekly_views: weeklyViews,
      lastfm_listeners: lfm?.listeners ?? null,
      lastfm_playcount: lfm?.playcount ?? null,
      lastfm_weekly_rank: null,                 // tag.gettopartists 연동은 추후
    }
  })

  const { data: upsertData, error: upsertErr } = await supabase
    .from("kpop_stats_daily")
    .upsert(rows, { onConflict: "artist_id,date", ignoreDuplicates: false })
    .select("id")

  if (upsertErr) {
    console.error("[ingest-kpop-stats] upsert 실패:", upsertErr.message)
    errors.push(`upsert 실패: ${upsertErr.message}`)
  }

  return {
    source: "kpop-stats",
    artistsScanned: artists.length,
    youtubeFetched,
    lastfmFetched,
    upserted: upsertData?.length ?? 0,
    errors,
  }
}
