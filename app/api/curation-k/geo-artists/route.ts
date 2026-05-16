import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { getGeoTopArtists } from "@/lib/api/lastfm"

// /api/curation-k/geo-artists — "이 나라 팬들이 좋아하는 K팝 아티스트" 위젯
//
// 흐름:
//   1. Last.fm geo.gettopartists?country=<국가> → 그 나라에서 인기 있는 아티스트 50명
//   2. UnfoldK kpop_artists 와 매칭 (name 또는 lastfm_name) — K팝 한정 필터
//   3. 매칭된 아티스트 + 본인 kpop_spots row 수 동봉 → "관련 K팝 성지 → 클릭" 동선
//
// 캐시: 6h (geo top 아티스트는 일/주 단위 변동)

export const revalidate = 21600

const QuerySchema = z.object({
  country: z.string().trim().min(2).max(60).default("United States"),
  limit: z.coerce.number().int().min(1).max(20).default(10),
})

interface KpopArtistRow {
  id: string
  name: string
  name_ko: string | null
  lastfm_name: string | null
  thumbnail_url: string | null
}

interface SpotCountRow {
  artist_id: string | null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    country: url.searchParams.get("country") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { country, limit } = parsed.data

  let geoArtists: { name: string; listeners: number | null }[] = []
  try {
    const fromLastfm = await getGeoTopArtists(country, 200) // 더 많이 받아서 K팝 매칭 풀 확보
    geoArtists = fromLastfm.map((a) => ({ name: a.name, listeners: a.listeners }))
  } catch (err) {
    console.error("[curation-k/geo-artists] Last.fm 호출 실패:", err)
    return NextResponse.json({ country, items: [], error: "lastfm_failed" }, { status: 200 })
  }

  if (geoArtists.length === 0) {
    return NextResponse.json({ country, items: [] })
  }

  const admin = createSupabaseAdminClient()

  // 이름 정규화 매칭 — Last.fm 응답과 우리 카탈로그 양쪽 lowercase
  const lowerNames = geoArtists.map((a) => a.name.toLowerCase())

  const { data: kpopRows, error } = await admin
    .from("kpop_artists")
    .select("id, name, name_ko, lastfm_name, thumbnail_url")
    .eq("is_active", true)

  if (error) {
    console.error("[curation-k/geo-artists] kpop_artists fetch 실패:", error.message)
    return NextResponse.json({ country, items: [] })
  }

  const kpopList = (kpopRows ?? []) as KpopArtistRow[]
  const matched: Array<{
    artistId: string
    name: string
    name_ko: string | null
    thumbnail_url: string | null
    listeners: number | null
    rank: number // geo 응답 내 순위
  }> = []

  for (let i = 0; i < geoArtists.length; i++) {
    const lower = lowerNames[i]
    const geo = geoArtists[i]
    const match = kpopList.find((k) => {
      if (k.name.toLowerCase() === lower) return true
      if (k.lastfm_name && k.lastfm_name.toLowerCase() === lower) return true
      return false
    })
    if (match) {
      matched.push({
        artistId: match.id,
        name: match.name,
        name_ko: match.name_ko,
        thumbnail_url: match.thumbnail_url,
        listeners: geo.listeners,
        rank: i + 1,
      })
    }
    if (matched.length >= limit) break
  }

  if (matched.length === 0) {
    return NextResponse.json({ country, items: [] })
  }

  // 각 매칭 아티스트의 kpop_spots 개수 — UI 가 "Visit X spots →" 노출
  const ids = matched.map((m) => m.artistId)
  const { data: spotRows } = await admin
    .from("kpop_spots")
    .select("artist_id")
    .in("artist_id", ids)

  const countMap = new Map<string, number>()
  for (const r of (spotRows ?? []) as SpotCountRow[]) {
    if (!r.artist_id) continue
    countMap.set(r.artist_id, (countMap.get(r.artist_id) ?? 0) + 1)
  }

  return NextResponse.json(
    {
      country,
      items: matched.map((m) => ({
        ...m,
        spot_count: countMap.get(m.artistId) ?? 0,
      })),
    },
    { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=43200" } }
  )
}
