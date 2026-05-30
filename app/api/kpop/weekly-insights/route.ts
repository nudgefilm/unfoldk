import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// GET /api/kpop/weekly-insights — 이번 주 아티스트 동향 인사이트 (Top 3)
export const dynamic = "force-dynamic"
export const revalidate = 3600

export interface WeeklyInsightItem {
  artist_id: string
  artist_name: string
  insight_text: string
  listeners: number | null
}

export async function GET() {
  const admin = createSupabaseAdminClient()

  // 최신 week_start
  const { data: latest } = await admin
    .from("kpop_weekly_insights")
    .select("week_start")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latest) return NextResponse.json({ insights: [] })

  const { data, error } = await admin
    .from("kpop_weekly_insights")
    .select("artist_id, insight_text, kpop_artists!inner(name)")
    .eq("week_start", latest.week_start)
    .order("created_at", { ascending: true })
    .limit(3)

  if (error) {
    console.error("[/api/kpop/weekly-insights]", error.message)
    return NextResponse.json({ insights: [] })
  }

  type Row = {
    artist_id: string
    insight_text: string
    kpop_artists: { name: string } | null
  }

  const insights: WeeklyInsightItem[] = ((data ?? []) as unknown as Row[])
    .filter((r) => r.kpop_artists)
    .map((r) => ({
      artist_id: r.artist_id,
      artist_name: (r.kpop_artists as { name: string }).name,
      insight_text: r.insight_text,
      listeners: null,
    }))

  return NextResponse.json({ insights, week_start: latest.week_start })
}
