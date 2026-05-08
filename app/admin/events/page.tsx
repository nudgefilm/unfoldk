import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { EventsManager } from "@/components/admin/events-manager"

export const dynamic = "force-dynamic"

export interface AdminEventRow {
  id: string
  type: "comeback" | "drama" | "concert" | "fanmeet"
  title: string
  artist_or_drama: string
  event_date: string
  event_time_label: string | null
  description: string | null
  source_api: string | null
  is_premium: boolean
}

async function loadEvents(): Promise<AdminEventRow[]> {
  // service_role로 모든 이벤트(프리미엄 포함) 조회
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("hallyu_calendar_events")
    .select("id, type, title, artist_or_drama, event_date, event_time_label, description, source_api, is_premium")
    .order("event_date", { ascending: false })
    .limit(500)

  if (error) {
    console.error("[admin/events] 조회 실패:", error.message)
    return []
  }
  return (data ?? []) as AdminEventRow[]
}

export default async function AdminEventsPage() {
  const events = await loadEvents()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold mb-1">이벤트 관리</h1>
        <p className="text-muted-foreground text-sm">총 {events.length.toLocaleString()}건 (최근 500건)</p>
      </div>

      <EventsManager events={events} />
    </div>
  )
}
