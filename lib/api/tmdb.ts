// TMDB API v3 래퍼 (v4 Bearer 토큰 사용)
// 출처 표기 의무: "This product uses the TMDB API but is not endorsed or certified by TMDB."

const TMDB_BASE = "https://api.themoviedb.org/3"
const TMDB_IMG_BASE = "https://image.tmdb.org/t/p/w500"
const TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w1280"
const TMDB_PROFILE_BASE = "https://image.tmdb.org/t/p/w185"

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

// 현재 방영 중인 한국 드라마
// with_genres=18: Drama 장르만 — 예능·토크쇼·버라이어티(Running Man 등) 제외
// air_date.gte=30일 전: 최근 30일 이내 에피소드가 있는 작품만 (종영작 제외)
// sort_by=first_air_date.desc: 신작 우선 (Squid Game·Bloodhounds 등 구작 억제)
export async function fetchCurrentlyAiringKoreanDramas(limit = 10): Promise<TmdbTvShow[]> {
  const today = new Date().toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  const params = new URLSearchParams({
    with_origin_country: "KR",
    with_genres: "18",
    "air_date.gte": thirtyDaysAgo,
    "air_date.lte": today,
    sort_by: "first_air_date.desc",
    include_null_first_air_dates: "false",
    language: "en-US",
    page: "1",
  })
  const url = `${TMDB_BASE}/discover/tv?${params}`
  const res = await fetch(url, {
    headers: tmdbHeaders(),
    next: { revalidate: 3600 },
  })
  if (!res.ok) {
    throw new Error(`TMDB discover/tv (airing) error ${res.status}: ${await res.text()}`)
  }
  const data: TmdbDiscoverResponse = await res.json()
  return data.results.slice(0, limit)
}

export function tmdbPosterUrl(path: string | null): string | null {
  return path ? `${TMDB_IMG_BASE}${path}` : null
}

// w1280 backdrop — 모달 상단 배경용
export function tmdbBackdropUrl(path: string | null | undefined): string | null {
  return path ? `${TMDB_BACKDROP_BASE}${path}` : null
}

