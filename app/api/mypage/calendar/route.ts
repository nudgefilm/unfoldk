import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// /api/mypage/calendar — 내 캘린더 데이터
//
// 분기:
//   - user_calendar_subscriptions 에 행이 있으면 mode = "subscribed", 본인 구독 이벤트만 (날짜 ASC)
//   - 없으면 mode = "fallback", 이번 달 (UTC) 전체 이벤트 (날짜 ASC)
//
// RLS:
//   - user_calendar_subscriptions 본인 행만 RLS 통과 (0001 정책 user_calsubs_all_own)
//   - hallyu_calendar_events 는 is_premium 게이팅을 RLS 가 처리 (Free 는 premium 미노출)
//   - 어드민 우회는 본 페이지에서는 불필요 (개인 페이지)

const TYPE_TO_DISPLAY: Record<string, string> = {
  comeback: "K-pop",
  drama: "K-drama",
  concert: "Concert",
  fanmeet: "Fan Meet",
}

interface EventRow {
  id: string
  type: string
  title: string
  artist_or_drama: string | null
  event_date: string
  event_time_label: string | null
  description: string | null
  is_premium: boolean
  thumbnail_url: string | null
  url: string | null
}

function mapEvent(row: EventRow) {
  const eventDate = new Date(row.event_date)
  return {
    id: row.id,
    title: row.title,
    artist: row.artist_or_drama,
    event_date: row.event_date,
    date: eventDate.getUTCDate(),
    month: eventDate.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase(),
    type: TYPE_TO_DISPLAY[row.type] ?? row.type,
    time: row.event_time_label,
    description: row.description,
    isPremium: row.is_premium,
    thumbnailUrl: row.thumbnail_url,
    url: row.url,
  }
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  // 1. 본인 구독 이벤트 ID 목록 (RLS 가 user_id = auth.uid() 자동 게이팅)
  const { data: subs, error: subsErr } = await supabase
    .from("user_calendar_subscriptions")
    .select("event_id")
    .eq("user_id", user.id)

  if (subsErr) {
    console.error("[mypage/calendar] subscriptions 조회 실패:", subsErr.message)
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 })
  }

  const eventIds = (subs ?? []).map((s) => (s as { event_id: string }).event_id)

  // 2-A. 구독 있음 → 해당 이벤트들 (오늘 이후만, 날짜 ASC). 다 지난 이벤트는 회고용으로 별도 분리 안 함.
  if (eventIds.length > 0) {
    const todayUtc = new Date()
    todayUtc.setUTCHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from("hallyu_calendar_events")
      .select(
        "id, type, title, artist_or_drama, event_date, event_time_label, description, is_premium, thumbnail_url, url"
      )
      .in("id", eventIds)
      .order("event_date", { ascending: true })

    if (error) {
      console.error("[mypage/calendar] subscribed events 조회 실패:", error.message)
      return NextResponse.json({ error: "lookup_failed" }, { status: 500 })
    }

    const rows = (data ?? []) as EventRow[]
    const upcoming = rows.filter((r) => new Date(r.event_date).getTime() >= todayUtc.getTime())
    const past = rows.filter((r) => new Date(r.event_date).getTime() < todayUtc.getTime())

    return NextResponse.json({
      mode: "subscribed",
      upcoming: upcoming.map(mapEvent),
      past: past.map(mapEvent).reverse(), // 최근에 지난 것부터
    })
  }

  // 2-B. 구독 없음 → 이번 달 (UTC) 전체 이벤트 fallback
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() // 0~11
  const startOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0))
  const startOfNextMonth = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0))

  const { data, error } = await supabase
    .from("hallyu_calendar_events")
    .select(
      "id, type, title, artist_or_drama, event_date, event_time_label, description, is_premium, thumbnail_url, url"
    )
    .gte("event_date", startOfMonth.toISOString())
    .lt("event_date", startOfNextMonth.toISOString())
    .order("event_date", { ascending: true })

  if (error) {
    console.error("[mypage/calendar] fallback events 조회 실패:", error.message)
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 })
  }

  return NextResponse.json({
    mode: "fallback",
    monthLabel: now.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    events: ((data ?? []) as EventRow[]).map(mapEvent),
  })
}
