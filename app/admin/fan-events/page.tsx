import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { FanEventsTable } from "@/components/admin/fan-events-table"
import { AdminErrorBanner } from "@/components/admin/admin-error-banner"
import { formatPostgrestError } from "@/lib/admin/format-error"

export const dynamic = "force-dynamic"

export interface AdminFanEventRow {
  id: string
  user_id: string
  user_email: string | null
  title: string
  description: string | null
  event_date: string
  location: string | null
  proof_url: string | null
  status: "pending" | "approved" | "rejected"
  admin_note: string | null
  created_at: string
  reviewed_at: string | null
}

type LoadResult =
  | { ok: true; rows: AdminFanEventRow[] }
  | { ok: false; error: string }

async function loadRequests(): Promise<LoadResult> {
  const supabase = createSupabaseAdminClient()
  // pending 우선 정렬을 위해 status enum 을 정렬 우선순위로 변환 — Supabase raw order 로는 어려워 두 번 쿼리
  const { data, error } = await supabase
    .from("fan_event_requests")
    .select("id, user_id, title, description, event_date, location, proof_url, status, admin_note, created_at, reviewed_at")
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) {
    // 빈 배열 fallback 금지 — 권한/네트워크 오류를 화면에 가시화 (2026-05-09 인시던트 회고)
    console.error("[admin/fan-events] 조회 실패:", error)
    return { ok: false, error: formatPostgrestError(error) }
  }

  // 신청자 이메일 lookup — 부가 정보라 실패해도 메인 데이터는 살리되, 콘솔에는 남김
  const userIds = Array.from(new Set((data ?? []).map((r) => r.user_id)))
  let emailMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email")
      .in("id", userIds)
    if (usersError) {
      console.error("[admin/fan-events] users lookup 실패 (이메일 미표시):", usersError)
    } else {
      emailMap = new Map((users ?? []).map((u) => [u.id, u.email]))
    }
  }

  // pending 이 항상 위에 오도록 클라이언트 정렬
  const order = { pending: 0, approved: 1, rejected: 2 } as const
  const rows = (data ?? []).map((r) => ({
    ...r,
    user_email: emailMap.get(r.user_id) ?? null,
  })) as AdminFanEventRow[]

  rows.sort((a, b) => order[a.status] - order[b.status])
  return { ok: true, rows }
}

export default async function AdminFanEventsPage() {
  const result = await loadRequests()
  const pendingCount = result.ok ? result.rows.filter((r) => r.status === "pending").length : 0
  const totalCount = result.ok ? result.rows.length : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold mb-1">팬 행사 신청</h1>
        <p className="text-muted-foreground text-sm">
          {result.ok
            ? `대기 ${pendingCount.toLocaleString()}건 / 전체 ${totalCount.toLocaleString()}건`
            : "조회 실패"}
        </p>
      </div>

      {!result.ok && (
        <AdminErrorBanner
          title="팬 행사 신청 조회 실패"
          detail={result.error}
          logPrefix="[admin/fan-events]"
        />
      )}

      {result.ok && <FanEventsTable rows={result.rows} />}
    </div>
  )
}
