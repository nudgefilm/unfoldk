import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// GET /api/kpop/country-charts — 국가별 Top 3 K팝 아티스트 (최신 주)
export const dynamic = "force-dynamic"
export const revalidate = 3600

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

  // K팝 아티스트 수 내림차순 정렬 — 매칭 많은 국가가 앞에 노출
  const charts = Array.from(grouped.values())
    .filter((c) => c.artists.length > 0)
    .sort((a, b) => b.artists.length - a.artists.length)
  return NextResponse.json({ charts, week_start: latest.week_start })
}
