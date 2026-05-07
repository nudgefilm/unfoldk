// Last.fm 트렌딩 K-pop 아티스트 시드 검증 — 직접 이벤트 생성 없음
// 라우트(ingest-lastfm, ingest-all) 양쪽에서 import 해 재사용

import { getTopKpopArtists } from "@/lib/api/lastfm"

export interface LastfmIngestResult {
  source: "lastfm"
  role: "artist-seed"
  artistsFound: number
  sample: Array<{ name: string; mbid?: string }>
  note: string
}

export async function runLastfmIngest(): Promise<LastfmIngestResult> {
  const artists = await getTopKpopArtists(20)
  return {
    source: "lastfm",
    role: "artist-seed",
    artistsFound: artists.length,
    sample: artists.slice(0, 5).map((a) => ({ name: a.name, mbid: a.mbid })),
    note:
      "Last.fm 은 release date 미제공 — 이벤트 직접 생성 안 함. " +
      "ingest-youtube 가 이 시드를 사용해 컴백 영상 premiere 를 찾아 이벤트 생성.",
  }
}
