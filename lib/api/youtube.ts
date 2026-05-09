// YouTube Data API v3 래퍼 (googleapis SDK)
// ⚠️ tubewatch.kr 와 별도 GCP 프로젝트 사용 필수 (CLAUDE.md §8, §13)
// 쿼터: 10,000 units/day.
//   - search.list  : 100 units (channel/video 검색)
//   - videos.list  :   1 unit
//   - channels.list:   1 unit (50개/call, KpopStats 인제스트 — 25명 = 1 unit, 매우 저렴)
//
// channel_id 자동 매핑(searchChannelByName) 은 첫 cron 1회만 100 unit/명 사용
// — 매핑 후 채널 ID 가 DB 에 박혀서 다음 cron 부터는 channels.list 만 호출.

import { google, youtube_v3 } from "googleapis"

function getYoutubeClient(): youtube_v3.Youtube {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) throw new Error("YOUTUBE_API_KEY 미설정")
  return google.youtube({ version: "v3", auth: apiKey })
}

// ============================================
// 채널 통계 — KpopStats 인제스트용
// ============================================

export interface YoutubeChannelStats {
  channelId: string
  title: string | null
  subscribers: number | null         // hiddenSubscriberCount=true 면 null
  totalViews: number | null
  videoCount: number | null
}

// 다중 채널 통계 일괄 조회 — channel ID 50개까지 한 번에 (1 unit/call)
export async function getChannelStats(
  channelIds: string[]
): Promise<YoutubeChannelStats[]> {
  if (channelIds.length === 0) return []

  const youtube = getYoutubeClient()

  // YouTube API 가 한 번에 50개까지 받음 — 그 이상이면 chunk 나눠 호출
  const chunks: string[][] = []
  for (let i = 0; i < channelIds.length; i += 50) {
    chunks.push(channelIds.slice(i, i + 50))
  }

  const results: YoutubeChannelStats[] = []
  for (const chunk of chunks) {
    const res = await youtube.channels.list({
      part: ["snippet", "statistics"],
      id: chunk,
      maxResults: 50,
    })
    const items = res.data.items ?? []
    for (const ch of items) {
      if (!ch.id) continue
      const stats = ch.statistics
      results.push({
        channelId: ch.id,
        title: ch.snippet?.title ?? null,
        subscribers:
          stats?.hiddenSubscriberCount || !stats?.subscriberCount
            ? null
            : Number(stats.subscriberCount),
        totalViews: stats?.viewCount ? Number(stats.viewCount) : null,
        videoCount: stats?.videoCount ? Number(stats.videoCount) : null,
      })
    }
  }

  return results
}

// ============================================
// 채널 ID 자동 매핑 — KpopStats 시드의 youtube_channel_id NULL 자동 채움용
// ============================================

