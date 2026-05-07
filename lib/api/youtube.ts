// YouTube Data API v3 래퍼 (googleapis SDK)
// ⚠️ tubewatch.kr 와 별도 GCP 프로젝트 사용 필수 (CLAUDE.md §8, §13)
// 쿼터: 10,000 units/day. search.list = 100 units, videos.list = 1 unit

import { google, youtube_v3 } from "googleapis"

function getYoutubeClient(): youtube_v3.Youtube {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) throw new Error("YOUTUBE_API_KEY 미설정")
  return google.youtube({ version: "v3", auth: apiKey })
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
  withScheduledTime: number   // liveStreamingDetails.scheduledStartTime 보유 건수
  sampleTitle?: string
}

// 아티스트 키워드로 upcoming live/premiere 검색
// 컴백 M/V 가 YouTube Premiere 로 예약되는 경우만 감지됨 (한계 명시)
export async function searchUpcomingComebacks(
  query: string,
  maxResults = 5
): Promise<YoutubeSearchResult> {
  const youtube = getYoutubeClient()

  const searchRes = await youtube.search.list({
    part: ["snippet"],
    q: query,
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
    `[youtube] q="${query}" rawSearchHits=${rawSearchCount} videoIds=${videoIdCount}` +
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
  for (const video of details) {
    const scheduled = video.liveStreamingDetails?.scheduledStartTime
    const snippet = video.snippet
    if (!video.id || !scheduled || !snippet?.title) continue
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
    `[youtube] q="${query}" detailsCount=${detailsCount} withScheduledTime=${events.length}`
  )

  return {
    events,
    rawSearchCount,
    videoIdCount,
    detailsCount,
    withScheduledTime: events.length,
    sampleTitle,
  }
}
