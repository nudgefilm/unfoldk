import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { getTopKpopArtists } from "@/lib/api/lastfm"

export const maxDuration = 60
export const dynamic = "force-dynamic"

// Last.fm 자체 API 에는 album release date 가 없어 직접 'comeback' 이벤트 생성이
// 부정확하므로, 이 라우트는 트렌딩 K-pop 아티스트 시드 fetch 검증용으로만 동작.
// (실제 컴백 이벤트 생성은 ingest-youtube 가 Last.fm 시드를 받아 처리.)
//
// Phase 2.5 후속: MusicBrainz API 로 mbid 별 release-group/first-release-date 조회
//                 → 정확한 신보 이벤트 생성 가능.
export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 })
  }

  try {
    const artists = await getTopKpopArtists(20)

    return NextResponse.json({
      source: "lastfm",
      role: "artist-seed",
      artistsFound: artists.length,
      sample: artists.slice(0, 5).map((a) => ({ name: a.name, mbid: a.mbid })),
      note:
        "Last.fm 은 release date 미제공 — 이벤트 직접 생성 안 함. " +
        "ingest-youtube 가 이 시드를 사용해 컴백 영상 premiere 를 찾아 이벤트 생성.",
    })
  } catch (err) {
    return NextResponse.json(
      {
        source: "lastfm",
        error: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 }
    )
  }
}
