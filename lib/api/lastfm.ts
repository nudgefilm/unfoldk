// Last.fm API 래퍼 (Spotify 2025.05 법인 제한 대체)
// ⚠️ 한계: Last.fm 자체 API 에는 album release date 가 없어 "신보 감지"는
//   부정확함. 본 래퍼는 트렌딩 K-pop 아티스트 리스트 fetch 용도로만 사용.
//   정확한 release date 가 필요하면 MusicBrainz 또는 YouTube premiere 시그널 활용.

const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0/"

function lastfmApiKey(): string {
  const key = process.env.LASTFM_API_KEY
  if (!key) throw new Error("LASTFM_API_KEY 미설정")
  return key
}

export interface LastfmArtist {
  name: string
  mbid?: string // MusicBrainz ID — release date 후속 조회 시 사용
  url: string
  playcount?: string
  listeners?: string
}

interface LastfmTopArtistsResponse {
  topartists?: {
    artist: LastfmArtist[]
  }
}

// 'k-pop' 태그 인기 아티스트 — YouTube 검색 시드로 사용
export async function getTopKpopArtists(limit = 20): Promise<LastfmArtist[]> {
  const params = new URLSearchParams({
    method: "tag.gettopartists",
    tag: "k-pop",
    api_key: lastfmApiKey(),
    format: "json",
    limit: String(limit),
  })

  const res = await fetch(`${LASTFM_BASE}?${params}`, {
    next: { revalidate: 86400 }, // 24h 캐시
  })

  if (!res.ok) {
    throw new Error(`Last.fm tag.gettopartists ${res.status}`)
  }

  const data: LastfmTopArtistsResponse = await res.json()
  return data.topartists?.artist ?? []
}
