import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// GET /api/mypage/artists
// 두 소스 합산 후 kpop_artists 매칭된 아티스트 반환.
//
// 소스 A — kpop_artist_follows
//   KpopStats "Track this artist" 버튼 → artist_id 직접 저장.
//   이벤트 없는 아티스트도 포함됨.
//
// 소스 B — user_calendar_subscriptions → hallyu_calendar_events.artist_or_drama
//   HallyuCalendar Set Reminder (단건 구독) 또는
//   Track 버튼 경유 이벤트 구독.
//   artist_or_drama ILIKE '%kpop.name%' 매칭으로 kpop_artists 연결.
//
// 두 소스 union → kpop_artists.id 기준 dedup → 카드 반환.

export const dynamic = "force-dynamic"

interface ArtistItem {
  id: string
  name: string
  name_ko: string | null
  thumbnail_url: string | null
  member_count: number | null
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const artistIdSet = new Set<string>()

  // ── 소스 A: kpop_artist_follows ───────────────────────────────────────────
  // KpopStats "Track this artist" 버튼이 직접 저장한 아티스트 ID
  const { data: follows } = await supabase
    .from("kpop_artist_follows")
    .select("artist_id")
    .eq("user_id", user.id)
  for (const row of (follows ?? []) as Array<{ artist_id: string }>) {
    artistIdSet.add(row.artist_id)
  }

  // ── 소스 B: user_calendar_subscriptions → hallyu_calendar_events ──────────
  // HallyuCalendar Set Reminder 또는 Track 버튼 경유 이벤트 구독에서 아티스트 추출
  const { data: subs } = await supabase
    .from("user_calendar_subscriptions")
    .select("event_id")
    .eq("user_id", user.id)

  const eventIds = ((subs ?? []) as Array<{ event_id: string }>).map((s) => s.event_id)

  if (eventIds.length > 0) {
    const { data: events } = await supabase
      .from("hallyu_calendar_events")
      .select("artist_or_drama")
      .in("id", eventIds)

    const eventNames = new Set<string>()
    for (const row of (events ?? []) as Array<{ artist_or_drama: string | null }>) {
      const n = row.artist_or_drama?.trim().toLowerCase()
      if (n) eventNames.add(n)
    }

    if (eventNames.size > 0) {
      // kpop_artists 전체 로드 후 JS ILIKE 매칭
      // admin client: RLS 우회, 세션 상태 무관하게 전체 로드 보장
      const { data: allArtists } = await admin
        .from("kpop_artists")
        .select("id, name, name_ko")
        .eq("is_active", true)
        .limit(2000)

      for (const artist of (allArtists ?? []) as Array<{ id: string; name: string; name_ko: string | null }>) {
        const n = artist.name.toLowerCase()
        const nko = artist.name_ko?.toLowerCase() ?? null
        const matched = [...eventNames].some((en) => {
          if (en.includes(n)) return true
          if (nko && en.includes(nko)) return true
          return false
        })
        if (matched) artistIdSet.add(artist.id)
      }
    }
  }

  if (artistIdSet.size === 0) return NextResponse.json({ artists: [] })

  // 합산된 artist_id 로 kpop_artists 상세 조회
  const { data: artistRows } = await admin
    .from("kpop_artists")
    .select("id, name, name_ko, thumbnail_url, member_count")
    .in("id", [...artistIdSet])
    .eq("is_active", true)
    .order("name", { ascending: true })

  const artists = (artistRows ?? []) as ArtistItem[]

  return NextResponse.json({ artists })
}
