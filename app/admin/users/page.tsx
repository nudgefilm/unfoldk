import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { UsersTable } from "@/components/admin/users-table"

export const dynamic = "force-dynamic"

interface AdminUserRow {
  id: string
  email: string
  name: string | null
  plan_type: "free" | "monthly" | "annual"
  is_admin: boolean
  created_at: string
}

async function loadUsers(): Promise<AdminUserRow[]> {
  // service_role로 전체 유저 조회 — layout이 이미 is_admin 검증함
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("users")
    .select("id, email, name, plan_type, is_admin, created_at")
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) {
    console.error("[admin/users] 조회 실패:", error.message)
    return []
  }
  return (data ?? []) as AdminUserRow[]
}

export default async function AdminUsersPage() {
  const users = await loadUsers()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold mb-1">유저 관리</h1>
        <p className="text-muted-foreground text-sm">총 {users.length.toLocaleString()}명 (최근 500명)</p>
      </div>

      <UsersTable users={users} />
    </div>
  )
}
