import Link from "next/link"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { UsersTable } from "@/components/admin/users-table"
import { AdminErrorBanner } from "@/components/admin/admin-error-banner"
import { formatPostgrestError } from "@/lib/admin/format-error"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 50

interface AdminUserRow {
  id: string
  email: string
  name: string | null
  plan_type: "free" | "monthly" | "annual"
  is_admin: boolean
  agreed_to_terms: boolean
  created_at: string
  trial_ends_at: string | null
}

type LoadResult =
  | { ok: true; users: AdminUserRow[]; total: number }
  | { ok: false; error: string }

async function loadUsers(page: number): Promise<LoadResult> {
  const supabase = createSupabaseAdminClient()
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data, error, count } = await supabase
    .from("users")
    .select("id, email, name, plan_type, is_admin, agreed_to_terms, created_at, trial_ends_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to)

  if (error) {
    console.error("[admin/users] 조회 실패:", error)
    return { ok: false, error: formatPostgrestError(error) }
  }
  return { ok: true, users: (data ?? []) as AdminUserRow[], total: count ?? 0 }
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1)
  const result = await loadUsers(page)
  const totalPages = result.ok ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1
  const safePage = Math.min(page, totalPages)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold mb-1">유저 관리</h1>
        <p className="text-muted-foreground text-sm">
          {result.ok
            ? `전체 ${result.total.toLocaleString()}명 · 페이지 ${safePage} / ${totalPages}`
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

      {result.ok && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <p className="text-muted-foreground text-sm">
            {((safePage - 1) * PAGE_SIZE + 1).toLocaleString()}–
            {Math.min(safePage * PAGE_SIZE, result.total).toLocaleString()} / {result.total.toLocaleString()}명
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/users?page=${safePage - 1}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                safePage <= 1
                  ? "border-border/20 text-muted-foreground/40 pointer-events-none"
                  : "border-border/40 text-foreground hover:bg-secondary/50"
              }`}
              aria-disabled={safePage <= 1}
            >
              이전
            </Link>
            <span className="text-sm text-muted-foreground px-1">
              {safePage} / {totalPages}
            </span>
            <Link
              href={`/admin/users?page=${safePage + 1}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                safePage >= totalPages
                  ? "border-border/20 text-muted-foreground/40 pointer-events-none"
                  : "border-border/40 text-foreground hover:bg-secondary/50"
              }`}
              aria-disabled={safePage >= totalPages}
            >
              다음
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
