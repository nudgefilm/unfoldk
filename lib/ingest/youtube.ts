// YouTube K-pop 컴백 (upcoming Premiere) → 'comeback' 이벤트 인제스트 로직
// 라우트(ingest-youtube, ingest-all) 양쪽에서 import 해 재사용

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { searchUpcomingComebacks } from "@/lib/api/youtube"
import { getTopKpopArtists } from "@/lib/api/lastfm"
import { generateEventDescription } from "@/lib/claude/generate-event-description"

const ARTIST_LIMIT = 15
const RESULTS_PER_ARTIST = 3

export interface YoutubeIngestResult {
  source: "youtube"
  apiKeyStatus: { set: boolean; length: number; prefix: string }
  artistsScanned: number
  eventsFound?: number
  dedupedCount?: number
  upserted: number
  funnel?: {
    rawSearchCount: number
    videoIdCount: number
    detailsCount: number
    withScheduledTime: number
  }
  perArtistDiag?: Array<{
    artist: string
    rawSearchCount: number
    videoIdCount: number
    detailsCount: number
    withScheduledTime: number
    sampleTitle?: string
  }>
  perArtistErrors?: Array<{ artist: string; error: string }>
  note?: string
  hint?: string
  error?: string
  details?: string
  code?: string
  rowCount?: number
  sampleRow?: unknown
}

