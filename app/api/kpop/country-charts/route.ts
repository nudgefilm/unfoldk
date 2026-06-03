import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// GET /api/kpop/country-charts — 국가별 Top 3 K팝 아티스트 (최신 수집일 기준)
// 20개국 고정 반환. DB 데이터 없는 국가는 artists: [] 로 채워 카드 표시.
export const dynamic = "force-dynamic"
export const revalidate = 3600

// 프론트와 동기화된 20개국 고정 리스트
const FIXED_COUNTRIES = [
  "US", "CA", "MX", "BR", "AR", "CL", "PE",
  "PH", "ID", "TH", "MY", "VN", "SG", "IN",
  "JP", "GB", "FR", "DE", "TR", "AU",
] as const

export interface CountryChartEntry {
  country_code: string
  artists: Array<{ artist_id: string | null; artist_name: string; rank: number; listeners: number | null }>
}

export async function GET() {
  const admin = createSupabaseAdminClient()

  // 최신 week_start
  const { data: latest } = await admin
    .from("kpop_country_charts")
    .select("week_start")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latest) {
    // DB 데이터 없음 — 20개국 전체를 빈 아티스트로 반환
    const emptyCharts = FIXED_COUNTRIES.map((code) => ({ country_code: code, artists: [] }))
    return NextResponse.json({ charts: emptyCharts })
  }

  const { data, error } = await admin
    .from("kpop_country_charts")
    .select("country_code, artist_id, artist_name, rank, listeners")
    .eq("week_start", latest.week_start)
    .order("rank", { ascending: true })

  if (error) {
    console.error("[/api/kpop/country-charts]", error.message)
    return NextResponse.json({ charts: [] })
  }

  type Row = {
    country_code: string
    artist_id: string | null
    artist_name: string
    rank: number
    listeners: number | null
  }

  // 국가별로 그룹핑
  const grouped = new Map<string, CountryChartEntry>()
  for (const r of (data ?? []) as Row[]) {
    if (!grouped.has(r.country_code)) {
      grouped.set(r.country_code, { country_code: r.country_code, artists: [] })
    }
    grouped.get(r.country_code)!.artists.push({
      artist_id: r.artist_id,
      artist_name: r.artist_name,
      rank: r.rank,
      listeners: r.listeners,
    })
  }

  // 20개국 전체 반환 — DB 데이터 없는 국가는 artists:[] (프론트에서 "No data yet" 표시)
  // 아티스트 수 내림차순 정렬 (데이터 있는 국가 우선, 없는 국가는 뒤로)
  const charts = FIXED_COUNTRIES.map((code) =>
    grouped.get(code) ?? { country_code: code, artists: [] }
  ).sort((a, b) => b.artists.length - a.artists.length)

  return NextResponse.json({ charts, week_start: latest.week_start })
}
