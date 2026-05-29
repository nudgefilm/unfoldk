import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// GET /api/mypage/events
// 유저가 구독한 이번 달 이벤트 목록
// 로직: user_calendar_subscriptions → hallyu_calendar_events (이번 달 UTC 필터)

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

  const { data: subs, error: subsErr } = await supabase
    .from("user_calendar_subscriptions")
    .select("event_id")
    .eq("user_id", user.id)
  if (subsErr) return NextResponse.json({ events: [] })

  const eventIds = ((subs ?? []) as Array<{ event_id: string }>).map((s) => s.event_id)
  if (eventIds.length === 0) return NextResponse.json({ events: [] })

  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()

  const { data: events, error: eventsErr } = await supabase
    .from("hallyu_calendar_events")
    .select("id, title, event_date, type, artist_or_drama, thumbnail_url")
    .in("id", eventIds)
    .gte("event_date", start)
    .lt("event_date", end)
    .order("event_date", { ascending: true })
  if (eventsErr) return NextResponse.json({ events: [] })

  return NextResponse.json({ events: (events ?? []) as EventItem[] })
}
