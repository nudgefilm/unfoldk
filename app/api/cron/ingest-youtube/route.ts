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

  try {
    // Last.fm 에서 트렌딩 K-pop 아티스트 시드 가져오기
    const artists = await getTopKpopArtists(ARTIST_LIMIT)
    if (artists.length === 0) {
      return NextResponse.json({
        source: "youtube",
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

    for (const artist of artists) {
      try {
        const events = await searchUpcomingComebacks(
          `${artist.name} comeback`,
          RESULTS_PER_ARTIST
        )
        for (const e of events) {
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
        console.warn(
          `[ingest-youtube] ${artist.name} 검색 실패:`,
          err instanceof Error ? err.message : err
        )
      }
    }

    if (allEvents.length === 0) {
      return NextResponse.json({
        source: "youtube",
        artistsScanned: artists.length,
        upserted: 0,
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
      artistsScanned: artists.length,
      eventsFound: allEvents.length,
      upserted: data?.length ?? 0,
    })
  } catch (err) {
    return NextResponse.json(
      {
        source: "youtube",
        error: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 }
    )
  }
}
