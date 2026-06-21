import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const revalidate = 3600

export async function GET() {
  const admin = createSupabaseAdminClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" })

  const { data, error } = await admin
    .from("hallyu_calendar_events")
    .select("id, title, type, event_date, artist_or_drama, venue_city, venue_country_code")
    .gte("event_date", monthStart)
    .lte("event_date", monthEnd)
    .order("event_date", { ascending: true })
    .limit(100)

  if (error || !data) {
    return NextResponse.json({ countryCount: 0, cityCount: 0, topCities: [], comebacks: [], dramaEvents: [], monthLabel })
  }

  type Row = {
    id: string; title: string; type: string | null; event_date: string;
    artist_or_drama: string | null; venue_city: string | null; venue_country_code: string | null
  }
  const rows = data as Row[]

  const countryCodes = new Set<string>()
  const cities = new Set<string>()
  const cityCounts = new Map<string, number>()
  for (const r of rows) {
    if (r.venue_country_code) countryCodes.add(r.venue_country_code)
    if (r.venue_city) {
      cities.add(r.venue_city)
      cityCounts.set(r.venue_city, (cityCounts.get(r.venue_city) ?? 0) + 1)
    }
  }

  const topCities = [...cityCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([city]) => city)

  type MonthEvent = { id: string; title: string; artist_or_drama: string; event_date: string }
  const toMonthEvent = (r: Row): MonthEvent => ({
    id: r.id, title: r.title,
    artist_or_drama: r.artist_or_drama ?? r.title,
    event_date: r.event_date,
  })

  const dramaEvents = rows.filter(r => r.type === "drama").slice(0, 4).map(toMonthEvent)
  let comebacks = rows.filter(r => r.type === "comeback").slice(0, 4).map(toMonthEvent)

  if (comebacks.length === 0) {
    const sixtyDaysLater = new Date(now.getTime() + 60 * 86400_000).toISOString()
    const { data: upcoming } = await admin
      .from("hallyu_calendar_events")
      .select("id, title, artist_or_drama, event_date")
      .eq("type", "comeback")
      .gte("event_date", now.toISOString())
      .lte("event_date", sixtyDaysLater)
      .order("event_date", { ascending: true })
      .limit(4)
    type ComingRow = { id: string; title: string; artist_or_drama: string | null; event_date: string }
    comebacks = ((upcoming ?? []) as ComingRow[]).map(r => ({
      id: r.id, title: r.title,
      artist_or_drama: r.artist_or_drama ?? r.title,
      event_date: r.event_date,
    }))
  }

  return NextResponse.json({
    countryCount: countryCodes.size,
    cityCount: cities.size,
    topCities,
    comebacks,
    dramaEvents,
    monthLabel,
  })
}
