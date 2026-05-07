import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { searchUpcomingComebacks } from "@/lib/api/youtube"
import { getTopKpopArtists } from "@/lib/api/lastfm"

export const maxDuration = 60
export const dynamic = "force-dynamic"

// 쿼터 가드: search.list = 100u, videos.list = 1u
// 아티스트 N명 × (100 + 1) = ~101N units. 일일 10,000u 한도.
// 안전하게 N=15 (≈ 1,500u) 로 제한.
const ARTIST_LIMIT = 15
const RESULTS_PER_ARTIST = 3

// YouTube 에서 K-pop 아티스트별 upcoming live/premiere 검색 → 'comeback' 이벤트 생성
export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  // YouTube API 키 상태 진단 — 마스킹된 prefix·길이만 노출
  const ytKey = process.env.YOUTUBE_API_KEY ?? ""
  const apiKeyStatus = {
    set: ytKey.length > 0,
    length: ytKey.length,
    prefix: ytKey ? ytKey.slice(0, 4) + "…" : "",
  }
  console.log("[ingest-youtube] YOUTUBE_API_KEY:", apiKeyStatus)

  try {
    // Last.fm 에서 트렌딩 K-pop 아티스트 시드 가져오기
    const artists = await getTopKpopArtists(ARTIST_LIMIT)
    console.log(`[ingest-youtube] Last.fm 시드 아티스트 ${artists.length}명`)
    if (artists.length === 0) {
      return NextResponse.json({
        source: "youtube",
        apiKeyStatus,
        upserted: 0,
        note: "Last.fm 아티스트 시드 비어있음",
      })
    }

    // 직렬 처리 — YouTube 쿼터·rate limit 보호
    const allEvents: Array<{
      artistName: string
      videoId: string
      title: string
      scheduledStartTime: string
      thumbnailUrl: string | null
      description: string
    }> = []
    const perArtistErrors: Array<{ artist: string; error: string }> = []
    // funnel: 어느 단계에서 0이 됐는지 추적
    const perArtistDiag: Array<{
      artist: string
      rawSearchCount: number
      videoIdCount: number
      detailsCount: number
      withScheduledTime: number
      sampleTitle?: string
    }> = []

    for (const artist of artists) {
      try {
        const result = await searchUpcomingComebacks(
          `${artist.name} comeback`,
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
        // 한 아티스트 실패가 전체를 깨뜨리지 않도록 (CLAUDE.md §10-4)
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[ingest-youtube] ${artist.name} 검색 실패:`, msg)
        perArtistErrors.push({ artist: artist.name, error: msg })
      }
    }

    // funnel 합계 — 어디서 0 으로 떨어졌는지 한눈에
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
      return NextResponse.json({
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
            ? "검색은 되지만 어떤 영상도 scheduledStartTime 없음 — 컴백 M/V 가 YouTube Premiere 로 예약되지 않음 (eventType=upcoming 한계)"
            : undefined,
      })
    }

    const rows = allEvents.map((e) => ({
      type: "comeback" as const,
      title: e.title,
      artist_or_drama: e.artistName,
      event_date: e.scheduledStartTime,
      event_time_label: null,
      description: e.description.slice(0, 500) || null,
      source_api: "youtube",
      source_id: e.videoId,
      thumbnail_url: e.thumbnailUrl,
      is_premium: false,
    }))

    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from("hallyu_calendar_events")
      .upsert(rows, { onConflict: "source_api,source_id", ignoreDuplicates: false })
      .select("id")

    if (error) {
      return NextResponse.json(
        { source: "youtube", error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      source: "youtube",
      apiKeyStatus,
      artistsScanned: artists.length,
      eventsFound: allEvents.length,
      upserted: data?.length ?? 0,
      funnel,
      perArtistDiag,
      perArtistErrors,
    })
  } catch (err) {
    // 외부 try/catch — Last.fm 시드 fetch 실패 또는 예기치 못한 throw
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error("[ingest-youtube] 최상위 에러:", msg, stack)
    return NextResponse.json(
      {
        source: "youtube",
        error: msg,
        stack,
      },
      { status: 500 }
    )
  }
}
