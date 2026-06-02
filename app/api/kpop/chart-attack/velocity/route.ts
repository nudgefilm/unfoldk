import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const revalidate = 3600

// GET /api/kpop/chart-attack/velocity
// "Global Chart Top 20" 기준 시간당 가속 — Charts 탭과 동일한 아티스트 모수
//
// 흐름:
//   1. 최근 2일 kpop_stats_daily 조회 (활성 아티스트 전체)
//   2. 아티스트별 최신 youtube_weekly_views 기준 TOP 20 선별
//      → Charts 탭 "Global Chart — Top 20 this week"와 동일한 모수
//      → 이미 YouTube 채널이 확인된 아티스트만 포함됨
//   3. 그 20명 중 daily delta (오늘 - 어제 youtube_weekly_views) 계산
//   4. delta > 0 기준 내림차순 → TOP 10 반환
//
// 왜 Top 20 기준인가:
//   차트 상위 아티스트 = YouTube 채널 매핑이 검증된 아티스트.
//   전체 아티스트 대상으로 하면 채널 미매핑·오매핑 아티스트가 섞임.

export interface VelocityItem {
  artist_id: string
  name: string
  name_ko: string | null
  thumbnail_url: string | null
  hourly_velocity: number   // daily_delta / 24 (시간당 근사)
  daily_delta: number       // 오늘 - 어제 youtube_weekly_views
  gauge_pct: number         // 0~100: 이 배치 최고 delta 대비 비율
}

export async function GET() {
  const supabase = createSupabaseAdminClient()

  // 최근 2일 stats — youtube_weekly_views가 있는 활성 아티스트
  const twoDaysAgo = new Date()
  twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2)

  const { data: statsData, error } = await supabase
    .from("kpop_stats_daily")
    .select(`
      artist_id, date, youtube_weekly_views,
      kpop_artists!inner(name, name_ko, thumbnail_url, is_active)
    `)
    .gte("date", twoDaysAgo.toISOString().slice(0, 10))
    .not("youtube_weekly_views", "is", null)
    .order("date", { ascending: false })

  if (error) {
    console.error("[chart-attack/velocity]", error.message)
    return NextResponse.json({ items: [] })
  }

  type Row = {
    artist_id: string
    date: string
    youtube_weekly_views: number | null
    kpop_artists: { name: string; name_ko: string | null; thumbnail_url: string | null; is_active: boolean } | null
  }
  const rows = (statsData ?? []) as unknown as Row[]

  // 아티스트별 최신·이전 row 분리
  const latestMap = new Map<string, Row>()
  const prevMap = new Map<string, Row>()

  for (const r of rows) {
    if (!r.kpop_artists?.is_active) continue
    if (!latestMap.has(r.artist_id)) {
      latestMap.set(r.artist_id, r)
    } else if (!prevMap.has(r.artist_id)) {
      prevMap.set(r.artist_id, r)
    }
  }

  // Step 1: 최신 youtube_weekly_views 기준 TOP 20 아티스트 선별
  //         = Charts 탭 "Global Chart — Top 20 this week"와 동일한 모수
  const chartTop20 = [...latestMap.entries()]
    .filter(([, r]) => r.youtube_weekly_views !== null)
    .sort((a, b) => (b[1].youtube_weekly_views ?? 0) - (a[1].youtube_weekly_views ?? 0))
    .slice(0, 20)
    .map(([id]) => id)

  const chartTop20Set = new Set(chartTop20)

  // Step 2: Top 20 중 daily delta 계산
  const velocities: Array<{
    id: string
    name: string
    name_ko: string | null
    thumbnail_url: string | null
    delta: number
  }> = []

  for (const artistId of chartTop20) {
    if (!chartTop20Set.has(artistId)) continue
    const latest = latestMap.get(artistId)
    const prev = prevMap.get(artistId)
    if (!latest || !prev) continue
    if (latest.youtube_weekly_views === null || prev.youtube_weekly_views === null) continue

    const delta = latest.youtube_weekly_views - prev.youtube_weekly_views
    if (delta <= 0) continue  // 하락·정체 제외

    velocities.push({
      id: artistId,
      name: latest.kpop_artists!.name,
      name_ko: latest.kpop_artists!.name_ko,
      thumbnail_url: latest.kpop_artists!.thumbnail_url,
      delta,
    })
  }

  velocities.sort((a, b) => b.delta - a.delta)
  const top10 = velocities.slice(0, 10)
  const maxDelta = top10[0]?.delta ?? 1

  const items: VelocityItem[] = top10.map(v => ({
    artist_id: v.id,
    name: v.name,
    name_ko: v.name_ko,
    thumbnail_url: v.thumbnail_url,
    hourly_velocity: Math.round(v.delta / 24),
    daily_delta: v.delta,
    gauge_pct: Math.round((v.delta / maxDelta) * 100),
  }))

  return NextResponse.json({ items, generated_at: new Date().toISOString() })
}
