import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// GET /api/mypage/events
// 유저가 리마인더 설정한 미래 이벤트 목록
// 로직: notification_enabled=true 구독 → hallyu_calendar_events (>= now UTC)
// /api/mypage/stats eventsUpcoming 과 동일 필터 — 카드 숫자·하부 페이지 항상 일치

export const dynamic = "force-dynamic"

export interface EventItem {
  id: string
  title: string
  event_date: string
  type: string
  artist_or_drama: string | null
  thumbnail_url: string | null
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  // notification_enabled=true 인 구독만 집계 (리마인더 설정한 이벤트만)
  const { data: subs, error: subsErr } = await supabase
    .from("user_calendar_subscriptions")
    .select("event_id")
    .eq("user_id", user.id)
    .eq("notification_enabled", true)
  if (subsErr) return NextResponse.json({ events: [] })

  const eventIds = ((subs ?? []) as Array<{ event_id: string }>).map((s) => s.event_id)
  if (eventIds.length === 0) return NextResponse.json({ events: [] })

  // 오늘 이후 미래 이벤트만 (과거 제외)
  const now = new Date().toISOString()

  const { data: events, error: eventsErr } = await supabase
    .from("hallyu_calendar_events")
    .select("id, title, event_date, type, artist_or_drama, thumbnail_url")
    .in("id", eventIds)
    .gte("event_date", now)
    .order("event_date", { ascending: true })
  if (eventsErr) return NextResponse.json({ events: [] })

  return NextResponse.json({ events: (events ?? []) as EventItem[] })
}
