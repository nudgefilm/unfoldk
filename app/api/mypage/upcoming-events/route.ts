import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// GET /api/mypage/upcoming-events
// 유저가 구독한 미래 이벤트 최대 5건 (event_date >= 지금 UTC, 오름차순)

export const dynamic = "force-dynamic"

export interface UpcomingEventItem {
  id: string
  title: string
  event_date: string   // ISO
  type: string
  artist_or_drama: string | null
  thumbnail_url: string | null
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  // notification_enabled=true: 리마인더 토글이 1개라도 켜진 구독만
  const { data: subs, error: subsErr } = await supabase
    .from("user_calendar_subscriptions")
    .select("event_id")
    .eq("user_id", user.id)
    .eq("notification_enabled", true)
  if (subsErr || !subs?.length) return NextResponse.json({ events: [] })

  const eventIds = (subs as Array<{ event_id: string }>).map((s) => s.event_id)
  const now = new Date().toISOString()

  const { data: events, error: eventsErr } = await supabase
    .from("hallyu_calendar_events")
    .select("id, title, event_date, type, artist_or_drama, thumbnail_url")
    .in("id", eventIds)
    .gte("event_date", now)
    .order("event_date", { ascending: true })
    .limit(5)
  if (eventsErr) return NextResponse.json({ events: [] })

  return NextResponse.json({ events: (events ?? []) as UpcomingEventItem[] })
}
