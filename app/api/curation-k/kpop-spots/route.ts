import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// /api/curation-k/kpop-spots — K팝 성지 카드 그리드
//
// 정렬: Last.fm 인기 아티스트 (kpop_artists 의 가장 최근 lastfm_listeners) 우선.
// service_role 로 kpop_stats_daily 글로벌 집계 (RLS 우회 — 통계는 공개 정보).
// 누락 시 spot.created_at desc fallback.

export const revalidate = 1800

const QuerySchema = z.object({
  spot_type: z.enum(["agency", "mv_location", "cafe", "concert_venue"]).optional(),
  limit: z.coerce.number().int().min(1).max(60).default(20),
})

interface KpopSpotRow {
  id: string
  artist_id: string | null
  artist_name: string
  spot_name: string
  spot_type: string
  region: string | null
  address: string | null
  latitude: number | string | null
  longitude: number | string | null
  image_url: string | null
  created_at: string
}

interface StatsRow {
  artist_id: string
  date: string
  lastfm_listeners: number | null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    spot_type: url.searchParams.get("spot_type") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { spot_type, limit } = parsed.data

  const admin = createSupabaseAdminClient()

  let query = admin
    .from("kpop_spots")
    .select(
      "id, artist_id, artist_name, spot_name, spot_type, region, address, latitude, longitude, image_url, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200) // 정렬 위해 일단 풀 fetch (kpop_spots 총량 작음 가정)

  if (spot_type) query = query.eq("spot_type", spot_type)

  const { data: spots, error } = await query
  if (error) {
    console.error("[curation-k/kpop-spots] 조회 실패:", error.message)
    return NextResponse.json({ error: "query_failed" }, { status: 500 })
  }

  const rows = (spots ?? []) as KpopSpotRow[]
  if (rows.length === 0) {
    return NextResponse.json({ items: [] })
  }

  // 각 artist 의 최신 lastfm_listeners 조회 — Top 정렬 키
  const artistIds = Array.from(
    new Set(rows.map((r) => r.artist_id).filter((id): id is string => !!id))
  )

  const listenersMap = new Map<string, number>()
  if (artistIds.length > 0) {
    const { data: statsRows } = await admin
      .from("kpop_stats_daily")
      .select("artist_id, date, lastfm_listeners")
      .in("artist_id", artistIds)
      .order("date", { ascending: false })

    for (const s of (statsRows ?? []) as StatsRow[]) {
      if (!listenersMap.has(s.artist_id) && s.lastfm_listeners !== null) {
        listenersMap.set(s.artist_id, s.lastfm_listeners)
      }
    }
  }

  // 정렬: listeners desc → 누락 시 created_at desc (이미 그 순서로 fetch 됨)
  rows.sort((a, b) => {
    const la = a.artist_id ? listenersMap.get(a.artist_id) ?? -1 : -1
    const lb = b.artist_id ? listenersMap.get(b.artist_id) ?? -1 : -1
    return lb - la
  })

  return NextResponse.json(
    { items: rows.slice(0, limit) },
    { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } }
  )
}
