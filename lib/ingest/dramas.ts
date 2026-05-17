// KdramaMatch (M+2) 인제스트 로직
// TMDB top_rated + discover/tv KR 두 소스를 dramas 테이블로 upsert.
//
// 멱등성: tmdb_id unique 제약 → onConflict 갱신.
// 호출량 (Phase 2):
//   - 후보 ~80건 + 각 건당 /tv/{id}?append_to_response=credits,videos,watch/providers 1회 ≈ 80 호출
//   - append_to_response 로 4 req → 1 req 압축 (쿼터 절약)
//
// 캘린더 매핑 (Phase 2):
//   - upsert 후 source_api='tmdb' + title ILIKE 로 hallyu_calendar_events 매칭
//   - 매칭 발견 시 dramas.calendar_event_id 백필

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  fetchKoreanDramasByPopularity,
  fetchTopRatedKoreanDramas,
  fetchTvDetail,
  fetchTvGenreMap,
  mapTmdbStatus,
  normalizeGenre,
  pickTrailerKey,
  pickUsWatchProviders,
  tmdbBackdropUrl,
  tmdbPosterUrl,
  tmdbProfileUrl,
  type TmdbTvDetail,
  type TmdbTvShow,
} from "@/lib/api/tmdb"

export interface DramaIngestResult {
  source: "tmdb-dramas"
  scanned: number
  upserted: number
  calendarLinked: number              // 매핑된 calendar_event_id 수
  error?: string
  details?: string
  hint?: string
  code?: string
  note?: string
}

interface DramaCastJson {
  name: string
  character: string
  profile_path: string | null   // 절대 URL (w185)
}

interface DramaNetworkJson {
  id: number
  name: string
  logo_path: string | null      // 절대 URL (w185 동일 기반)
}

interface DramaUpsertRow {
  tmdb_id: number
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
  watch_providers: ReturnType<typeof pickUsWatchProviders> | null
  next_episode_date: string | null
  on_the_air: boolean
  is_active: boolean
}

// TMDB 응답 → 우리 row 변환
function buildRow(c: TmdbTvShow, detail: TmdbTvDetail | null): DramaUpsertRow {
  // 장르 우선순위: 상세 응답의 첫 genre.name → null
  let genreRaw: string | null = null
  if (detail?.genres && detail.genres.length > 0) {
    genreRaw = detail.genres[0].name
  }
  const year =
    c.first_air_date && /^\d{4}/.test(c.first_air_date)
      ? Number(c.first_air_date.slice(0, 4))
      : null

  // cast Top 10 — order 순 정렬 후 상위 10
  const castMembers: DramaCastJson[] | null = detail?.credits?.cast
    ? detail.credits.cast
        .slice()
        .sort((a, b) => a.order - b.order)
        .slice(0, 10)
        .map((m) => ({
          name: m.name,
          character: m.character,
          profile_path: tmdbProfileUrl(m.profile_path),
        }))
    : null

  // networks — TMDB networks 배열 그대로 (logo_path 절대 URL 변환)
  const networks: DramaNetworkJson[] | null = detail?.networks
    ? detail.networks.map((n) => ({
        id: n.id,
        name: n.name,
        logo_path: tmdbProfileUrl(n.logo_path),
      }))
    : null

  const trailerKey = detail ? pickTrailerKey(detail) : null
  const watchProviders = detail ? pickUsWatchProviders(detail) : null

  // platform 컬럼 — watch_providers.flatrate 첫 번째 provider 이름 (Free/Pro 노출 호환)
  const platformName =
    watchProviders?.flatrate?.[0]?.provider_name ?? null

  // on_the_air: status="Returning Series" 또는 next_episode_to_air 존재
  const onTheAir =
    detail?.status?.toLowerCase().includes("returning") === true ||
    detail?.next_episode_to_air != null

  const nextEpisodeDate = detail?.next_episode_to_air?.air_date ?? null

  return {
    tmdb_id: c.id,
    title: c.name || c.original_name,
    title_ko:
      c.original_name && c.original_name !== c.name ? c.original_name : null,
    original_name: detail?.original_name ?? c.original_name ?? null,
    genre: normalizeGenre(genreRaw),
    year,
    platform: platformName,
    poster_url: tmdbPosterUrl(c.poster_path),
    backdrop_path: tmdbBackdropUrl(detail?.backdrop_path ?? null),
    // TMDB vote_average 0~10 → 5점 척도 환산 (소수점 1자리)
    rating:
      detail?.vote_average != null
        ? Math.round((detail.vote_average / 2) * 10) / 10
        : null,
    overview: (detail?.overview ?? c.overview ?? "").slice(0, 1000) || null,
    episode_count: detail?.number_of_episodes ?? null,
    number_of_episodes: detail?.number_of_episodes ?? null,
    number_of_seasons: detail?.number_of_seasons ?? null,
    last_air_date: detail?.last_air_date ?? null,
    status: mapTmdbStatus(detail?.status),
    popularity: detail?.popularity ?? c.popularity ?? null,
    networks,
    cast_members: castMembers,
    trailer_key: trailerKey,
    watch_providers: watchProviders,
    next_episode_date: nextEpisodeDate,
    on_the_air: onTheAir,
    is_active: true,
  }
}

