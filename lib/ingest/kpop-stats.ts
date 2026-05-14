// KpopStats 일별 통계 인제스트 로직
// cron(/api/cron/ingest-kpop-stats) + 어드민 수동 갱신 양쪽에서 import 해 재사용
//
// 흐름:
//   1.  kpop_artists 활성 아티스트 조회 (선택: 단일 아티스트만 갱신)
//   1.5. youtube_channel_id NULL 인 아티스트는 search.list 로 자동 매핑
//        (이름 검색 1위 채널, 매칭 없으면 NULL 유지 — 오매핑 방지)
//   2.  YouTube 채널 통계 일괄 조회 (channels.list, 50명/call, 1 unit/call)
//   3.  Last.fm artist.getinfo 병렬 조회 (rate limit ~ 5 req/s, 25명 정도면 안전)
//   4.  어제(8일전) total_views 와 비교해 weekly_views 계산
//   5.  kpop_stats_daily upsert (artist_id, date 유니크)
//
// 비용:
//   - YouTube channels.list: 25명 → 1회 = 1 unit/일 (10,000 daily quota 의 0.01%)
//   - YouTube search.list   : channel_id NULL 인 아티스트 1명당 100 units (1회만)
//                             첫 cron 25명 NULL = 2,500 units. 매핑 후엔 0.
//   - Last.fm: 25명 → 25 calls (병렬 5개 chunk)
//
// 멱등성:
//   - 같은 날짜로 재실행하면 동일 row 가 update 됨 (artist_id, date unique)
//   - channel_id 자동 매핑은 NULL 인 행만 시도 (이미 채워졌으면 skip)

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { getChannelStats, searchChannelByName } from "@/lib/api/youtube"
import { getArtistInfo } from "@/lib/api/lastfm"

export interface KpopStatsIngestResult {
  source: "kpop-stats"
  artistsScanned: number
  channelsAutoMapped: number       // 이번 실행에서 search.list 로 새로 매핑된 채널 수
  youtubeFetched: number
  lastfmFetched: number
  // Thumbnail backfill 진단 — kpop_artists.thumbnail_url 갱신 추적
  ytThumbnailsAvailable: number    // getChannelStats 응답에 thumbnail 있던 채널 수
  thumbnailsAlreadySet: number     // 이미 채워져 있어 skip
  thumbnailsBackfilled: number     // 이번 실행에서 새로 채운 수
  // 추가 진단 — "왜 특정 아티스트 (BTS 등) 가 안 채워지는지" 추적용
  channelsRequested: number        // getChannelStats 에 보낸 채널 ID 수
  channelsReturned: number         // YouTube 가 반환한 채널 수
  missingChannelIds: string[]      // 요청했는데 응답에 없는 ID (=잘못된 ID 또는 비공개 채널)
  thumbnailDebug: Array<{
    artist: string
    channelId: string | null
    ytFound: boolean              // ytStatsMap.has(channelId)
    ytThumb: string | null
    action:
      | "skipped_already_set"
      | "skipped_no_channel_id"
      | "skipped_channel_missing"
      | "skipped_no_yt_thumb"
      | "updated"
      | "update_zero_rows"
      | "update_error"
  }>
  upserted: number
  errors: string[]
  note?: string
}

interface KpopArtistRow {
  id: string
  name: string
  youtube_channel_id: string | null
  lastfm_name: string | null
  thumbnail_url: string | null
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
    .select("id, name, youtube_channel_id, lastfm_name, thumbnail_url")
    .eq("is_active", true)

  if (artistIds && artistIds.length > 0) {
    query = query.in("id", artistIds)
  }

  const { data: artistsData, error: artistsErr } = await query
  if (artistsErr) {
    return {
      source: "kpop-stats",
      artistsScanned: 0,
      channelsAutoMapped: 0,
      youtubeFetched: 0,
      lastfmFetched: 0,
      ytThumbnailsAvailable: 0,
      thumbnailsAlreadySet: 0,
      thumbnailsBackfilled: 0,
      channelsRequested: 0,
      channelsReturned: 0,
      missingChannelIds: [],
      thumbnailDebug: [],
      upserted: 0,
      errors: [`artists fetch 실패: ${artistsErr.message}`],
    }
  }