// 아티스트 이름으로 1위 채널 검색 → channelId 반환 (없으면 null)
//   - search.list type=channel: 100 units / call
//   - 검색 결과 0건이면 null (오매핑 방지)
//   - 호출 측에서 멱등 보장 (이미 channel_id 있으면 호출 skip)
export async function searchChannelByName(query: string): Promise<string | null> {
  const youtube = getYoutubeClient()
  try {
    const res = await youtube.search.list({
      part: ["snippet"],
      q: query,
      type: ["channel"],
      maxResults: 1,
    })
    const item = res.data.items?.[0]
    // search.list type=channel 응답에서 channelId 는 id.channelId 또는 snippet.channelId
    const channelId = item?.id?.channelId ?? item?.snippet?.channelId ?? null
    if (channelId) {
      console.log(`[youtube] searchChannelByName q="${query}" → ${channelId}`)
    } else {
      console.log(`[youtube] searchChannelByName q="${query}" → 매칭 없음`)
    }
    return channelId
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[youtube] searchChannelByName 실패 q="${query}":`, msg)
    return null
  }
}

export interface YoutubeUpcomingEvent {
  videoId: string
  title: string
  channelTitle: string
  scheduledStartTime: string // ISO 8601
  thumbnailUrl: string | null
  description: string
}

export interface YoutubeSearchResult {
  events: YoutubeUpcomingEvent[]
  // funnel 다이어그노스틱스 — 어디서 결과가 떨어졌는지 추적
  rawSearchCount: number      // search.list 가 반환한 총 hits
  videoIdCount: number        // videoId 추출된 건수
  detailsCount: number        // videos.list 가 반환한 detail 건수
  withScheduledTime: number   // liveStreamingDetails.scheduledStartTime 이 미래인 건수
  sampleTitle?: string
}

// 아티스트 이름으로 upcoming K-pop 컴백 검색
//   - artistName 만 받아 내부에서 "k-pop comeback" 키워드 부착해 정교화
//     (예: "HUNTR/X" 단독 검색 시 'Hunter x Hunter' 애니메이션 livestream 으로
//      오매핑되던 케이스 방지)
//   - 후처리 검증: scheduledStartTime 이 현재 시각보다 미래인 것만 events 에 포함
//     (YouTube API 의 eventType=upcoming 분류가 옛날 vlive 를 가끔 포함 — 2021년
//      ENHYPEN VLive 가 미래로 잘못 분류되던 케이스 방지)
//   - 컴백 M/V 가 YouTube Premiere 로 예약되는 경우만 감지됨 (한계 명시)
export async function searchUpcomingComebacks(
  artistName: string,
  maxResults = 5
): Promise<YoutubeSearchResult> {
  const youtube = getYoutubeClient()
  const refinedQuery = `${artistName} k-pop comeback`

  const searchRes = await youtube.search.list({
    part: ["snippet"],
    q: refinedQuery,
    eventType: "upcoming",
    type: ["video"],
    maxResults,
    order: "date",
  })

  const items = searchRes.data.items ?? []
  const rawSearchCount = items.length
  const sampleTitle = items[0]?.snippet?.title ?? undefined

  const videoIds = items
    .map((i) => i.id?.videoId)
    .filter((id): id is string => typeof id === "string")
  const videoIdCount = videoIds.length

  console.log(
    `[youtube] q="${refinedQuery}" rawSearchHits=${rawSearchCount} videoIds=${videoIdCount}` +
      (sampleTitle ? ` sample="${sampleTitle}"` : "")
  )

  if (videoIds.length === 0) {
    return {
      events: [],
      rawSearchCount,
      videoIdCount,
      detailsCount: 0,
      withScheduledTime: 0,
      sampleTitle,
    }
  }

  const detailsRes = await youtube.videos.list({
    part: ["liveStreamingDetails", "snippet"],
    id: videoIds,
  })

  const details = detailsRes.data.items ?? []
  const detailsCount = details.length

  const events: YoutubeUpcomingEvent[] = []
  const nowMs = Date.now()
  for (const video of details) {
    const scheduled = video.liveStreamingDetails?.scheduledStartTime
    const snippet = video.snippet
    if (!video.id || !scheduled || !snippet?.title) continue
    // 후처리: scheduledStartTime 이 미래여야 함 (옛날 라이브 오분류 방지)
    if (new Date(scheduled).getTime() <= nowMs) continue
    events.push({
      videoId: video.id,
      title: snippet.title,
      channelTitle: snippet.channelTitle ?? "",
      scheduledStartTime: scheduled,
      thumbnailUrl:
        snippet.thumbnails?.high?.url ??
        snippet.thumbnails?.medium?.url ??
        null,
      description: snippet.description ?? "",
    })
  }

  console.log(
    `[youtube] q="${refinedQuery}" detailsCount=${detailsCount} withScheduledTime(future)=${events.length}`
  )

  return {
    events,
    rawSearchCount,
    videoIdCount,
    detailsCount,
    withScheduledTime: events.length,        // = 미래의 scheduledStartTime 보유 건수
    sampleTitle,
  }
}
