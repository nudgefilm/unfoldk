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

// 아티스트 키워드로 upcoming live/premiere 검색
// 컴백 M/V 는 보통 YouTube Premiere(=eventType=upcoming) 로 예약됨
export async function searchUpcomingComebacks(
  query: string,
  maxResults = 5
): Promise<YoutubeUpcomingEvent[]> {
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
  const videoIds = items
    .map((i) => i.id?.videoId)
    .filter((id): id is string => typeof id === "string")
  if (videoIds.length === 0) return []

  const detailsRes = await youtube.videos.list({
    part: ["liveStreamingDetails", "snippet"],
    id: videoIds,
  })

  const details = detailsRes.data.items ?? []
  return details
    .map((video) => {
      const scheduled = video.liveStreamingDetails?.scheduledStartTime
      const snippet = video.snippet
      if (!video.id || !scheduled || !snippet?.title) return null
      return {
        videoId: video.id,
        title: snippet.title,
        channelTitle: snippet.channelTitle ?? "",
        scheduledStartTime: scheduled,
        thumbnailUrl:
          snippet.thumbnails?.high?.url ??
          snippet.thumbnails?.medium?.url ??
          null,
        description: snippet.description ?? "",
      }
    })
    .filter((x): x is YoutubeUpcomingEvent => x !== null)
}