// w185 profile — cast 썸네일용
export function tmdbProfileUrl(path: string | null | undefined): string | null {
  return path ? `${TMDB_PROFILE_BASE}${path}` : null
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
  last_air_date: string | null
  poster_path: string | null
  backdrop_path: string | null
  vote_average: number                  // 0~10 (UnfoldK 는 5점 척도로 환산해 저장)
  number_of_episodes: number | null
  number_of_seasons: number | null
  popularity: number | null
  status: string                        // "Ended" | "Returning Series" | "In Production" | "Canceled" | "Pilot"
  genres: Array<{ id: number; name: string }>
  networks: Array<{ id: number; name: string; logo_path: string | null }>
  next_episode_to_air: { id: number; air_date: string | null } | null
  // append_to_response 결과 — fetchTvDetail 에서 옵션으로 가져옴
  credits?: {
    cast: Array<{
      id: number
      name: string
      character: string
      profile_path: string | null
      order: number
    }>
  }
  videos?: {
    results: Array<{
      id: string
      key: string
      site: string
      type: string        // "Trailer" | "Teaser" | "Clip" | ...
      official: boolean
      published_at: string
    }>
  }
  "watch/providers"?: {
    results: Record<
      string,
      {
        link?: string
        flatrate?: Array<{
          provider_id: number
          provider_name: string
          logo_path: string | null
        }>
        buy?: Array<{ provider_id: number; provider_name: string; logo_path: string | null }>
        rent?: Array<{ provider_id: number; provider_name: string; logo_path: string | null }>
      }
    >
  }
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

// TMDB search/tv — 제목으로 TV 시리즈 검색.
// 응답은 TMDB 가 인기·관련도순으로 정렬해 반환. KR origin 필터링은 호출부에서.
// 사용처: famous-dramas 자동 보충 (ingest-korean-phrases) — 인기 페이지/top_rated 에 안 잡히는
//        구작·니치 드라마 (Signal, SKY Castle 등) 를 제목으로 직접 찾아 dramas 테이블에 추가.
export async function searchTv(query: string, language = "en-US"): Promise<TmdbTvShow[]> {
  const url = `${TMDB_BASE}/search/tv?query=${encodeURIComponent(query)}&language=${language}&include_adult=false&page=1`
  const res = await fetch(url, {
    headers: tmdbHeaders(),
    next: { revalidate: 86400 }, // 24h — 검색 결과는 자주 변하지 않음
  })
  if (!res.ok) {
    throw new Error(`TMDB search/tv error ${res.status}: ${await res.text()}`)
  }
  const data = (await res.json()) as { results?: TmdbTvShow[] }
  return data.results ?? []
}

// 단일 드라마 상세 — episode_count, status, genres + 옵션으로 credits/videos/watch/providers
// expanded=true 시 append_to_response 로 한 번에 4종 데이터 묶어 가져옴 (쿼터 절약 — 4 req → 1 req)
export async function fetchTvDetail(
  tmdbId: number,
  options: { expanded?: boolean } = {}
): Promise<TmdbTvDetail | null> {
  const append = options.expanded ? "&append_to_response=credits,videos,watch/providers" : ""
  const url = `${TMDB_BASE}/tv/${tmdbId}?language=en-US${append}`
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

// videos.results 에서 공식 YouTube 트레일러 key 추출 — 우선순위: official Trailer > Trailer > Teaser
export function pickTrailerKey(detail: TmdbTvDetail): string | null {
  const vids = detail.videos?.results ?? []
  const ytOnly = vids.filter((v) => v.site === "YouTube")
  const officialTrailer = ytOnly.find((v) => v.type === "Trailer" && v.official)
  if (officialTrailer) return officialTrailer.key
  const anyTrailer = ytOnly.find((v) => v.type === "Trailer")
  if (anyTrailer) return anyTrailer.key
  const teaser = ytOnly.find((v) => v.type === "Teaser")
  return teaser?.key ?? null
}

// US watch/providers — flatrate 우선, 비어 있으면 buy/rent fallback. 없으면 null.
// 저장 형식: { flatrate: [{provider_id,provider_name,logo_path}], link }
export interface DramaWatchProviderInfo {
  flatrate: Array<{ provider_id: number; provider_name: string; logo_path: string | null }>
  link: string | null
}
export function pickUsWatchProviders(detail: TmdbTvDetail): DramaWatchProviderInfo | null {
  const us = detail["watch/providers"]?.results?.US
  if (!us) return null
  const flatrate = us.flatrate ?? []
  if (flatrate.length === 0 && (us.buy?.length ?? 0) === 0 && (us.rent?.length ?? 0) === 0) {
    return null
  }
  return {
    flatrate: flatrate.map((p) => ({
      provider_id: p.provider_id,
      provider_name: p.provider_name,
      logo_path: p.logo_path,
    })),
    link: us.link ?? null,
  }
}

// ============================================================
// HallyuCalendar — drama 이벤트 'Watch Now' 외부 링크
// ============================================================

interface TmdbWatchProvidersResponse {
  id: number
  results?: Record<
    string,
    {
      link?: string // TMDB 제공 region 별 dispatcher URL — 클릭 시 TMDB 가 사용자 region 기반 리다이렉트
      flatrate?: Array<{ provider_id: number; provider_name: string }>
      buy?: Array<{ provider_id: number; provider_name: string }>
      rent?: Array<{ provider_id: number; provider_name: string }>
    }
  >
}

// TMDB tv/{id}/watch/providers — US region 의 flatrate/buy/rent 중 하나라도 있으면 link 반환.
// 비어 있으면 null → UI 에서 Watch Now 버튼 미노출.
// 404·기타 에러는 null 로 swallow (cron 전체 실패 방지).
// TMDB ToS: 출처 표기 의무 — UI 푸터에 박제.
export async function fetchWatchProvidersUs(tmdbId: number): Promise<string | null> {
  const url = `${TMDB_BASE}/tv/${tmdbId}/watch/providers`
  try {
    const res = await fetch(url, {
      headers: tmdbHeaders(),
      next: { revalidate: 86400 }, // 24h — provider 목록은 자주 변하지 않음
    })
    if (!res.ok) return null
    const data: TmdbWatchProvidersResponse = await res.json()
    const us = data.results?.US
    if (!us) return null
    const hasAnyProvider =
      (us.flatrate?.length ?? 0) > 0 ||
      (us.buy?.length ?? 0) > 0 ||
      (us.rent?.length ?? 0) > 0
    if (!hasAnyProvider) return null
    return us.link ?? null
  } catch (err) {
    console.error(`[tmdb] watch/providers ${tmdbId} 실패:`, err)
    return null
  }
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
