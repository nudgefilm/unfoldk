import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const revalidate = 3600

export async function GET() {
  const admin = createSupabaseAdminClient()

  const { data: latestRow } = await admin
    .from("kpop_stats_daily")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!latestRow) return NextResponse.json({ artists: [] })
  const latestDate = (latestRow as { date: string }).date

  const { data: stats } = await admin
    .from("kpop_stats_daily")
    .select("artist_id, lastfm_listeners")
    .eq("date", latestDate)
    .not("lastfm_listeners", "is", null)
    .order("lastfm_listeners", { ascending: false })
    .limit(30)
  if (!stats || stats.length === 0) return NextResponse.json({ artists: [] })

  const artistIds = (stats as { artist_id: string }[]).map(r => r.artist_id)
  const { data: artists } = await admin
    .from("kpop_artists")
    .select("id, name")
    .in("id", artistIds)

  const nameMap = new Map(
    ((artists ?? []) as { id: string; name: string }[]).map(a => [a.id, a.name])
  )

  return NextResponse.json({
    artists: (stats as { artist_id: string; lastfm_listeners: number }[]).map((r, i) => ({
      id: r.artist_id,
      name: nameMap.get(r.artist_id) ?? "—",
      rank: i + 1,
      listeners: r.lastfm_listeners,
    })),
  })
}
