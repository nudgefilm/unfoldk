import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// GET /api/mypage/artists
// 유저가 트래킹한 아티스트 목록 반환
// 로직: user_calendar_subscriptions → hallyu_calendar_events.artist_or_drama distinct
//       → kpop_artists 매칭 (name / name_ko 정확 일치)

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

  const names = [...nameSet]

  // 3. kpop_artists 매칭 — name 또는 name_ko 가 구독 이벤트의 아티스트명과 일치
  const { data: artists, error: artistsErr } = await supabase
    .from("kpop_artists")
    .select("id, name, name_ko, youtube_thumbnail_url, member_count")
    .eq("is_active", true)
    .or(`name.in.(${names.map((n) => `"${n}"`).join(",")}),name_ko.in.(${names.map((n) => `"${n}"`).join(",")})`)

  if (artistsErr) return NextResponse.json({ artists: [] })

  return NextResponse.json({ artists: (artists ?? []) as ArtistRow[] })
}
