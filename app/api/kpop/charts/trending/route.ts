import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// 공개 데이터 — auth 분기 없음. 응답에 Cache-Control 헤더 박제 (아래).

// /api/kpop/charts/trending — 오늘의 급상승 Top 5
//
// 산정 (3단계 fallback):
//   1. 2일치 있음 → today.total_views - yesterday.total_views > 0 인 행 desc Top N (정확한 급상승)
//   2. 1일치만 있음 → today.total_views desc Top N, views_delta:null (비교 데이터 없음, 현재 조회수 기준)
//   3. 0일치 → trending:[] (UI "Coming soon")
//
// "today" = 가장 최근 ingest 날짜 (UTC). "yesterday" = today 직전 날짜.
//   - 매일 cron(/api/cron/ingest-kpop-stats) 이 새 row 를 채워주는 전제.
//   - 같은 날짜 두 row 는 없음 (artist_id, date unique).
//
// limit: 기본 5, max 10.

// 공개 데이터 + 일별 갱신 (cron 1회/일) → 24시간 캐시.
// revalidate 짧으면 캐시 만료 시 재계산되어 일시적 빈 결과로 데이터가 "사라지는" 듯 보임.
// 당일 ingest 된 데이터를 다음 날 새 cron 까지 유지하려면 86400(24h) 가 안전.
// Route Segment Config 의 revalidate 도 함께 박제 (Cache-Control 헤더만으론 request.url 사용 시 dynamic 처리됨).
// 후속: cron 종료 시 revalidateTag/revalidatePath 로 즉시 무효화하면 새 데이터 지연 0 가능.
// error 응답에는 적용 X (캐시 폭주 방지).
export const revalidate = 86400

const TRENDING_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
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

  // 4) delta 계산 + 1일치 fallback 결정
  type Candidate = { artist_id: string; views_delta: number | null; total_views: number }
  const deltas: Candidate[] = []
  for (const [artistId, today] of todayMap.entries()) {
    const yesterday = yesterdayMap.get(artistId)
    if (yesterday === undefined) continue
    const delta = today - yesterday
    if (delta <= 0) continue // 0/음수는 trending 아님
    deltas.push({ artist_id: artistId, views_delta: delta, total_views: today })
  }

  // 3단계 fallback — 사용자 요청 (1일치만 있어도 노출).
  let candidates: Candidate[]
  if (deltas.length > 0) {
    // 2일치 있음 — delta desc
    candidates = deltas.sort((a, b) => (b.views_delta ?? 0) - (a.views_delta ?? 0))
  } else if (todayMap.size > 0) {
    // 1일치만 — total_views desc, delta 는 null 로 비교 부재 표시
    candidates = Array.from(todayMap.entries())
      .map(([artist_id, total_views]) => ({
        artist_id,
        views_delta: null,
        total_views,
      }))
      .sort((a, b) => b.total_views - a.total_views)
  } else {
    // 0일치 — UI 에서 Coming soon
    return NextResponse.json(
      { trending: [], generated_at: new Date().toISOString() },
      { headers: TRENDING_CACHE_HEADERS }
    )
  }

  // 5) 활성 아티스트 메타
  const artistIds = candidates.map((c) => c.artist_id)
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

  // 6) Top N 구성 — candidates 이미 정렬됨
  const trending = candidates
    .filter((c) => artistMap.has(c.artist_id))
    .slice(0, limit)
    .map((c, i) => {
      const a = artistMap.get(c.artist_id)!
      return {
        rank: i + 1,
        artist_id: a.id,
        name: a.name,
        name_ko: a.name_ko,
        thumbnail_url: a.thumbnail_url,
        views_delta: c.views_delta,
        total_views: c.total_views,
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
