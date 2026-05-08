// TMDB 인기 한국 드라마 → 'drama' 이벤트 인제스트 로직
// 라우트(ingest-tmdb, ingest-all) 양쪽에서 import 해 재사용

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { fetchPopularKoreanDramas, tmdbPosterUrl } from "@/lib/api/tmdb"
import { generateEventDescription } from "@/lib/claude/generate-event-description"

export interface TmdbIngestResult {
  source: "tmdb"
  scanned: number
  upserted: number
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

  // 오늘 0시 (UTC) 이후 first_air_date 만 — 이미 끝난 드라마 제외
  const todayUtc = new Date()
  todayUtc.setUTCHours(0, 0, 0, 0)

  const baseRows = dramas
    .filter(
      (d) =>
        d.first_air_date &&
        /^\d{4}-\d{2}-\d{2}$/.test(d.first_air_date) &&
        new Date(d.first_air_date) >= todayUtc
    )
    .map((d) => ({
      type: "drama" as const,
      title: `${d.name} — Premiere`,
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
    }))

  // Claude Haiku 로 한 줄 설명 병렬 생성 — 실패 시 TMDB overview fallback
  const rows = await Promise.all(
    baseRows.map(async ({ _tmdb_overview, ...row }) => {
      const aiDescription = await generateEventDescription(
        row.title,
        row.artist_or_drama,
        row.type
      )
      return { ...row, description: aiDescription ?? _tmdb_overview }
    })
  )

  if (rows.length === 0) {
    return {
      source: "tmdb",
      scanned: dramas.length,
      upserted: 0,
      note: "future first_air_date 매칭 없음",
    }
  }

  const supabase = createSupabaseAdminClient()
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
      error: error.message,
      details: error.details ?? undefined,
      hint: error.hint ?? undefined,
      code: error.code ?? undefined,
    }
  }

  return {
    source: "tmdb",
    scanned: dramas.length,
    upserted: data?.length ?? 0,
  }
}
