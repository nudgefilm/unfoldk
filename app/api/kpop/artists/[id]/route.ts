import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// /api/kpop/artists/[id] — 아티스트 상세 + 최근 30일 stats 히스토리

interface DailyStatsRow {
  date: string
  youtube_subscribers: number | null
  youtube_total_views: number | null
  youtube_weekly_views: number | null
  lastfm_listeners: number | null
  lastfm_playcount: number | null
  lastfm_weekly_rank: number | null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()

  const { data: artist, error: artistErr } = await supabase
    .from("kpop_artists")
    .select("id, name, name_ko, debut_year, thumbnail_url, youtube_channel_id, lastfm_name, is_active, created_at")
    .eq("id", id)
    .maybeSingle()

  if (artistErr) {
    return NextResponse.json({ error: artistErr.message }, { status: 500 })
  }
  if (!artist || !(artist as { is_active?: boolean }).is_active) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  // 최근 30일 stats — service_role 로 안정 조회
  const admin = createSupabaseAdminClient()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30)
  const cutoff = thirtyDaysAgo.toISOString().slice(0, 10)

  const { data: history } = await admin
    .from("kpop_stats_daily")
    .select(
      "date, youtube_subscribers, youtube_total_views, youtube_weekly_views, lastfm_listeners, lastfm_playcount, lastfm_weekly_rank"
    )
    .eq("artist_id", id)
    .gte("date", cutoff)
    .order("date", { ascending: true })

  const rows = (history ?? []) as DailyStatsRow[]
  const latest = rows[rows.length - 1] ?? null

  return NextResponse.json({
    artist: {
      id: (artist as { id: string }).id,
      name: (artist as { name: string }).name,
      name_ko: (artist as { name_ko: string | null }).name_ko,
      debut_year: (artist as { debut_year: number | null }).debut_year,
      thumbnail_url: (artist as { thumbnail_url: string | null }).thumbnail_url,
      has_youtube: !!(artist as { youtube_channel_id: string | null }).youtube_channel_id,
      has_lastfm: !!(artist as { lastfm_name: string | null }).lastfm_name,
    },
    latest,
    history: rows,
  })
}
