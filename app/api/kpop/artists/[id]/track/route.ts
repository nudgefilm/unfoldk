import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// /api/kpop/artists/[id]/track — 아티스트 단위 캘린더 일괄 구독
//
//   GET    트래킹 상태 — { tracking, eventCount, subscribedCount }
//   POST   매칭되는 모든 미래 이벤트에 구독 upsert (remind_d7/d1/dayof 기본 true)
//   DELETE 매칭되는 모든 미래 이벤트 구독 해제 (사용자가 수동 커스터마이즈한
//          per-event 리마인더 세팅도 함께 날아감 — UX 단순화 trade-off)
//
// 매칭 로직: hallyu_calendar_events.artist_or_drama ILIKE %<name>%
//            artist.name_ko 가 있으면 OR 로 한국명 ILIKE 도 매칭.
//            기존 페이지의 Upcoming Events 쿼리와 동일 (app/kpop/[id]/page.tsx).
//            과거 이벤트는 의미 없어 event_date >= now 만 포함.
//            KOPIS source 는 정책상 캘린더에 미노출이라 제외 (2026-05-16 폐기).
//
// "tracking" 정의: 매칭 이벤트 중 1건이라도 구독 row 가 있으면 true.
//                 사용자가 캘린더 모달에서 단건 구독한 케이스도 함께 잡힘 —
//                 토글 시 해당 구독도 같이 해제됨. UI 가 다른 진입점에서
//                 들어왔어도 통합된 "follow artist" 멘탈 모델 유지.

export const dynamic = "force-dynamic"

interface Artist {
  name: string
  name_ko: string | null
}

async function loadArtist(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  id: string
): Promise<Artist | null> {
  const { data } = await supabase
    .from("kpop_artists")
    .select("name, name_ko, is_active")
    .eq("id", id)
    .maybeSingle()
  const row = data as
    | { name: string; name_ko: string | null; is_active: boolean }
    | null
  if (!row || !row.is_active) return null
  return { name: row.name, name_ko: row.name_ko }
}

async function loadMatchingEventIds(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  artist: Artist
): Promise<string[]> {
  const nowIso = new Date().toISOString()
  const orParts = [`artist_or_drama.ilike.%${artist.name}%`]
  if (artist.name_ko) orParts.push(`artist_or_drama.ilike.%${artist.name_ko}%`)

  const { data, error } = await supabase
    .from("hallyu_calendar_events")
    .select("id")
    .neq("source_api", "kopis")
    .gte("event_date", nowIso)
    .or(orParts.join(","))

  if (error) {
    console.error("[track-artist] event 매칭 조회 실패:", error.message)
    return []
  }
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id)
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    // 비로그인은 항상 untracked — 클라이언트가 별도 fetch 안 해도 되게 200 으로 응답.
    return NextResponse.json({ tracking: false, eventCount: 0, subscribedCount: 0 })
  }

  const artist = await loadArtist(supabase, id)
  if (!artist) {
    return NextResponse.json({ error: "artist_not_found" }, { status: 404 })
  }

  const eventIds = await loadMatchingEventIds(supabase, artist)
  if (eventIds.length === 0) {
    return NextResponse.json({ tracking: false, eventCount: 0, subscribedCount: 0 })
  }

  const { count, error } = await supabase
    .from("user_calendar_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("event_id", eventIds)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const subscribedCount = count ?? 0
  return NextResponse.json({
    tracking: subscribedCount > 0,
    eventCount: eventIds.length,
    subscribedCount,
  })
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  const artist = await loadArtist(supabase, id)
  if (!artist) {
    return NextResponse.json({ error: "artist_not_found" }, { status: 404 })
  }

  const eventIds = await loadMatchingEventIds(supabase, artist)
  if (eventIds.length === 0) {
    // 미래 이벤트가 아직 없어도 200 응답 — 클라이언트는 trackedCount=0 으로 분기.
    return NextResponse.json({ tracking: false, trackedCount: 0, eventCount: 0 })
  }

  const rows = eventIds.map((event_id) => ({
    user_id: user.id,
    event_id,
    remind_d7: true,
    remind_d1: true,
    remind_dayof: true,
    notification_enabled: true,
  }))

  const { error } = await supabase
    .from("user_calendar_subscriptions")
    .upsert(rows, { onConflict: "user_id,event_id", ignoreDuplicates: false })

  if (error) {
    console.error("[track-artist] upsert 실패:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    tracking: true,
    trackedCount: eventIds.length,
    eventCount: eventIds.length,
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  const artist = await loadArtist(supabase, id)
  if (!artist) {
    return NextResponse.json({ error: "artist_not_found" }, { status: 404 })
  }

  const eventIds = await loadMatchingEventIds(supabase, artist)
  if (eventIds.length === 0) {
    return NextResponse.json({ tracking: false, untrackedCount: 0 })
  }

  const { error, count } = await supabase
    .from("user_calendar_subscriptions")
    .delete({ count: "exact" })
    .eq("user_id", user.id)
    .in("event_id", eventIds)

  if (error) {
    console.error("[track-artist] delete 실패:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    tracking: false,
    untrackedCount: count ?? 0,
  })
}
