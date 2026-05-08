import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { FanEventsTable } from "@/components/admin/fan-events-table"

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

async function loadRequests(): Promise<AdminFanEventRow[]> {
  const supabase = createSupabaseAdminClient()
  // pending 우선 정렬을 위해 status enum을 정렬 우선순위로 변환 — Supabase의 raw order로는 어려워 두 번 쿼리
  const { data, error } = await supabase
    .from("fan_event_requests")
    .select("id, user_id, title, description, event_date, location, proof_url, status, admin_note, created_at, reviewed_at")
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) {
    console.error("[admin/fan-events] 조회 실패:", error.message)
    return []
  }

  // 신청자 이메일 lookup
  const userIds = Array.from(new Set((data ?? []).map((r) => r.user_id)))
  let emailMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: users } = await supabase.from("users").select("id, email").in("id", userIds)
    emailMap = new Map((users ?? []).map((u) => [u.id, u.email]))
  }

  // pending이 항상 위에 오도록 클라이언트 정렬
  const order = { pending: 0, approved: 1, rejected: 2 } as const
  const rows = (data ?? []).map((r) => ({
    ...r,
    user_email: emailMap.get(r.user_id) ?? null,
  })) as AdminFanEventRow[]

  rows.sort((a, b) => order[a.status] - order[b.status])
  return rows
}

export default async function AdminFanEventsPage() {
  const rows = await loadRequests()
  const pendingCount = rows.filter((r) => r.status === "pending").length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold mb-1">팬 행사 신청</h1>
        <p className="text-muted-foreground text-sm">
          대기 {pendingCount.toLocaleString()}건 / 전체 {rows.length.toLocaleString()}건
        </p>
      </div>

      <FanEventsTable rows={rows} />
    </div>
  )
}