export async function runDramaIngest(): Promise<DramaIngestResult> {
  // 1. 후보 수집 — 인기순 1~3 페이지(KR 60건) + top_rated 1~2 페이지(필터 후 ≈10~20건)
  const sources = await Promise.allSettled([
    fetchKoreanDramasByPopularity(1),
    fetchKoreanDramasByPopularity(2),
    fetchKoreanDramasByPopularity(3),
    fetchTopRatedKoreanDramas(1),
    fetchTopRatedKoreanDramas(2),
  ])

  const all: TmdbTvShow[] = []
  for (const r of sources) {
    if (r.status === "fulfilled") all.push(...r.value)
  }

  // 2. tmdb_id 중복 제거
  const dedup = new Map<number, TmdbTvShow>()
  for (const d of all) {
    if (!dedup.has(d.id)) dedup.set(d.id, d)
  }
  const candidates = Array.from(dedup.values())

  if (candidates.length === 0) {
    return {
      source: "tmdb-dramas",
      scanned: 0,
      upserted: 0,
      calendarLinked: 0,
      note: "TMDB 응답 0건 — API 키·네트워크 확인 필요",
    }
  }

  // 3. 장르 매핑 + 상세 조회 (expanded=true — append_to_response 활용)
  const genreMap = await fetchTvGenreMap()
  void genreMap

  // 동시 6개로 제한 (TMDB rate ≈40 req/s 충분 여유)
  const CONCURRENCY = 6
  const details = new Map<number, TmdbTvDetail | null>()
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const slice = candidates.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      slice.map(async (c) => ({
        id: c.id,
        detail: await fetchTvDetail(c.id, { expanded: true }),
      }))
    )
    for (const r of results) {
      if (r.status === "fulfilled") details.set(r.value.id, r.value.detail)
    }
  }

  // 4. upsert row 변환
  const rows: DramaUpsertRow[] = candidates.map((c) =>
    buildRow(c, details.get(c.id) ?? null)
  )

  // 5. upsert
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("dramas")
    .upsert(rows, { onConflict: "tmdb_id", ignoreDuplicates: false })
    .select("id, title, calendar_event_id")

  if (error) {
    console.error("[ingest-dramas] upsert 실패:", error)
    return {
      source: "tmdb-dramas",
      scanned: candidates.length,
      upserted: 0,
      calendarLinked: 0,
      error: error.message,
      details: error.details ?? undefined,
      hint: error.hint ?? undefined,
      code: error.code ?? undefined,
    }
  }

  // 6. 캘린더 자동 매핑 — source_api='tmdb' + title ILIKE artist_or_drama
  // 매칭 기준: dramas.title 가 hallyu_calendar_events.artist_or_drama 와 대소문자 무시 일치
  // 기존에 calendar_event_id 가 이미 있는 row 는 skip (수동 매핑 보존)
  const upsertedRows = (data ?? []) as Array<{
    id: string
    title: string
    calendar_event_id: string | null
  }>
  const needsLinking = upsertedRows.filter((r) => !r.calendar_event_id)

  let calendarLinked = 0
  if (needsLinking.length > 0) {
    // tmdb source 캘린더 이벤트 1회 조회 후 메모리에서 매칭 (개별 ILIKE 쿼리 부하 회피)
    const { data: events, error: eventsError } = await supabase
      .from("hallyu_calendar_events")
      .select("id, artist_or_drama")
      .eq("source_api", "tmdb")

    if (eventsError) {
      console.warn("[ingest-dramas] calendar mapping 조회 실패:", eventsError)
    } else if (events) {
      // 정규화 키 — lowercase + trim
      const norm = (s: string) => s.trim().toLowerCase()
      const eventMap = new Map<string, string>()
      for (const e of events as Array<{ id: string; artist_or_drama: string }>) {
        eventMap.set(norm(e.artist_or_drama), e.id)
      }

      const updates: Array<{ id: string; calendar_event_id: string }> = []
      for (const r of needsLinking) {
        const evId = eventMap.get(norm(r.title))
        if (evId) updates.push({ id: r.id, calendar_event_id: evId })
      }

      if (updates.length > 0) {
        // upsert 로 batch update (id 기준, 다른 컬럼 건드리지 않음)
        const { error: updateError } = await supabase
          .from("dramas")
          .upsert(updates, { onConflict: "id" })

        if (updateError) {
          console.warn("[ingest-dramas] calendar_event_id 백필 실패:", updateError)
        } else {
          calendarLinked = updates.length
        }
      }
    }
  }

  return {
    source: "tmdb-dramas",
    scanned: candidates.length,
    upserted: data?.length ?? 0,
    calendarLinked,
  }
}
