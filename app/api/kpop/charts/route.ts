import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// 공개 데이터 (kpop_stats_daily) — auth 분기 없음. 응답에 Cache-Control 헤더 박제 (아래).
// revalidate = 300 — Next.js Route Segment Config 로 명시적 ISR.
// Cache-Control 헤더만으론 request.url+searchParams 접근 시 Next.js 가 dynamic 처리해
// Vercel CDN 캐시 활성 안 됨 (x-vercel-cache: MISS). revalidate 명시로 강제 캐시.
export const revalidate = 300

// /api/kpop/charts — 글로벌 주간 순위
//
// 정렬 기준: 가장 최근 stats 의 youtube_weekly_views DESC (null 은 후순위).
// 변동(change): 7일전 stats 와 weekly_views 비교해 rank 변동 ±N 형태로 노출.
//
// 쿼리:
//   - limit?: 기본 10, max 50

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

interface ArtistRow {
  id: string
  name: string
  name_ko: string | null
  thumbnail_url: string | null
}

interface StatsRow {
  artist_id: string
  date: string
  youtube_total_views: number | null
  youtube_weekly_views: number | null
  lastfm_listeners: number | null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    limit: searchParams.get("limit") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const limit = parsed.data.limit ?? 10

  const supabase = createSupabaseAdminClient()

  // 1. 활성 아티스트 목록
  const { data: artistsData, error: artistsErr } = await supabase
    .from("kpop_artists")
    .select("id, name, name_ko, thumbnail_url")
    .eq("is_active", true)

  if (artistsErr) {
    return NextResponse.json({ error: artistsErr.message }, { status: 500 })
  }

  const artists = (artistsData ?? []) as ArtistRow[]
  if (artists.length === 0) {
    return NextResponse.json({ chart: [], generated_at: new Date().toISOString() })
  }

  const artistIds = artists.map((a) => a.id)
  const artistMap = new Map(artists.map((a) => [a.id, a]))

  // 2. 모든 활성 아티스트의 최근 30일 stats 조회 — 메모리에서 정렬
  //    (PostgreSQL DISTINCT ON 이 ideal 이지만 Supabase JS 클라에서 까다로워 client side 정리)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30)

  const { data: statsData } = await supabase
    .from("kpop_stats_daily")
    .select("artist_id, date, youtube_total_views, youtube_weekly_views, lastfm_listeners")
    .in("artist_id", artistIds)
    .gte("date", thirtyDaysAgo.toISOString().slice(0, 10))
    .order("date", { ascending: false })

  const allStats = (statsData ?? []) as StatsRow[]

  // artist_id → [최신 row, 7일전 row]
  const latestMap = new Map<string, StatsRow>()
  const olderMap = new Map<string, StatsRow>()
  for (const s of allStats) {
    if (!latestMap.has(s.artist_id)) {
      latestMap.set(s.artist_id, s)
    } else if (!olderMap.has(s.artist_id)) {
      // 최신 row 의 date 와 6일 이상 차이나는 첫 row 를 "이전 주" 비교용으로
      const latestDate = latestMap.get(s.artist_id)!.date
      const dayDiff =
        (new Date(latestDate).getTime() - new Date(s.date).getTime()) /
        (1000 * 60 * 60 * 24)
      if (dayDiff >= 6) {
        olderMap.set(s.artist_id, s)
      }
    }
  }

  // 3. weekly_views 기준 현재 순위
  const ranked = artists
    .map((a) => {
      const latest = latestMap.get(a.id)
      return {
        artist: a,
        latest: latest ?? null,
        weekly: latest?.youtube_weekly_views ?? null,
      }
    })
    .sort((a, b) => {
      const av = a.weekly ?? -1                           // null 은 후순위
      const bv = b.weekly ?? -1
      return bv - av
    })

  // 4. 7일전 weekly_views 기준 이전 순위 → change 계산
  const previousRanked = artists
    .map((a) => {
      const older = olderMap.get(a.id)
      return {
        artistId: a.id,
        weekly: older?.youtube_weekly_views ?? null,
      }
    })
    .sort((a, b) => {
      const av = a.weekly ?? -1
      const bv = b.weekly ?? -1
      return bv - av
    })

  const previousRankMap = new Map<string, number>()
  previousRanked.forEach((r, i) => previousRankMap.set(r.artistId, i + 1))

  // 5. 결과 구성
  const chart = ranked.slice(0, limit).map((r, i) => {
    const currentRank = i + 1
    const previousRank = previousRankMap.get(r.artist.id)
    const change =
      previousRank !== undefined && r.latest && olderMap.has(r.artist.id)
        ? previousRank - currentRank                       // +면 상승, -면 하락
        : null

    return {
      rank: currentRank,
      artist_id: r.artist.id,
      name: r.artist.name,
      name_ko: r.artist.name_ko,
      thumbnail_url: r.artist.thumbnail_url,
      youtube_total_views: r.latest?.youtube_total_views ?? null,
      youtube_weekly_views: r.weekly,
      lastfm_listeners: r.latest?.lastfm_listeners ?? null,
      rank_change: change,
    }
  })

  return NextResponse.json(
    { chart, generated_at: new Date().toISOString() },
    {
      // 공개 데이터, 일별 갱신 → edge 5분 + 10분 stale-while-revalidate.
      // 콜드 트래픽 비용·지연 감소. 새 데이터는 cron 다음 실행 후 5분 내 자연 전파.
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  )
}
