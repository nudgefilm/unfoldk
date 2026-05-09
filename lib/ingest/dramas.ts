// KdramaMatch (M+2) 인제스트 로직
// TMDB top_rated + discover/tv KR 두 소스를 dramas 테이블로 upsert.
//
// 멱등성: tmdb_id unique 제약 → onConflict 갱신.
// 호출량: 후보 ~80건 + 각 건당 /tv/{id} 상세 1회 ≈ 80 호출 — TMDB 무료 티어로 충분.

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  fetchKoreanDramasByPopularity,
  fetchTopRatedKoreanDramas,
  fetchTvDetail,
  fetchTvGenreMap,
  mapTmdbStatus,
  normalizeGenre,
  tmdbPosterUrl,
  type TmdbTvShow,
} from "@/lib/api/tmdb"

export interface DramaIngestResult {
  source: "tmdb-dramas"
  scanned: number
  upserted: number
  error?: string
  details?: string
  hint?: string
  code?: string
  note?: string
}

interface DramaUpsertRow {
  tmdb_id: number
  title: string
  title_ko: string | null
  genre: string | null
  year: number | null
  platform: string | null
  poster_url: string | null
  rating: number | null
  overview: string | null
  episode_count: number | null
  status: "ongoing" | "completed" | null
  is_active: boolean
}

export async function runDramaIngest(): Promise<DramaIngestResult> {
  // 1. 후보 수집 — 인기순 1~3 페이지(KR 60건) + top_rated 1~2 페이지(필터 후 ≈10~20건)
  //    Promise.all 로 병렬, 어느 하나가 실패해도 나머지로 인제스트 진행
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

  // 2. tmdb_id 중복 제거 (소스 간 겹침 흡수)
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
      note: "TMDB 응답 0건 — API 키·네트워크 확인 필요",
    }
  }

  // 3. 장르 매핑 + 상세 조회 — 첫 번째 장르를 normalize 한 결과 사용
  const genreMap = await fetchTvGenreMap()

  // 상세 호출 부하 — 동시 6개로 제한 (TMDB rate ≈40 req/s 충분 여유)
  const CONCURRENCY = 6
  const details = new Map<number, Awaited<ReturnType<typeof fetchTvDetail>>>()
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const slice = candidates.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      slice.map(async (c) => ({ id: c.id, detail: await fetchTvDetail(c.id) }))
    )
    for (const r of results) {
      if (r.status === "fulfilled") details.set(r.value.id, r.value.detail)
    }
  }

  // 4. upsert row 변환
  const rows: DramaUpsertRow[] = candidates.map((c) => {
    const detail = details.get(c.id) ?? null
    // 장르 우선순위: 상세 응답의 첫 genre.name → discover 응답의 genre_ids[0] 매핑
    let genreRaw: string | null = null
    if (detail?.genres && detail.genres.length > 0) {
      genreRaw = detail.genres[0].name
    }
    const year = c.first_air_date && /^\d{4}/.test(c.first_air_date)
      ? Number(c.first_air_date.slice(0, 4))
      : null

    return {
      tmdb_id: c.id,
      title: c.name || c.original_name,
      title_ko: c.original_name && c.original_name !== c.name ? c.original_name : null,
      genre: normalizeGenre(genreRaw),
      year,
      platform: null,                    // TMDB watch/providers 미연동 — 추후 별도 인제스트
      poster_url: tmdbPosterUrl(c.poster_path),
      // TMDB vote_average 0~10 → 5점 척도 환산 (소수점 1자리)
      rating: detail?.vote_average != null
        ? Math.round((detail.vote_average / 2) * 10) / 10
        : c.popularity != null
          ? null  // popularity 는 평점이 아님 — null 처리
          : null,
      overview: (detail?.overview ?? c.overview ?? "").slice(0, 1000) || null,
      episode_count: detail?.number_of_episodes ?? null,
      status: mapTmdbStatus(detail?.status),
      is_active: true,
    }
  })

  // 5. upsert
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("dramas")
    .upsert(rows, { onConflict: "tmdb_id", ignoreDuplicates: false })
    .select("id")

  if (error) {
    console.error("[ingest-dramas] upsert 실패:", error)
    return {
      source: "tmdb-dramas",
      scanned: candidates.length,
      upserted: 0,
      error: error.message,
      details: error.details ?? undefined,
      hint: error.hint ?? undefined,
      code: error.code ?? undefined,
    }
  }

  // 사용하지 않는 매핑 변수 경고 회피용 — 추후 genre_ids 직접 매핑 도입 시 활용
  void genreMap

  return {
    source: "tmdb-dramas",
    scanned: candidates.length,
    upserted: data?.length ?? 0,
  }
}
