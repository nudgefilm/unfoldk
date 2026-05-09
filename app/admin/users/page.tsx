import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { UsersTable } from "@/components/admin/users-table"
import { AdminErrorBanner } from "@/components/admin/admin-error-banner"
import { formatPostgrestError } from "@/lib/admin/format-error"

export const dynamic = "force-dynamic"

interface AdminUserRow {
  id: string
  email: string
  name: string | null
  plan_type: "free" | "monthly" | "annual"
  is_admin: boolean
  created_at: string
}

type LoadResult =
  | { ok: true; users: AdminUserRow[] }
  | { ok: false; error: string }

async function loadUsers(): Promise<LoadResult> {
  // service_role 로 전체 유저 조회 — layout 이 이미 is_admin 검증함
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("users")
    .select("id, email, name, plan_type, is_admin, created_at")
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) {
    console.error("[admin/users] 조회 실패:", error)
    return { ok: false, error: formatPostgrestError(error) }
  }
  return { ok: true, users: (data ?? []) as AdminUserRow[] }
}

export default async function AdminUsersPage() {
  const result = await loadUsers()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold mb-1">유저 관리</h1>
        <p className="text-muted-foreground text-sm">
          {result.ok
            ? `총 ${result.users.length.toLocaleString()}명 (최근 500명)`
            : "조회 실패"}
        </p>
      </div>

      {!result.ok && (
        <AdminErrorBanner
          title="유저 조회 실패"
          detail={result.error}
          logPrefix="[admin/users]"
        />
      )}

      {result.ok && <UsersTable users={result.users} />}
    </div>
  )
}
