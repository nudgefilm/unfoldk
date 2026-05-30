import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// GET /api/mypage/artists
// 유저가 구독한 이벤트에서 distinct artist_or_drama 목록 반환.
//
// 전략 (Saved Recipes 방식):
//   1. user_calendar_subscriptions → hallyu_calendar_events.artist_or_drama distinct 추출
//   2. kpop_artists 매칭은 enrichment 전용 — 매칭 실패해도 이름 카드로 표시
//   3. kpop 매칭 성공 → 썸네일·한글명·타입 포함 / 실패 → id=null 제네릭 카드
//
// 카드 건수 = /api/mypage/stats artistsTracking 건수와 항상 일치.

export const dynamic = "force-dynamic"

interface KpopArtistRow {
  id: string
  name: string
  name_ko: string | null
  thumbnail_url: string | null
  member_count: number | null
}

// id: null = kpop_artists 매칭 없는 제네릭 카드
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

  // 1. 구독 event_id 목록 (notification 필터 없음 — 구독 자체가 "트래킹" 기준)
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

  // 3. kpop_artists 로드 (enrichment 전용 — 없어도 결과 반환)
  const { data: allArtists } = await supabase
    .from("kpop_artists")
    .select("id, name, name_ko, thumbnail_url, member_count")
    .eq("is_active", true)

  // 매칭된 kpop_artists: event name 에 artist.name 이 포함된 경우
  const kpopMatched = ((allArtists ?? []) as KpopArtistRow[]).filter((artist) => {
    const n = artist.name.toLowerCase()
    const nko = artist.name_ko?.toLowerCase() ?? null
    return eventNames.some((en) => en.includes(n) || (nko && en.includes(nko)))
  })

  // kpop 매칭이 커버한 event name 집합 (중복 제거용)
  const coveredNames = new Set<string>()
  for (const artist of kpopMatched) {
    const n = artist.name.toLowerCase()
    const nko = artist.name_ko?.toLowerCase() ?? null
    for (const en of eventNames) {
      if (en.includes(n) || (nko && en.includes(nko))) {
        coveredNames.add(en)
      }
    }
  }

  // kpop 매칭 실패한 artist_or_drama → 제네릭 카드 (id=null)
  const unmatched: ArtistItem[] = [...nameSet]
    .filter((name) => !coveredNames.has(name.toLowerCase()))
    .map((name) => ({
      id: null,
      name,
      name_ko: null,
      thumbnail_url: null,
      member_count: null,
    }))

  // kpop 매칭 먼저, 미매칭 이름 뒤
  const artists: ArtistItem[] = [
    ...(kpopMatched as ArtistItem[]),
    ...unmatched,
  ]

  return NextResponse.json({ artists })
}
