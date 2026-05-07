// TMDB API v3 래퍼 (v4 Bearer 토큰 사용)
// 출처 표기 의무: "This product uses the TMDB API but is not endorsed or certified by TMDB."

const TMDB_BASE = "https://api.themoviedb.org/3"
const TMDB_IMG_BASE = "https://image.tmdb.org/t/p/w500"

function tmdbHeaders(): HeadersInit {
  const token = process.env.TMDB_READ_ACCESS_TOKEN
  if (!token) throw new Error("TMDB_READ_ACCESS_TOKEN 미설정")
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  }
}

export interface TmdbTvShow {
  id: number
  name: string
  original_name: string
  overview: string
  first_air_date: string // YYYY-MM-DD
  poster_path: string | null
  popularity: number
  origin_country: string[]
}

interface TmdbDiscoverResponse {
  page: number
  total_pages: number
  results: TmdbTvShow[]
}

// 한국 드라마 인기순 검색 (origin_country=KR)
export async function fetchPopularKoreanDramas(page = 1): Promise<TmdbTvShow[]> {
  const url = `${TMDB_BASE}/discover/tv?with_origin_country=KR&sort_by=popularity.desc&page=${page}&language=en-US&include_null_first_air_dates=false`
  const res = await fetch(url, {
    headers: tmdbHeaders(),
    next: { revalidate: 3600 }, // 1h 캐시 (CLAUDE.md §8 캐싱 우선)
  })
  if (!res.ok) {
    throw new Error(`TMDB discover/tv error ${res.status}: ${await res.text()}`)
  }
  const data: TmdbDiscoverResponse = await res.json()
  return data.results
}

export function tmdbPosterUrl(path: string | null): string | null {
  return path ? `${TMDB_IMG_BASE}${path}` : null
}
