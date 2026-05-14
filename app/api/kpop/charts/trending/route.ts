import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// 공개 데이터 — auth 분기 없음. 응답에 Cache-Control 헤더 박제 (아래).

// /api/kpop/charts/trending — 오늘의 급상승 Top 5
//
// 산정: today.youtube_total_views - yesterday.youtube_total_views (per artist).
// "today" 는 가장 최근 ingest 한 날짜 (UTC 기준). "yesterday" 는 그 직전 날짜.
//   - 매일 cron(/api/cron/ingest-kpop-stats) 이 새 row 를 채워주는 전제.
//   - 같은 날짜 두 row 가 들어올 수는 없음 (artist_id, date unique).
//
// 데이터 부족 처리:
//   - kpop_stats_daily 에 today row 가 한 건도 없거나, today/yesterday 모두 있는 아티스트가
//     0명이면 trending: [] 반환. UI 가 "Coming soon" 표시.
//
// limit: 기본 5, max 10.

// 공개 데이터 + 일별 갱신 → edge 5분 + 10분 stale-while-revalidate.
// error 응답에는 적용 X (캐시 폭주 방지).
const TRENDING_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
} as const

interface ArtistRow {
  id: string
  name: string
  name_ko: string | null
  thumbnail_url: string | null
}

interface DailyRow {
  artist_id: string
  date: string
  youtube_total_views: number | null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limitRaw = Number(searchParams.get("limit") ?? 5)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 10) : 5

  const supabase = createSupabaseAdminClient()

  // 1) 가장 최근 stats 날짜 찾기 — "today" 정의
  const { data: latestDateData, error: latestErr } = await supabase
    .from("kpop_stats_daily")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestErr) {
    return NextResponse.json({ error: latestErr.message }, { status: 500 })
  }
  if (!latestDateData) {
    return NextResponse.json(
      { trending: [], generated_at: new Date().toISOString() },
      { headers: TRENDING_CACHE_HEADERS }
    )
  }

  const todayStr = (latestDateData as { date: string }).date

  // 2) today + yesterday 윈도우 stats — 최대 2일치만 (작은 결과셋)
  //    yesterday 는 일자 비교에서 today 보다 작은 가장 큰 date 한 개. 정확히 -1일이 아닐 수도 (cron 누락 등).
  //    "어제" 의미는 "직전 ingest 일" 이라고 운영 정의 — 자연스러움 우선.
  const twoDaysAgo = new Date(todayStr)
  twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 14) // 안전 윈도우 (장기 갭 대비)

  const { data: statsData, error: statsErr } = await supabase
    .from("kpop_stats_daily")
    .select("artist_id, date, youtube_total_views")
    .lte("date", todayStr)
    .gte("date", twoDaysAgo.toISOString().slice(0, 10))
    .order("date", { ascending: false })

  if (statsErr) {
    return NextResponse.json({ error: statsErr.message }, { status: 500 })
  }

  const stats = (statsData ?? []) as DailyRow[]

  // 3) artist_id 별 today / yesterday 추출
  //    today = date === todayStr, yesterday = today 보다 작은 가장 큰 date.
  const todayMap = new Map<string, number>()
  const yesterdayMap = new Map<string, number>()
  for (const s of stats) {
    if (s.youtube_total_views === null) continue
    if (s.date === todayStr) {
      todayMap.set(s.artist_id, Number(s.youtube_total_views))
    } else if (!yesterdayMap.has(s.artist_id)) {
      // 이미 desc 정렬이라 today 다음 first 가 직전 가장 가까운 날
      yesterdayMap.set(s.artist_id, Number(s.youtube_total_views))
    }
  }

  // 4) delta 계산 + 활성 아티스트 정보 매핑
  const deltas: Array<{ artist_id: string; views_delta: number; total_views: number }> = []
  for (const [artistId, today] of todayMap.entries()) {
    const yesterday = yesterdayMap.get(artistId)
    if (yesterday === undefined) continue
    const delta = today - yesterday
    if (delta <= 0) continue // 0/음수는 trending 아님
    deltas.push({ artist_id: artistId, views_delta: delta, total_views: today })
  }

  if (deltas.length === 0) {
    return NextResponse.json(
      { trending: [], generated_at: new Date().toISOString() },
      { headers: TRENDING_CACHE_HEADERS }
    )
  }

  // 5) 활성 아티스트 메타
  const artistIds = deltas.map((d) => d.artist_id)
  const { data: artistsData, error: artistsErr } = await supabase
    .from("kpop_artists")
    .select("id, name, name_ko, thumbnail_url")
    .in("id", artistIds)
    .eq("is_active", true)

  if (artistsErr) {
    return NextResponse.json({ error: artistsErr.message }, { status: 500 })
  }
  const artistMap = new Map(
    ((artistsData ?? []) as ArtistRow[]).map((a) => [a.id, a])
  )

  // 6) Top N 구성 — delta desc
  const trending = deltas
    .filter((d) => artistMap.has(d.artist_id))
    .sort((a, b) => b.views_delta - a.views_delta)
    .slice(0, limit)
    .map((d, i) => {
      const a = artistMap.get(d.artist_id)!
      return {
        rank: i + 1,
        artist_id: a.id,
        name: a.name,
        name_ko: a.name_ko,
        thumbnail_url: a.thumbnail_url,
        views_delta: d.views_delta,
        total_views: d.total_views,
      }
    })

  return NextResponse.json(
    {
      trending,
      generated_at: new Date().toISOString(),
      today: todayStr,
    },
    { headers: TRENDING_CACHE_HEADERS }
  )
}
