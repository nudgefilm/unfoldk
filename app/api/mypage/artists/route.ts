import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// GET /api/mypage/artists
// 유저가 트래킹한 아티스트 목록 반환
//
// 매칭 전략:
//   1. user_calendar_subscriptions → hallyu_calendar_events.artist_or_drama distinct 추출
//   2. kpop_artists 전체 로드 (is_active=true)
//   3. 인메모리 substring 매칭:
//      "BTS Concert" → artist.name="BTS" 가 포함됨 → 매칭
//      track API 가 ILIKE %artist.name% 로 구독했으므로 역방향 포함 검사가 올바름.

export const dynamic = "force-dynamic"

interface ArtistRow {
  id: string
  name: string
  name_ko: string | null
  youtube_thumbnail_url: string | null
  member_count: number | null
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  // 1. 구독 event_id 목록
  const { data: subs, error: subsErr } = await supabase
    .from("user_calendar_subscriptions")
    .select("event_id")
    .eq("user_id", user.id)
  if (subsErr) return NextResponse.json({ artists: [] })

  const eventIds = ((subs ?? []) as Array<{ event_id: string }>).map((s) => s.event_id)
  if (eventIds.length === 0) return NextResponse.json({ artists: [] })

  // 2. 이벤트에서 distinct artist_or_drama 추출
  const { data: events, error: eventsErr } = await supabase
    .from("hallyu_calendar_events")
    .select("artist_or_drama")
    .in("id", eventIds)
  if (eventsErr) return NextResponse.json({ artists: [] })

  const nameSet = new Set<string>()
  for (const row of (events ?? []) as Array<{ artist_or_drama: string | null }>) {
    const n = row.artist_or_drama?.trim()
    if (n) nameSet.add(n)
  }
  if (nameSet.size === 0) return NextResponse.json({ artists: [] })

  const eventNames = [...nameSet].map((n) => n.toLowerCase())

  // 3. 활성 kpop_artists 전체 로드 후 인메모리 매칭
  //    track API: artist_or_drama ILIKE %artist.name% 로 구독 → 역방향 포함 검사
  const { data: allArtists, error: artistsErr } = await supabase
    .from("kpop_artists")
    .select("id, name, name_ko, youtube_thumbnail_url, member_count")
    .eq("is_active", true)
  if (artistsErr) return NextResponse.json({ artists: [] })

  const matched = ((allArtists ?? []) as ArtistRow[]).filter((artist) => {
    const n = artist.name.toLowerCase()
    const nko = artist.name_ko?.toLowerCase() ?? null
    return eventNames.some(
      (en) => en.includes(n) || (nko && en.includes(nko))
    )
  })

  return NextResponse.json({ artists: matched })
}
