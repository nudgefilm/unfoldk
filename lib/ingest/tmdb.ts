// TMDB 인기 한국 드라마 → 'drama' 이벤트 인제스트 로직
// 라우트(ingest-tmdb, ingest-all) 양쪽에서 import 해 재사용

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  fetchPopularKoreanDramas,
  fetchWatchProvidersUs,
  tmdbPosterUrl,
} from "@/lib/api/tmdb"
import { generateEventDescription } from "@/lib/claude/generate-event-description"

export interface TmdbIngestResult {
  source: "tmdb"
  scanned: number
  upserted: number
  // Watch Now URL (watch/providers US) 통계 — null 비율 높으면 UI 에서 버튼이 안 보이는 게 정상.
  // 한국 드라마 신작은 US OTT 미정 케이스 많음 (정상 동작).
  with_watch_url?: number
  without_watch_url?: number
  error?: string
  details?: string
  hint?: string
  code?: string
  note?: string
}

export async function runTmdbIngest(): Promise<TmdbIngestResult> {
  // 1~2 페이지 (인기 40개) 가져오기
  const [page1, page2] = await Promise.all([
    fetchPopularKoreanDramas(1),
    fetchPopularKoreanDramas(2),
  ])
  const dramas = [...page1, ...page2]

  // 수집 윈도우: 최근 90일 ~ 향후 30일 first_air_date.
  // - 미래 30일: 곧 방영 예정 (premiere)
  // - 과거 90일: 현재 방영 중 가능성 높음 (한국 드라마 표준 시즌 16~24화 ≒ 2~3개월).
  //   인기순 정렬이라 이 구간이 대부분 "방영 중" 인기작.
  //   정확한 방영 상태 확인은 tv detail call 필요하지만 비용 절감 위해 휴리스틱 채택.
  // - 더 정확히 가려면 추후 tv/{id} detail 의 next_episode_to_air 로 분기 (TODO).
  const todayUtc = new Date()
  todayUtc.setUTCHours(0, 0, 0, 0)
  const windowStart = new Date(todayUtc)
  windowStart.setUTCDate(windowStart.getUTCDate() - 90)
  const windowEnd = new Date(todayUtc)
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 30)

  const baseRows = dramas
    .filter((d) => {
      if (!d.first_air_date || !/^\d{4}-\d{2}-\d{2}$/.test(d.first_air_date)) return false
      const dt = new Date(d.first_air_date)
      return dt >= windowStart && dt <= windowEnd
    })
    .map((d) => {
      const firstAir = new Date(d.first_air_date)
      const isFuture = firstAir >= todayUtc
      // 과거 first_air_date = 이미 시작한 드라마 → "Now Airing", 미래 → "Premiere".
      // event_date 는 그대로 first_air_date (KST 21시) — 캘린더에서 방영 시작일 흔적으로 노출.
      const titleSuffix = isFuture ? "Premiere" : "Now Airing"
      return {
        type: "drama" as const,
        title: `${d.name} — ${titleSuffix}`,
        artist_or_drama: d.name,
        // first_air_date 는 날짜만 — KST 21시 (드라마 정규 시간) 으로 가정
        event_date: new Date(`${d.first_air_date}T21:00:00+09:00`).toISOString(),
        event_time_label: "9:00 PM KST",
        // 1차 fallback — Claude 실패 시 TMDB overview 를 description 으로 사용
        _tmdb_overview: d.overview?.slice(0, 500) || null,
        source_api: "tmdb",
        source_id: String(d.id),
        thumbnail_url: tmdbPosterUrl(d.poster_path),
        is_premium: false,
      }
    })

  if (baseRows.length === 0) {
    return {
      source: "tmdb",
      scanned: dramas.length,
      upserted: 0,
      note: "first_air_date 가 윈도우(-90d ~ +30d) 매칭 없음",
    }
  }

  const supabase = createSupabaseAdminClient()

  // 기존 description 사전 조회 — 이미 채워진 이벤트는 Claude 호출 skip
  // (cron 매 실행마다 같은 이벤트에 대해 Claude 재호출되는 비용 누수 차단)
  const sourceIds = baseRows.map((r) => r.source_id)
  const { data: existingRows } = await supabase
    .from("hallyu_calendar_events")
    .select("source_id, description")
    .eq("source_api", "tmdb")
    .in("source_id", sourceIds)

  const existingDescMap = new Map<string, string | null>()
  for (const row of (existingRows ?? []) as Array<{
    source_id: string
    description: string | null
  }>) {
    existingDescMap.set(row.source_id, row.description)
  }

  // Claude Haiku 로 한 줄 설명 병렬 생성 + Watch Now 링크 (TMDB watch/providers US)
  // - 기존 description 이 비어있지 않으면 호출 skip + 기존 값 유지
  // - 신규 이벤트 또는 description 비어있는 경우만 호출
  // - Claude 실패 시 TMDB overview fallback
  // - watch/providers 는 매번 호출 (provider 변동 추적). 비어 있으면 null → UI 에서 버튼 미노출.
  //   url 컬럼은 Ticketmaster(Get Tickets)·TMDB(Watch Now) 가 source_api 가드로 격리해 공유.
  const rows = await Promise.all(
    baseRows.map(async ({ _tmdb_overview, ...row }) => {
      const tmdbId = Number(row.source_id)
      const watchUrlPromise = Number.isFinite(tmdbId)
        ? fetchWatchProvidersUs(tmdbId)
        : Promise.resolve(null)

      const existingDesc = existingDescMap.get(row.source_id)
      const descriptionPromise =
        existingDesc && existingDesc.trim().length > 0
          ? Promise.resolve(existingDesc)
          : generateEventDescription(row.title, row.artist_or_drama, row.type).then(
              (ai) => ai ?? _tmdb_overview
            )

      const [description, watchUrl] = await Promise.all([
        descriptionPromise,
        watchUrlPromise,
      ])
      return { ...row, description, url: watchUrl }
    })
  )

  // Watch URL 통계 — 디버깅용. 0/전체 면 fetchWatchProvidersUs 가 모두 null 반환 (US provider 없거나 토큰 문제).
  let withWatchUrl = 0
  let withoutWatchUrl = 0
  for (const r of rows) {
    if (r.url) withWatchUrl++
    else withoutWatchUrl++
  }
  const { data, error } = await supabase
    .from("hallyu_calendar_events")
    .upsert(rows, { onConflict: "source_api,source_id", ignoreDuplicates: false })
    .select("id")

  if (error) {
    console.error("[ingest-tmdb] upsert 실패:", error)
    return {
      source: "tmdb",
      scanned: dramas.length,
      upserted: 0,
      with_watch_url: withWatchUrl,
      without_watch_url: withoutWatchUrl,
      error: error.message,
      details: error.details ?? undefined,
      hint: error.hint ?? undefined,
      code: error.code ?? undefined,
    }
  }

  return {
    source: "tmdb",
    with_watch_url: withWatchUrl,
    without_watch_url: withoutWatchUrl,
    scanned: dramas.length,
    upserted: data?.length ?? 0,
  }
}