  const artists = (artistsData ?? []) as KpopArtistRow[]
  if (artists.length === 0) {
    return {
      source: "kpop-stats",
      artistsScanned: 0,
      channelsAutoMapped: 0,
      youtubeFetched: 0,
      lastfmFetched: 0,
      ytThumbnailsAvailable: 0,
      thumbnailsAlreadySet: 0,
      thumbnailsBackfilled: 0,
      channelsRequested: 0,
      channelsReturned: 0,
      missingChannelIds: [],
      thumbnailDebug: [],
      upserted: 0,
      errors: [],
      note: "대상 아티스트 없음",
    }
  }

  // 1.5. youtube_channel_id NULL 인 아티스트는 이름으로 검색해 자동 매핑
  //      - 이름 검색 1위 채널을 channel_id 로 박음 (search.list 100 units/call)
  //      - 검색 결과 0건이면 NULL 유지 (오매핑 방지)
  //      - 한 번 매핑되면 다음 cron 부터는 skip → 비용 0
  let channelsAutoMapped = 0
  const unmappedArtists = artists.filter((a) => !a.youtube_channel_id)
  if (unmappedArtists.length > 0) {
    console.log(
      `[ingest-kpop-stats] channel_id 자동 매핑 시도: ${unmappedArtists.length}명 ` +
        `(예상 쿼터 ${unmappedArtists.length * 100} units)`
    )
    // 5개씩 병렬 — YouTube API rate 보호 (Last.fm 청크 패턴 동일)
    for (let i = 0; i < unmappedArtists.length; i += 5) {
      const chunk = unmappedArtists.slice(i, i + 5)
      const results = await Promise.all(
        chunk.map(async (a) => {
          const channelId = await searchChannelByName(a.name)
          return { artist: a, channelId }
        })
      )
      // 매핑 성공한 것만 DB update + 메모리 객체도 갱신해 후속 단계가 사용 가능
      for (const r of results) {
        if (!r.channelId) continue
        const { error: updErr } = await supabase
          .from("kpop_artists")
          .update({ youtube_channel_id: r.channelId })
          .eq("id", r.artist.id)
        if (updErr) {
          errors.push(
            `channel_id 매핑 update 실패 (${r.artist.name}): ${updErr.message}`
          )
        } else {
          r.artist.youtube_channel_id = r.channelId          // 후속 단계 즉시 활용
          channelsAutoMapped++
        }
      }
    }
    console.log(
      `[ingest-kpop-stats] 자동 매핑 완료: ${channelsAutoMapped}/${unmappedArtists.length}명`
    )
  }

  // 2. YouTube 채널 통계 — channel_id 있는 아티스트만 (1.5 단계에서 갱신된 ID 포함)
  const ytChannelIds = artists
    .map((a) => a.youtube_channel_id)
    .filter((id): id is string => !!id && id.length > 0)

