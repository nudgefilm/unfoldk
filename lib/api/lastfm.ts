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

// ============================================
// 아티스트 단건 통계 — KpopStats 인제스트용
// ============================================

export interface LastfmArtistInfo {
  name: string
  mbid?: string
  listeners: number | null
  playcount: number | null
}

interface LastfmArtistGetInfoResponse {
  artist?: {
    name?: string
    mbid?: string
    stats?: {
      listeners?: string
      playcount?: string
    }
  }
}

// ============================================
// 국가별 인기 아티스트 — Curation K geo 위젯용
// ============================================

export interface LastfmGeoArtist {
  name: string
  mbid?: string
  url: string
  listeners: number | null
}

interface LastfmGeoTopArtistsResponse {
  topartists?: {
    artist?: Array<{
      name?: string
      mbid?: string
      url?: string
      listeners?: string
    }>
  }
}

// geo.getTopArtists — ISO country name (예 "South Korea", "Japan", "United States").
// K팝 한정 필터는 API 측에 없음 — 호출자가 결과를 kpop_artists 와 join 해 K팝만 추리는 패턴.
export async function getGeoTopArtists(
  country: string,
  limit = 50
): Promise<LastfmGeoArtist[]> {
  const params = new URLSearchParams({
    method: "geo.gettopartists",
    country,
    api_key: lastfmApiKey(),
    format: "json",
    limit: String(Math.min(1000, Math.max(1, limit))),
  })

  const res = await fetch(`${LASTFM_BASE}?${params}`, {
    next: { revalidate: 86400 }, // 24h
  })
  if (!res.ok) {
    console.warn(`[lastfm] geo.gettopartists "${country}" ${res.status}`)
    return []
  }

  const data: LastfmGeoTopArtistsResponse = await res.json()
  const artists = data.topartists?.artist ?? []
  return artists
    .filter((a): a is { name: string; mbid?: string; url?: string; listeners?: string } => !!a.name)
    .map((a) => ({
      name: a.name,
      mbid: a.mbid,
      url: a.url ?? "",
      listeners: a.listeners ? Number(a.listeners) : null,
    }))
}


// 단일 아티스트 정보 (listeners + playcount). 24h Next.js fetch cache —
// cron 1회/일 운영이라 cache hit 빈도는 낮지만 rate limit 안전판 (재시도·중복 호출 흡수).
export async function getArtistInfo(
  artistName: string
): Promise<LastfmArtistInfo | null> {
  const params = new URLSearchParams({
    method: "artist.getinfo",
    artist: artistName,
    api_key: lastfmApiKey(),
    format: "json",
    autocorrect: "1",
  })

  const res = await fetch(`${LASTFM_BASE}?${params}`, {
    next: { revalidate: 86400 }, // 24h
  })
  if (!res.ok) {
    console.warn(`[lastfm] artist.getinfo "${artistName}" ${res.status}`)
    return null
  }

  const data: LastfmArtistGetInfoResponse = await res.json()
  const a = data.artist
  if (!a?.name) return null

  return {
    name: a.name,
    mbid: a.mbid,
    listeners: a.stats?.listeners ? Number(a.stats.listeners) : null,
    playcount: a.stats?.playcount ? Number(a.stats.playcount) : null,
  }
}
