import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { EventsManager } from "@/components/admin/events-manager"
import { AdminErrorBanner } from "@/components/admin/admin-error-banner"
import { formatPostgrestError } from "@/lib/admin/format-error"

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
  thumbnail_url: string | null
}

type LoadResult =
  | { ok: true; events: AdminEventRow[] }
  | { ok: false; error: string }

async function loadEvents(): Promise<LoadResult> {
  // service_role 로 모든 이벤트(프리미엄 포함) 조회
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("hallyu_calendar_events")
    .select("id, type, title, artist_or_drama, event_date, event_time_label, description, source_api, is_premium, thumbnail_url")
    .order("event_date", { ascending: false })
    .limit(500)

  if (error) {
    // 빈 배열 fallback 금지 — 0건처럼 위장되는 사고 방지 (2026-05-09 인시던트 회고)
    console.error("[admin/events] 조회 실패:", error)
    return { ok: false, error: formatPostgrestError(error) }
  }
  return { ok: true, events: (data ?? []) as AdminEventRow[] }
}

export default async function AdminEventsPage() {
  const result = await loadEvents()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold mb-1">이벤트 관리</h1>
        <p className="text-muted-foreground text-sm">
          {result.ok
            ? `총 ${result.events.length.toLocaleString()}건 (최근 500건)`
            : "조회 실패"}
        </p>
      </div>

      {!result.ok && (
        <AdminErrorBanner
          title="이벤트 조회 실패"
          detail={result.error}
          logPrefix="[admin/events]"
        />
      )}

      {result.ok && <EventsManager events={result.events} />}
    </div>
  )
}
