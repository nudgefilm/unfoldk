import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const revalidate = 3600

// GET /api/kpop/chart-attack/velocity
// kpop_stats_daily 의 어제/오늘 youtube_weekly_views 차이를 시간당 속도로 환산
// 상위 10명 반환 (속도 내림차순)
// 구현 노트: youtube_weekly_views 는 7일 롤링 합계.
//   오늘 - 어제 = 당일 신규 조회수 근사 (= 오늘 들어온 것 - 8일전 빠진 것)
//   / 24 → 시간당 속도 (proxy)

export interface VelocityItem {
  artist_id: string
  name: string
  name_ko: string | null
  thumbnail_url: string | null
  hourly_velocity: number       // 시간당 조회수 증가 (근사)
  daily_delta: number           // 어제 대비 일간 증가량
  gauge_pct: number             // 0~100: 최고 속도 기준 백분율
}

export async function GET() {
  const supabase = createSupabaseAdminClient()

  // 최근 2일 stats 조회
  const twoDaysAgo = new Date()
  twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2)

  const { data: statsData, error } = await supabase
    .from("kpop_stats_daily")
    .select(`
      artist_id, date, youtube_weekly_views,
      kpop_artists!inner(name, name_ko, thumbnail_url, is_active)
    `)
    .gte("date", twoDaysAgo.toISOString().slice(0, 10))
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

  // artist_id → 최신 / 이전 row 분리
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

  // delta 계산 — both days 있는 아티스트만
  const velocities: Array<{ id: string; name: string; name_ko: string | null; thumbnail_url: string | null; delta: number }> = []
  for (const [id, latest] of latestMap.entries()) {
    const prev = prevMap.get(id)
    if (!prev || latest.youtube_weekly_views === null || prev.youtube_weekly_views === null) continue
    const delta = latest.youtube_weekly_views - prev.youtube_weekly_views
    if (delta <= 0) continue  // 하락/정체는 velocity 표시 제외
    velocities.push({
      id,
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
