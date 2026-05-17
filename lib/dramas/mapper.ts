// dramas row → API 응답 매핑 (snake_case → camelCase + 신규 컬럼)
//
// KdramaMatch Phase 2 — 14개 컬럼 추가로 mapper 분리.
// /api/dramas, /api/dramas/[id], /api/dramas/recommend 등 응답 통일.

export const DRAMA_SELECT = `
  id,
  tmdb_id,
  title,
  title_ko,
  original_name,
  genre,
  year,
  platform,
  poster_url,
  backdrop_path,
  rating,
  overview,
  episode_count,
  number_of_episodes,
  number_of_seasons,
  last_air_date,
  status,
  popularity,
  networks,
  cast_members,
  trailer_key,
  watch_providers,
  next_episode_date,
  on_the_air,
  calendar_event_id,
  ost_artist_ids
` as const

export interface DramaCastJson {
  name: string
  character: string
  profile_path: string | null
}

export interface DramaNetworkJson {
  id: number
  name: string
  logo_path: string | null
}

export interface DramaWatchProvidersJson {
  flatrate?: Array<{
    provider_id: number
    provider_name: string
    logo_path: string | null
  }>
  link?: string | null
}

// API 응답 타입 — 클라이언트가 import 해 사용
export interface DramaApi {
  id: string
  tmdbId: number | null
  title: string
  titleKo: string | null
  originalName: string | null
  genre: string | null
  year: number | null
  platform: string | null
  posterUrl: string | null
  backdropPath: string | null
  rating: number | null
  overview: string | null
  episodeCount: number | null
  numberOfEpisodes: number | null
  numberOfSeasons: number | null
  lastAirDate: string | null
  status: "ongoing" | "completed" | null
  popularity: number | null
  networks: DramaNetworkJson[] | null
  castMembers: DramaCastJson[] | null
  trailerKey: string | null
  watchProviders: DramaWatchProvidersJson | null
  nextEpisodeDate: string | null
  onTheAir: boolean
  calendarEventId: string | null
  ostArtistIds: string[] | null
}

// PostgREST row 타입 (snake_case)
interface DramaRowDb {
  id: string
  tmdb_id: number | null
  title: string
  title_ko: string | null
  original_name: string | null
  genre: string | null
  year: number | null
  platform: string | null
  poster_url: string | null
  backdrop_path: string | null
  rating: number | null
  overview: string | null
  episode_count: number | null
  number_of_episodes: number | null
  number_of_seasons: number | null
  last_air_date: string | null
  status: "ongoing" | "completed" | null
  popularity: number | null
  networks: DramaNetworkJson[] | null
  cast_members: DramaCastJson[] | null
  trailer_key: string | null
  watch_providers: DramaWatchProvidersJson | null
  next_episode_date: string | null
  on_the_air: boolean | null
  calendar_event_id: string | null
  ost_artist_ids: string[] | null
}

export function mapDramaRow(row: unknown): DramaApi {
  const r = row as DramaRowDb
  return {
    id: r.id,
    tmdbId: r.tmdb_id ?? null,
    title: r.title,
    titleKo: r.title_ko,
    originalName: r.original_name,
    genre: r.genre,
    year: r.year,
    platform: r.platform,
    posterUrl: r.poster_url,
    backdropPath: r.backdrop_path,
    rating: r.rating,
    overview: r.overview,
    episodeCount: r.episode_count,
    numberOfEpisodes: r.number_of_episodes,
    numberOfSeasons: r.number_of_seasons,
    lastAirDate: r.last_air_date,
    status: r.status,
    popularity: r.popularity,
    networks: r.networks,
    castMembers: r.cast_members,
    trailerKey: r.trailer_key,
    watchProviders: r.watch_providers,
    nextEpisodeDate: r.next_episode_date,
    onTheAir: r.on_the_air ?? false,
    calendarEventId: r.calendar_event_id,
    ostArtistIds: r.ost_artist_ids,
  }
}
