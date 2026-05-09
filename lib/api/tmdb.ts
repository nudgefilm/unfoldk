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


// ============================================================
// KdramaMatch (M+2) 전용 — 드라마 카탈로그 인제스트
// ============================================================

export interface TmdbTvDetail {
  id: number
  name: string
  original_name: string
  overview: string
  first_air_date: string
  poster_path: string | null
  vote_average: number                  // 0~10 (UnfoldK 는 5점 척도로 환산해 저장)
  number_of_episodes: number | null
  status: string                        // "Ended" | "Returning Series" | "In Production" | "Canceled" | "Pilot"
  genres: Array<{ id: number; name: string }>
}

interface TmdbTopRatedResponse {
  page: number
  total_pages: number
  results: TmdbTvShow[]
}

interface TmdbGenreListResponse {
  genres: Array<{ id: number; name: string }>
}

// TV 장르 매핑 — 응답이 작아 실행 컨텍스트 메모리 캐시
let _genreCache: Map<number, string> | null = null

export async function fetchTvGenreMap(): Promise<Map<number, string>> {
  if (_genreCache) return _genreCache
  const url = `${TMDB_BASE}/genre/tv/list?language=en-US`
  const res = await fetch(url, {
    headers: tmdbHeaders(),
    next: { revalidate: 86400 }, // 24h — 장르 목록은 거의 변하지 않음
  })
  if (!res.ok) {
    throw new Error(`TMDB genre/tv/list error ${res.status}: ${await res.text()}`)
  }
  const data: TmdbGenreListResponse = await res.json()
  const map = new Map<number, string>()
  for (const g of data.genres) map.set(g.id, g.name)
  _genreCache = map
  return map
}

// TMDB 의 다양한 장르명을 KdramaMatch UI 의 5개 옵션으로 정규화
// (Romance / Thriller / Comedy / Fantasy / Historical) — 매칭 안 되면 원본 반환
export function normalizeGenre(rawGenre: string | null): string | null {
  if (!rawGenre) return null
  const lower = rawGenre.toLowerCase()
  if (lower.includes("romance") || lower.includes("soap")) return "Romance"
  if (lower.includes("crime") || lower.includes("mystery") || lower.includes("thriller"))
    return "Thriller"
  if (lower.includes("comedy")) return "Comedy"
  if (lower.includes("fantasy") || lower.includes("sci-fi") || lower.includes("science fiction"))
    return "Fantasy"
  if (lower.includes("history") || lower.includes("war")) return "Historical"
  // 그 외 (Drama, Action 등) 는 원본 반환 — UI 에선 매칭 칩에 없으면 회색 처리
  return rawGenre
}

// 한국 드라마 인기순 — 인제스트는 1~3 페이지(60건) 으로 확장
export async function fetchKoreanDramasByPopularity(page: number): Promise<TmdbTvShow[]> {
  return fetchPopularKoreanDramas(page)
}

// TMDB top_rated/tv 한국 필터 — KR origin_country 만 선별
// (top_rated 엔드포인트엔 origin_country 필터가 없어 page 단위 후처리)
export async function fetchTopRatedKoreanDramas(page: number): Promise<TmdbTvShow[]> {
  const url = `${TMDB_BASE}/tv/top_rated?language=en-US&page=${page}`
  const res = await fetch(url, {
    headers: tmdbHeaders(),
    next: { revalidate: 3600 },
  })
  if (!res.ok) {
    throw new Error(`TMDB tv/top_rated error ${res.status}: ${await res.text()}`)
  }
  const data: TmdbTopRatedResponse = await res.json()
  return data.results.filter(
    (d) => Array.isArray(d.origin_country) && d.origin_country.includes("KR")
  )
}

// 단일 드라마 상세 — episode_count, status, genres 가져오는 데 필요
export async function fetchTvDetail(tmdbId: number): Promise<TmdbTvDetail | null> {
  const url = `${TMDB_BASE}/tv/${tmdbId}?language=en-US`
  const res = await fetch(url, {
    headers: tmdbHeaders(),
    next: { revalidate: 3600 },
  })
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`TMDB tv/${tmdbId} error ${res.status}: ${await res.text()}`)
  }
  return (await res.json()) as TmdbTvDetail
}

// TMDB status → 우리 status 'ongoing' | 'completed' 매핑
export function mapTmdbStatus(tmdbStatus: string | undefined): "ongoing" | "completed" | null {
  if (!tmdbStatus) return null
  const s = tmdbStatus.toLowerCase()
  if (s.includes("ended") || s.includes("canceled")) return "completed"
  if (s.includes("returning") || s.includes("production") || s.includes("pilot"))
    return "ongoing"
  return null
}
