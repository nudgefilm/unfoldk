import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { ReportsTable } from "@/components/admin/reports-table"
import { AdminErrorBanner } from "@/components/admin/admin-error-banner"
import { formatPostgrestError } from "@/lib/admin/format-error"

export const dynamic = "force-dynamic"

export interface AdminReportRow {
  id: string
  content_type: "event" | "artist" | "drama" | "phrase" | "recipe"
  content_id: string
  user_id: string
  user_email: string | null
  reason: "mismapping" | "date_error" | "duplicate" | "cancelled" | "other"
  note: string | null
  status: "pending" | "reviewed" | "dismissed"
  created_at: string
  reviewed_at: string | null
}

type LoadResult =
  | { ok: true; rows: AdminReportRow[] }
  | { ok: false; error: string }

async function loadReports(): Promise<LoadResult> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("content_reports")
    .select("id, content_type, content_id, user_id, reason, note, status, created_at, reviewed_at")
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) {
    // 빈 배열 fallback 금지 — 에러를 화면에 가시화 (2026-05-09 인시던트 회고)
    console.error("[admin/reports] 조회 실패:", error)
    return { ok: false, error: formatPostgrestError(error) }
  }

  // 신고자 이메일 부가 lookup — 실패해도 메인 데이터는 살림
  const userIds = Array.from(new Set((data ?? []).map((r) => r.user_id)))
  let emailMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email")
      .in("id", userIds)
    if (usersError) {
      console.error("[admin/reports] users lookup 실패 (이메일 미표시):", usersError)
    } else {
      emailMap = new Map((users ?? []).map((u) => [u.id, u.email]))
    }
  }

  // pending 우선 정렬 — 어드민이 처리해야 할 것 항상 위
  const order = { pending: 0, reviewed: 1, dismissed: 2 } as const
  const rows = (data ?? []).map((r) => ({
    ...r,
    user_email: emailMap.get(r.user_id) ?? null,
  })) as AdminReportRow[]
  rows.sort((a, b) => order[a.status] - order[b.status])

  return { ok: true, rows }
}

export default async function AdminReportsPage() {
  const result = await loadReports()
  const pendingCount = result.ok ? result.rows.filter((r) => r.status === "pending").length : 0
  const totalCount = result.ok ? result.rows.length : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold mb-1">콘텐츠 신고</h1>
        <p className="text-muted-foreground text-sm">
          {result.ok
            ? `대기 ${pendingCount.toLocaleString()}건 / 전체 ${totalCount.toLocaleString()}건`
            : "조회 실패"}
        </p>
      </div>

      {!result.ok && (
        <AdminErrorBanner
          title="신고 조회 실패"
          detail={result.error}
          logPrefix="[admin/reports]"
        />
      )}

      {result.ok && <ReportsTable rows={result.rows} />}
    </div>
  )
}
