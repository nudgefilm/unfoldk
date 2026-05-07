import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { fetchPopularKoreanDramas, tmdbPosterUrl } from "@/lib/api/tmdb"

// Vercel function 최대 실행 시간 (Hobby 60s, Pro 300s)
export const maxDuration = 60
export const dynamic = "force-dynamic"

// TMDB 인기 한국 드라마 → 'drama' 이벤트 생성 (premiere 위주)
// 이미 있는 source_id 는 upsert 로 갱신 (중복 인제스트 방지)
export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  try {
    // 1~2 페이지 (인기 40개) 가져오기
    const [page1, page2] = await Promise.all([
      fetchPopularKoreanDramas(1),
      fetchPopularKoreanDramas(2),
    ])
    const dramas = [...page1, ...page2]

    // 오늘 0시 (UTC) 이후 first_air_date 만 — 이미 끝난 드라마 제외
    const todayUtc = new Date()
    todayUtc.setUTCHours(0, 0, 0, 0)

    const rows = dramas
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
        description: d.overview?.slice(0, 500) || null,
        source_api: "tmdb",
        source_id: String(d.id),
        thumbnail_url: tmdbPosterUrl(d.poster_path),
        is_premium: false,
      }))

    if (rows.length === 0) {
      return NextResponse.json({
        source: "tmdb",
        scanned: dramas.length,
        upserted: 0,
        note: "future first_air_date 매칭 없음",
      })
    }

    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from("hallyu_calendar_events")
      .upsert(rows, { onConflict: "source_api,source_id", ignoreDuplicates: false })
      .select("id")

    if (error) {
      return NextResponse.json(
        { source: "tmdb", error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      source: "tmdb",
      scanned: dramas.length,
      upserted: data?.length ?? 0,
    })
  } catch (err) {
    return NextResponse.json(
      {
        source: "tmdb",
        error: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 }
    )
  }
}