export async function runYoutubeIngest(): Promise<YoutubeIngestResult> {
  const ytKey = process.env.YOUTUBE_API_KEY ?? ""
  const apiKeyStatus = {
    set: ytKey.length > 0,
    length: ytKey.length,
    prefix: ytKey ? ytKey.slice(0, 4) + "…" : "",
  }
  console.log("[ingest-youtube] YOUTUBE_API_KEY:", apiKeyStatus)

  // Last.fm 시드 아티스트
  const artists = await getTopKpopArtists(ARTIST_LIMIT)
  console.log(`[ingest-youtube] Last.fm 시드 아티스트 ${artists.length}명`)
  if (artists.length === 0) {
    return {
      source: "youtube",
      apiKeyStatus,
      artistsScanned: 0,
      upserted: 0,
      note: "Last.fm 아티스트 시드 비어있음",
    }
  }

  const allEvents: Array<{
    artistName: string
    videoId: string
    title: string
    scheduledStartTime: string
    thumbnailUrl: string | null
    description: string
  }> = []
  const perArtistErrors: YoutubeIngestResult["perArtistErrors"] = []
  const perArtistDiag: NonNullable<YoutubeIngestResult["perArtistDiag"]> = []

  for (const artist of artists) {
    try {
      const result = await searchUpcomingComebacks(
        artist.name,                          // searchUpcomingComebacks 가 내부에서 "k-pop comeback" 부착
        RESULTS_PER_ARTIST
      )
      perArtistDiag.push({
        artist: artist.name,
        rawSearchCount: result.rawSearchCount,
        videoIdCount: result.videoIdCount,
        detailsCount: result.detailsCount,
        withScheduledTime: result.withScheduledTime,
        sampleTitle: result.sampleTitle,
      })
      for (const e of result.events) {
        allEvents.push({
          artistName: artist.name,
          videoId: e.videoId,
          title: e.title,
          scheduledStartTime: e.scheduledStartTime,
          thumbnailUrl: e.thumbnailUrl,
          description: e.description,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[ingest-youtube] ${artist.name} 검색 실패:`, msg)
      perArtistErrors!.push({ artist: artist.name, error: msg })
    }
  }

  const funnel = perArtistDiag.reduce(
    (acc, d) => ({
      rawSearchCount: acc.rawSearchCount + d.rawSearchCount,
      videoIdCount: acc.videoIdCount + d.videoIdCount,
      detailsCount: acc.detailsCount + d.detailsCount,
      withScheduledTime: acc.withScheduledTime + d.withScheduledTime,
    }),
    { rawSearchCount: 0, videoIdCount: 0, detailsCount: 0, withScheduledTime: 0 }
  )
  console.log("[ingest-youtube] funnel 합계:", funnel)

  if (allEvents.length === 0) {
    return {
      source: "youtube",
      apiKeyStatus,
      artistsScanned: artists.length,
      upserted: 0,
      funnel,
      perArtistDiag,
      perArtistErrors,
      hint:
        funnel.rawSearchCount === 0
          ? "search.list 가 0 hit — API 키 미작동/제약 또는 쿼터 초과 의심"
          : funnel.withScheduledTime === 0
          ? "검색은 되지만 어떤 영상도 scheduledStartTime 없음 — 컴백 M/V 가 YouTube Premiere 로 예약되지 않음"
          : undefined,
    }
  }

  const rawRows = allEvents.map((e) => ({
    type: "comeback" as const,
    title: e.title,
    artist_or_drama: e.artistName,
    event_date: e.scheduledStartTime,
    event_time_label: null,
    // 1차 fallback — Claude 실패 시 YouTube 영상 설명을 description 으로 사용
    _yt_description: e.description.slice(0, 500) || null,
    source_api: "youtube",
    source_id: e.videoId,
    thumbnail_url: e.thumbnailUrl,
    is_premium: false,
  }))

  // 같은 videoId 가 여러 아티스트 검색에서 등장할 때 first-wins dedup
  // (Claude 호출 비용 절감을 위해 dedup 후에 호출)
  const seen = new Set<string>()
  const dedupedRows = rawRows.filter((r) => {
    if (seen.has(r.source_id)) return false
    seen.add(r.source_id)
    return true
  })
  const dedupedCount = rawRows.length - dedupedRows.length

  const supabase = createSupabaseAdminClient()

  // 기존 description 사전 조회 — 이미 채워진 이벤트는 Claude 호출 skip
  // (cron 매 실행마다 같은 이벤트에 대해 Claude 재호출되는 비용 누수 차단)
  const sourceIds = dedupedRows.map((r) => r.source_id)
  const { data: existingRows } = await supabase
    .from("hallyu_calendar_events")
    .select("source_id, description")
    .eq("source_api", "youtube")
    .in("source_id", sourceIds)

  const existingDescMap = new Map<string, string | null>()
  for (const row of (existingRows ?? []) as Array<{
    source_id: string
    description: string | null
  }>) {
    existingDescMap.set(row.source_id, row.description)
  }

  // Claude Haiku 로 한 줄 설명 병렬 생성
  // - 기존 description 이 비어있지 않으면 호출 skip + 기존 값 유지
  // - 신규 이벤트 또는 description 비어있는 경우만 호출
  // - Claude 실패 시 YouTube 영상 설명 fallback
  const rows = await Promise.all(
    dedupedRows.map(async ({ _yt_description, ...row }) => {
      const existingDesc = existingDescMap.get(row.source_id)
      if (existingDesc && existingDesc.trim().length > 0) {
        return { ...row, description: existingDesc }
      }
      const aiDescription = await generateEventDescription(
        row.title,
        row.artist_or_drama,
        row.type
      )
      return { ...row, description: aiDescription ?? _yt_description }
    })
  )
  const { data, error } = await supabase
    .from("hallyu_calendar_events")
    .upsert(rows, { onConflict: "source_api,source_id", ignoreDuplicates: false })
    .select("id")

  if (error) {
    console.error("[ingest-youtube] upsert 실패:", error)
    return {
      source: "youtube",
      apiKeyStatus,
      artistsScanned: artists.length,
      eventsFound: allEvents.length,
      dedupedCount,
      upserted: 0,
      funnel,
      perArtistDiag,
      perArtistErrors,
      error: error.message,
      details: error.details ?? undefined,
      hint: error.hint ?? undefined,
      code: error.code ?? undefined,
      rowCount: rows.length,
      sampleRow: rows[0],
    }
  }

  return {
    source: "youtube",
    apiKeyStatus,
    artistsScanned: artists.length,
    eventsFound: allEvents.length,
    dedupedCount,
    upserted: data?.length ?? 0,
    funnel,
    perArtistDiag,
    perArtistErrors,
  }
}
