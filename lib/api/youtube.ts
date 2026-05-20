// YouTube Data API v3 래퍼 (googleapis SDK)
// ⚠️ tubewatch.kr 와 별도 GCP 프로젝트 사용 필수 (CLAUDE.md §8, §13)
// 쿼터: 10,000 units/day.
//   - search.list  : 100 units (channel/video 검색)
//   - videos.list  :   1 unit
//   - channels.list:   1 unit (50개/call, KpopStats 인제스트 — 25명 = 1 unit, 매우 저렴)
//
// channel_id 자동 매핑(searchChannelByName) 은 첫 cron 1회만 101 unit/명 사용
// (search.list 100 + 검증용 channels.list 1) — 매핑 후 다음 cron 부터는 channels.list 만 호출.
// 자세한 매핑 게이트는 CLAUDE.md §6 "YouTube 채널 자동 매핑 원칙" 참조.

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
  thumbnailUrl: string | null        // snippet.thumbnails.default.url — kpop_artists.thumbnail_url backfill 용
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
    // 응답에 누락된 ID 진단 — channels.list 가 존재하지 않는 채널 ID 는 그냥 안 반환.
    const returnedIds = new Set(items.map((it) => it.id).filter((id): id is string => !!id))
    const missing = chunk.filter((id) => !returnedIds.has(id))
    if (missing.length > 0) {
      console.warn(
        `[youtube] channels.list 누락 ID — 요청 ${chunk.length}건 중 ${missing.length}건:`,
        missing
      )
    }
    for (const ch of items) {
      if (!ch.id) continue
      const stats = ch.statistics
      // thumbnails.default 가 가장 작고 안정적 (high 는 채널별로 누락 가능).
      // URL 만 저장 — 이미지 자체는 저장 금지 (CLAUDE.md §10 저작권).
      // googleapis SDK 일부 버전은 `default` 키워드 충돌로 `default_` 사용 가능 → 둘 다 fallback.
      const thumb = ch.snippet?.thumbnails as
        | {
            default?: { url?: string }
            default_?: { url?: string }
            medium?: { url?: string }
            high?: { url?: string }
          }
        | undefined
      const thumbnailUrl =
        thumb?.default?.url ??
        thumb?.default_?.url ??
        thumb?.medium?.url ??
        thumb?.high?.url ??
        null
      if (!thumbnailUrl) {
        console.warn(
          `[youtube] channels.list ${ch.id} thumbnails 추출 실패 — raw:`,
          JSON.stringify(thumb)
        )
      }
      results.push({
        channelId: ch.id,
        title: ch.snippet?.title ?? null,
        thumbnailUrl,
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

// 정규화: lowercase + 알파넘만 — 채널명/아티스트명 유사도 게이트용
function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "")
}

// 채널명과 아티스트명이 충분히 유사한가? (정규화 후 한쪽이 다른 쪽 포함)
// "BTS 방탄소년단" / "BTS" 매칭, "BTS Fan Channel" / "BTS" 도 통과 (보수적이지만 1차 게이트).
function isNameSimilar(channelTitle: string, artistName: string): boolean {
  const c = normalizeForMatch(channelTitle)
  const a = normalizeForMatch(artistName)
  if (c.length === 0 || a.length === 0) return false
  return c.includes(a) || a.includes(c)
}

// 채널 자동 매핑 임계값
const MIN_SUBSCRIBERS_FOR_AUTO_MAP = 100_000

// CLAUDE.md §6 "YouTube 채널 자동 매핑 원칙" 구현:
//   1. q = `${artistName} official` 로 검색 → search.list 1위 channelId
//   2. 채널명 vs 아티스트명 유사도 낮으면 NULL (오매핑 > NULL)
//   3. channels.list 로 subscriberCount 검증 — 10만 미만이면 NULL
//   비용: search.list 100 + channels.list 1 = 101 units / call.
//   호출 측에서 멱등 보장 (이미 channel_id 있으면 호출 skip).
export async function searchChannelByName(artistName: string): Promise<string | null> {
  const youtube = getYoutubeClient()
  const query = `${artistName} official`
  try {
    // 1) search.list 1위
    const searchRes = await youtube.search.list({
      part: ["snippet"],
      q: query,
      type: ["channel"],
      maxResults: 1,
    })
    const item = searchRes.data.items?.[0]
    const channelId = item?.id?.channelId ?? item?.snippet?.channelId ?? null
    const channelTitle = item?.snippet?.channelTitle ?? item?.snippet?.title ?? ""
    if (!channelId) {
      console.log(`[youtube] searchChannelByName "${artistName}" → 검색 0건`)
      return null
    }

    // 2) 채널명 유사도 — 낮으면 즉시 NULL (오매핑 차단)
    if (!isNameSimilar(channelTitle, artistName)) {
      console.log(
        `[youtube] searchChannelByName "${artistName}" → 채널명 불일치 ` +
          `("${channelTitle}", id=${channelId}) → NULL 유지`
      )
      return null
    }

    // 3) subscriberCount 게이트 — channels.list 1 unit
    const chanRes = await youtube.channels.list({
      part: ["statistics"],
      id: [channelId],
    })
    const stats = chanRes.data.items?.[0]?.statistics
    const subs = stats?.subscriberCount ? Number(stats.subscriberCount) : 0
    if (stats?.hiddenSubscriberCount || subs < MIN_SUBSCRIBERS_FOR_AUTO_MAP) {
      console.log(
        `[youtube] searchChannelByName "${artistName}" → subs=${subs} ` +
          `(<${MIN_SUBSCRIBERS_FOR_AUTO_MAP} 또는 hidden, "${channelTitle}") → NULL 유지`
      )
      return null
    }

    console.log(
      `[youtube] searchChannelByName "${artistName}" → ${channelId} ` +
        `("${channelTitle}", ${subs} subs)`
    )
    return channelId
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[youtube] searchChannelByName 실패 "${artistName}":`, msg)
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

// 아티스트 이름으로 upcoming 컴백 검색
//   - artistName 만 받아 내부에서 "comeback" 키워드 부착
//     (이전 "k-pop comeback" 은 너무 좁아 정상 컴백 영상도 0건으로 차단됨 —
//      BTS "arirang comeback live" 같은 결과가 매칭 안 됨. "comeback" 만 유지)
//   - 후처리 검증: scheduledStartTime 이 현재 시각보다 미래인 것만 events 에 포함
//     (YouTube API 의 eventType=upcoming 분류가 옛날 vlive 를 가끔 포함 — 2021년
//      ENHYPEN VLive 가 미래로 잘못 분류되던 케이스 방지. 미래 검증만으로도 차단됨)
//   - 컴백 M/V 가 YouTube Premiere 로 예약되는 경우만 감지됨 (한계 명시)
export async function searchUpcomingComebacks(
  artistName: string,
  maxResults = 5
): Promise<YoutubeSearchResult> {
  const youtube = getYoutubeClient()
  const refinedQuery = `${artistName} comeback`

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

// ============================================
// KfoodKit — 레시피 요리 영상 검색 (lazy 캐싱)
// ============================================

export interface YoutubeCookingVideo {
  videoId: string
  title: string
  thumbnailUrl: string | null
  watchUrl: string
}

// title_en + "Korean recipe cooking" 로 1건 검색. 결과 없거나 실패 시 null.
// 비용: search.list 100 units/call — 호출자가 youtube_url 캐싱 후 재호출 회피.
export async function searchCookingVideo(
  titleEn: string
): Promise<YoutubeCookingVideo | null> {
  const trimmed = titleEn.trim()
  if (trimmed.length === 0) return null

  const youtube = getYoutubeClient()
  const query = `${trimmed} Korean recipe cooking`

  try {
    const res = await youtube.search.list({
      part: ["snippet"],
      q: query,
      type: ["video"],
      maxResults: 1,
      videoEmbeddable: "true",
      relevanceLanguage: "en",
      safeSearch: "moderate",
    })
    const item = res.data.items?.[0]
    const videoId = item?.id?.videoId ?? null
    if (!videoId) {
      console.log(`[youtube] searchCookingVideo "${trimmed}" → 검색 0건`)
      return null
    }
    const snippet = item?.snippet
    const thumb = snippet?.thumbnails as
      | {
          default?: { url?: string }
          medium?: { url?: string }
          high?: { url?: string }
        }
      | undefined
    return {
      videoId,
      title: snippet?.title ?? trimmed,
      thumbnailUrl:
        thumb?.medium?.url ?? thumb?.high?.url ?? thumb?.default?.url ?? null,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    }
  } catch (err) {
    console.warn(
      `[youtube] searchCookingVideo "${trimmed}" 실패:`,
      err instanceof Error ? err.message : String(err)
    )
    return null
  }
}