  let ytStatsMap = new Map<
    string,
    { subscribers: number | null; totalViews: number | null; thumbnailUrl: string | null }
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
          thumbnailUrl: s.thumbnailUrl,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[ingest-kpop-stats] YouTube 호출 실패:", msg)
      errors.push(`YouTube 호출 실패: ${msg}`)
    }
  }

  // 2.5. kpop_artists.thumbnail_url backfill — 비어 있는 행에 YouTube 채널 썸네일 채움.
  //      이미 채워진 행은 건드리지 않음 (어드민이 수동 입력한 이미지 보존).
  //      URL 만 저장, 이미지 자체는 저장 금지 (CLAUDE.md §10 저작권).
  //      빈 문자열·공백은 "비어 있음" 으로 취급 (어드민 폼이 "" 저장 가능).
  let ytThumbnailsAvailable = 0
  let thumbnailsAlreadySet = 0
  let thumbnailsBackfilled = 0
  for (const yt of ytStatsMap.values()) {
    if (yt.thumbnailUrl) ytThumbnailsAvailable++
  }

  // channels.list 응답에 없는 채널 ID 진단 — 잘못된 ID 인지 즉시 판정.
  // YouTube 는 존재 안 하는 channel ID 에 대해 그냥 빈 응답 (404 X) → 우리가 직접 검출.
  const channelsRequested = ytChannelIds.length
  const channelsReturned = ytStatsMap.size
  const missingChannelIds = ytChannelIds.filter((id) => !ytStatsMap.has(id))
  if (missingChannelIds.length > 0) {
    console.warn(
      `[ingest-kpop-stats] channels.list 응답 누락 ${missingChannelIds.length}건 — ` +
        `존재하지 않거나 비공개 채널: ${missingChannelIds.join(", ")}`
    )
  }

  console.log(
    `[ingest-kpop-stats] thumbnail backfill 시작 — ${artists.length}명 중 ` +
      `${ytThumbnailsAvailable}개 채널이 YouTube thumbnail 보유`
  )

  const thumbnailDebug: KpopStatsIngestResult["thumbnailDebug"] = []
  for (const a of artists) {
    if (a.thumbnail_url && a.thumbnail_url.trim().length > 0) {
      thumbnailsAlreadySet++
      thumbnailDebug.push({
        artist: a.name,
        channelId: a.youtube_channel_id,
        ytFound: a.youtube_channel_id ? ytStatsMap.has(a.youtube_channel_id) : false,
        ytThumb: a.youtube_channel_id ? ytStatsMap.get(a.youtube_channel_id)?.thumbnailUrl ?? null : null,
        action: "skipped_already_set",
      })
      continue
    }
    if (!a.youtube_channel_id) {
      thumbnailDebug.push({
        artist: a.name,
        channelId: null,
        ytFound: false,
        ytThumb: null,
        action: "skipped_no_channel_id",
      })
      continue
    }
    const yt = ytStatsMap.get(a.youtube_channel_id)
    if (!yt) {
      // 채널 ID 가 응답에 없음 — 가장 흔한 BTS 류 실패. 잘못된 channel_id.
      console.warn(
        `[ingest-kpop-stats] thumbnail skip (${a.name}): channelId=${a.youtube_channel_id} ` +
          `→ channels.list 응답에 없음 (ID 가 잘못됐을 가능성)`
      )
      thumbnailDebug.push({
        artist: a.name,
        channelId: a.youtube_channel_id,
        ytFound: false,
        ytThumb: null,
        action: "skipped_channel_missing",
      })
      continue
    }
    if (!yt.thumbnailUrl) {
      console.warn(
        `[ingest-kpop-stats] thumbnail skip (${a.name}): channelId=${a.youtube_channel_id} ` +
          `→ 응답에는 있으나 thumbnail 추출 실패`
      )
      thumbnailDebug.push({
        artist: a.name,
        channelId: a.youtube_channel_id,
        ytFound: true,
        ytThumb: null,
        action: "skipped_no_yt_thumb",
      })
      continue
    }
    // .select("id") 로 0행 update 도 감지 (RLS·id mismatch silent fail 방지)
    const { data: updData, error: thumbErr } = await supabase
      .from("kpop_artists")
      .update({ thumbnail_url: yt.thumbnailUrl })
      .eq("id", a.id)
      .select("id")
    if (thumbErr) {
      errors.push(`thumbnail backfill 실패 (${a.name}): ${thumbErr.message}`)
      thumbnailDebug.push({
        artist: a.name,
        channelId: a.youtube_channel_id,
        ytFound: true,
        ytThumb: yt.thumbnailUrl,
        action: "update_error",
      })
    } else if (!updData || updData.length === 0) {
      errors.push(`thumbnail backfill 0행 (${a.name}): RLS 또는 id 매칭 실패`)
      thumbnailDebug.push({
        artist: a.name,
        channelId: a.youtube_channel_id,
        ytFound: true,
        ytThumb: yt.thumbnailUrl,
        action: "update_zero_rows",
      })
    } else {
      a.thumbnail_url = yt.thumbnailUrl
      thumbnailsBackfilled++
      thumbnailDebug.push({
        artist: a.name,
        channelId: a.youtube_channel_id,
        ytFound: true,
        ytThumb: yt.thumbnailUrl,
        action: "updated",
      })
    }
  }
  console.log(
    `[ingest-kpop-stats] thumbnail backfill 결과 — ` +
      `backfilled=${thumbnailsBackfilled}, alreadySet=${thumbnailsAlreadySet}, ` +
      `ytAvailable=${ytThumbnailsAvailable}, missingChannels=${missingChannelIds.length}`
  )

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
    channelsAutoMapped,
    youtubeFetched,
    lastfmFetched,
    ytThumbnailsAvailable,
    thumbnailsAlreadySet,
    thumbnailsBackfilled,
    upserted: upsertData?.length ?? 0,
    errors,
  }
}
