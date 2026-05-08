import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// /api/kpop/artists — 활성 아티스트 목록 + 최신 stats join
//
// 쿼리:
//   - q?: 검색어 (name 또는 name_ko ilike)
//   - limit?: 기본 50, max 100
//
// 비회원·로그인·유료 모두 같은 데이터를 받지만 page 측에서 노출 개수를 분기.

const QuerySchema = z.object({
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    q: searchParams.get("q") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const limit = parsed.data.limit ?? 50

  // RLS 가 active 필터 안 걸어주므로 명시적으로 추가
  const supabase = await createSupabaseServerClient()
  let query = supabase
    .from("kpop_artists")
    .select("id, name, name_ko, debut_year, thumbnail_url, lastfm_name, youtube_channel_id, is_active")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(limit)

  if (parsed.data.q) {
    const q = parsed.data.q.trim()
    // ilike escape — % _ 만 신경
    const safe = q.replace(/[%_]/g, "\\$&")
    query = query.or(`name.ilike.%${safe}%,name_ko.ilike.%${safe}%`)
  }

  const { data: artists, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 각 아티스트의 가장 최근 stats 1행씩 join — admin 클라이언트로 한 번에 조회 후 매핑
  const artistIds = (artists ?? []).map((a) => a.id as string)
  type LatestStat = {
    artist_id: string
    date: string
    youtube_subscribers: number | null
    youtube_total_views: number | null
    youtube_weekly_views: number | null
    lastfm_listeners: number | null
    lastfm_playcount: number | null
  }
  const latestMap = new Map<string, LatestStat>()
  if (artistIds.length > 0) {
    const admin = createSupabaseAdminClient()
    const { data: statsData } = await admin
      .from("kpop_stats_daily")
      .select(
        "artist_id, date, youtube_subscribers, youtube_total_views, youtube_weekly_views, lastfm_listeners, lastfm_playcount"
      )
      .in("artist_id", artistIds)
      .order("date", { ascending: false })

    // artist_id 별 첫(최신) row 만 보존
    for (const row of (statsData ?? []) as LatestStat[]) {
      if (!latestMap.has(row.artist_id)) {
        latestMap.set(row.artist_id, row)
      }
    }
  }

  const result = (artists ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    name_ko: a.name_ko,
    debut_year: a.debut_year,
    thumbnail_url: a.thumbnail_url,
    has_youtube: !!a.youtube_channel_id,
    has_lastfm: !!a.lastfm_name,
    latest: latestMap.get(a.id as string) ?? null,
  }))

  return NextResponse.json({ artists: result })
}
