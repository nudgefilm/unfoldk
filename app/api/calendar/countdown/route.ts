import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const revalidate = 600

export async function GET() {
  const admin = createSupabaseAdminClient()
  const now = new Date().toISOString()
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await admin
    .from("hallyu_calendar_events")
    .select("id, title, type, event_date, artist_or_drama, venue_city, venue_country_code")
    .eq("is_premium", false)
    .gte("event_date", now)
    .lte("event_date", sevenDaysLater)
    .order("event_date", { ascending: true })
    .limit(5)

  if (error) return NextResponse.json({ events: [] })

  const events = (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    type: (r.type as string | null) ?? "event",
    event_date: r.event_date as string,
    artist_or_drama: (r.artist_or_drama as string | null) ?? "",
    venue_city: (r.venue_city as string | null) ?? null,
    venue_country_code: (r.venue_country_code as string | null) ?? null,
  }))

  return NextResponse.json({ events })
}
