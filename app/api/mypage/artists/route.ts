import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// GET /api/mypage/artists
// 유저가 구독한 이벤트에서 distinct artist_or_drama → kpop_artists 매칭
//
// 전략:
//   1. user_calendar_subscriptions → hallyu_calendar_events.artist_or_drama 추출
//   2. admin client 로 kpop_artists 전체 로드 (RLS 우회, 공개 카탈로그)
//   3. artist_or_drama ILIKE '%name%' 방향의 JS 매칭
//      — artist_or_drama 가 "BTS WORLD TOUR 2024" 형태여도 "bts" 포함으로 매칭
//   4. 매칭 실패 → id=null 제네릭 카드 (이름만 표시)

export const dynamic = "force-dynamic"

interface KpopArtistRow {
  id: string
  name: string
  name_ko: string | null
  thumbnail_url: string | null
  member_count: number | null
}

interface ArtistItem {
  id: string | null
  name: string
  name_ko: string | null
  thumbnail_url: string | null
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
  //    anon client 사용 — RLS is_premium 게이팅 자동 적용 (의도된 동작)
  const { data: events } = await supabase
    .from("hallyu_calendar_events")
    .select("artist_or_drama")
    .in("id", eventIds)

  const nameSet = new Set<string>()
  for (const row of (events ?? []) as Array<{ artist_or_drama: string | null }>) {
    const n = row.artist_or_drama?.trim()
    if (n) nameSet.add(n)
  }
  if (nameSet.size === 0) return NextResponse.json({ artists: [] })

  // artist_or_drama 값 소문자 배열 — "BTS WORLD TOUR 2024" 같은 긴 문자열도 포함됨
  const eventNames = [...nameSet].map((n) => n.toLowerCase())

  // 3. kpop_artists 전체 로드 — admin client 로 RLS 우회
  //    supabase server client 는 세션 상태에 따라 0건 반환 가능성 있음
  const admin = createSupabaseAdminClient()
  const { data: allArtists } = await admin
    .from("kpop_artists")
    .select("id, name, name_ko, thumbnail_url, member_count")
    .eq("is_active", true)
    .limit(2000)

  // 4. artist_or_drama ILIKE '%kpop_artists.name%' 방향 매칭
  //    eventName 이 artist name 을 포함하는지 체크 (긴 이벤트명 대응)
  const kpopMatched = ((allArtists ?? []) as KpopArtistRow[]).filter((artist) => {
    const n = artist.name.toLowerCase()
    const nko = artist.name_ko?.toLowerCase() ?? null
    return eventNames.some((en) => {
      if (en.includes(n)) return true
      if (nko && en.includes(nko)) return true
      // reverse: short artist_or_drama 가 정확히 artist name 인 경우
      if (n.includes(en) && en.length >= 2) return true
      if (nko && nko.includes(en) && en.length >= 2) return true
      return false
    })
  })

  // 매칭된 artist_or_drama 집합 (중복 제거용)
  const coveredNames = new Set<string>()
  for (const artist of kpopMatched) {
    const n = artist.name.toLowerCase()
    const nko = artist.name_ko?.toLowerCase() ?? null
    for (const en of eventNames) {
      if (en.includes(n) || (nko && en.includes(nko))) coveredNames.add(en)
      if ((n.includes(en) || (nko && nko.includes(en))) && en.length >= 2) coveredNames.add(en)
    }
  }

  // 매칭 실패 → id=null 제네릭 카드 (이름만 표시, 음표 아이콘)
  const unmatched: ArtistItem[] = [...nameSet]
    .filter((name) => !coveredNames.has(name.toLowerCase()))
    .map((name) => ({
      id: null,
      name,
      name_ko: null,
      thumbnail_url: null,
      member_count: null,
    }))

  const artists: ArtistItem[] = [
    ...(kpopMatched as ArtistItem[]),
    ...unmatched,
  ]

  return NextResponse.json({ artists })
}
