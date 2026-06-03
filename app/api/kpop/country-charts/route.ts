import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// GET /api/kpop/country-charts
// K팝 청취자 합산 기준 상위 20개국 자동 선정 결과를 반환 (최신 수집일 기준).
// 국가 목록은 매일 ingest 시 동적으로 결정되며 고정 리스트 없음.
export const dynamic = "force-dynamic"
export const revalidate = 3600

export interface CountryChartEntry {
  country_code: string
  total_listeners: number
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

  if (!latest) return NextResponse.json({ charts: [] })

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

  // 국가별 그룹핑 + 총 청취자 합산
  const grouped = new Map<string, CountryChartEntry>()
  for (const r of (data ?? []) as Row[]) {
    if (!grouped.has(r.country_code)) {
      grouped.set(r.country_code, { country_code: r.country_code, total_listeners: 0, artists: [] })
    }
    const entry = grouped.get(r.country_code)!
    entry.artists.push({
      artist_id: r.artist_id,
      artist_name: r.artist_name,
      rank: r.rank,
      listeners: r.listeners,
    })
    entry.total_listeners += r.listeners ?? 0
  }

  // K팝 총 청취자 합산 기준 내림차순 정렬 (ingest에서 이미 상위 20개국만 저장됨)
  const charts = Array.from(grouped.values())
    .sort((a, b) => b.total_listeners - a.total_listeners)

  return NextResponse.json({ charts, week_start: latest.week_start })
}
