import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const revalidate = 86400

// /api/kpop/artists — 활성 아티스트 목록 (검색·필터·정렬·페이지네이션)
//
// 쿼리:
//   q?         : 아티스트명/한글명 부분 일치 검색 (대소문자 무시)
//   type?      : 'group' | 'solo' (member_count > 1 / = 1). 누락 시 미분류 포함 전체.
//   sort?      : 'listeners' (기본, DESC) | 'name' (ASC)
//   page?      : 1-based, 기본 1
//   pageSize?  : 기본 30, max 100
//
// 응답: { items, total, page, pageSize }
// 각 item: id, name, name_ko, thumbnail_url, member_count, has_youtube,
//          latest_subscribers, latest_total_views, latest_listeners
//
// /kpop 검색·"More Artists" 섹션 + /kpop/artists 전체 목록 페이지 공통 데이터 소스.

const QuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.enum(["group", "solo"]).optional(),
  sort: z.enum(["listeners", "name"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
})

interface ArtistRow {
  id: string
  name: string
  name_ko: string | null
  thumbnail_url: string | null
  youtube_channel_id: string | null
  member_count: number | null
}

interface StatsRow {
  artist_id: string
  date: string
  youtube_subscribers: number | null
  youtube_total_views: number | null
  lastfm_listeners: number | null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    q: searchParams.get("q") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const q = parsed.data.q?.trim() ?? ""
  const type = parsed.data.type
  const sort = parsed.data.sort ?? "listeners"
  const page = parsed.data.page ?? 1
  const pageSize = parsed.data.pageSize ?? 30

  const supabase = createSupabaseAdminClient()

  // 1. 활성 아티스트 base 쿼리 — q / type 필터
  //    listeners 정렬은 stats join 후 메모리 처리 (활성 ~300명 규모라 부담 X).
  let query = supabase
    .from("kpop_artists")
    .select("id, name, name_ko, thumbnail_url, youtube_channel_id, member_count", {
      count: "exact",
    })
    .eq("is_active", true)

  if (q.length > 0) {
    // ilike escape — % _ , ( ) 만 제거 (PostgREST or() 콤마 충돌 방지)
    const safeQ = q.replace(/[%_,()*]/g, "")
    query = query.or(`name.ilike.%${safeQ}%,name_ko.ilike.%${safeQ}%`)
  }
  if (type === "group") query = query.gt("member_count", 1)
  if (type === "solo") query = query.eq("member_count", 1)

  // name 정렬은 DB 단계에서 page 슬라이스. listeners 정렬은 전체 fetch 후 메모리 슬라이스.
  if (sort === "name") {
    query = query
      .order("name", { ascending: true })
      .range((page - 1) * pageSize, page * pageSize - 1)
  } else {
    query = query.order("name", { ascending: true })
  }

  const { data: artistsData, error: artistsErr, count: totalCount } = await query
  if (artistsErr) {
    return NextResponse.json({ error: artistsErr.message }, { status: 500 })
  }
  const artists = (artistsData ?? []) as ArtistRow[]

  // 2. 최신 stats join — kpop_stats_daily 가장 최근 row
  const ids = artists.map((a) => a.id)
  const latestMap = new Map<string, StatsRow>()
  if (ids.length > 0) {
    const { data: statsData } = await supabase
      .from("kpop_stats_daily")
      .select("artist_id, date, youtube_subscribers, youtube_total_views, lastfm_listeners")
      .in("artist_id", ids)
      .order("date", { ascending: false })
    for (const s of (statsData ?? []) as StatsRow[]) {
      if (!latestMap.has(s.artist_id)) latestMap.set(s.artist_id, s)
    }
  }

  // 3. item 매핑 + listeners 정렬·페이지네이션
  interface Item {
    id: string
    name: string
    name_ko: string | null
    thumbnail_url: string | null
    member_count: number | null
    has_youtube: boolean
    latest_subscribers: number | null
    latest_total_views: number | null
    latest_listeners: number | null
  }
  const merged: Item[] = artists.map((a) => {
    const s = latestMap.get(a.id)
    return {
      id: a.id,
      name: a.name,
      name_ko: a.name_ko,
      thumbnail_url: a.thumbnail_url,
      member_count: a.member_count,
      has_youtube: !!a.youtube_channel_id,
      latest_subscribers: s?.youtube_subscribers ?? null,
      latest_total_views: s?.youtube_total_views ?? null,
      latest_listeners: s?.lastfm_listeners ?? null,
    }
  })

  let items: Item[]
  if (sort === "listeners") {
    merged.sort((a, b) => (b.latest_listeners ?? -1) - (a.latest_listeners ?? -1))
    items = merged.slice((page - 1) * pageSize, page * pageSize)
  } else {
    items = merged
  }

  return NextResponse.json(
    {
      items,
      total: totalCount ?? merged.length,
      page,
      pageSize,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    }
  )
}
