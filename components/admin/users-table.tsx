"use client"

import { useMemo, useState, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { isInTrial, trialDaysRemaining } from "@/lib/auth/plan"

type PlanType = "free" | "monthly" | "annual"

export interface AdminUserRow {
  id: string
  email: string
  name: string | null
  plan_type: PlanType
  is_admin: boolean
  created_at: string
  trial_ends_at: string | null
}

function TrialBadge({ trialEndsAt }: { trialEndsAt: string | null }) {
  if (!trialEndsAt) return <span className="text-muted-foreground text-xs">—</span>
  if (!isInTrial(trialEndsAt)) {
    return <span className="text-xs text-[#888]">Expired</span>
  }
  const days = trialDaysRemaining(trialEndsAt)
  const isUrgent = days <= 7
  return (
    <span
      className="text-xs font-medium px-1.5 py-0.5 rounded"
      style={{
        color: isUrgent ? "#FF8C00" : "#FF4B6E",
        background: isUrgent ? "rgba(255,140,0,0.12)" : "rgba(255,75,110,0.12)",
      }}
    >
      D-{days}
    </span>
  )
}

export function UsersTable({ users: initial }: { users: AdminUserRow[] }) {
  const [users, setUsers] = useState<AdminUserRow[]>(initial)
  const [search, setSearch] = useState("")
  const [, startTransition] = useTransition()
  const { toast } = useToast()

  // 이메일 검색 — 클라이언트 필터링 (500명 한도라 충분)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => u.email.toLowerCase().includes(q))
  }, [users, search])

  async function patchUser(id: string, payload: Partial<Pick<AdminUserRow, "plan_type" | "is_admin">>) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast({ title: "변경 실패", description: body.error?.toString?.() ?? "알 수 없는 오류" })
      return false
    }
    return true
  }

  function onChangePlan(id: string, plan: PlanType) {
    const prev = users
    // 낙관적 업데이트
    setUsers((rows) => rows.map((r) => (r.id === id ? { ...r, plan_type: plan } : r)))
    startTransition(async () => {
      const ok = await patchUser(id, { plan_type: plan })
      if (!ok) setUsers(prev)
      else toast({ title: "플랜 변경 완료" })
    })
  }

  function onToggleAdmin(id: string, isAdmin: boolean) {
    const prev = users
    setUsers((rows) => rows.map((r) => (r.id === id ? { ...r, is_admin: isAdmin } : r)))
    startTransition(async () => {
      const ok = await patchUser(id, { is_admin: isAdmin })
      if (!ok) setUsers(prev)
      else toast({ title: isAdmin ? "관리자 권한 부여" : "관리자 권한 회수" })
    })
  }

  return (
    <div className="space-y-4">
      <Input
        type="search"
        placeholder="이메일로 검색..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm bg-[#1a1a1a] border-[#2a2a2a]"
      />

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2a2a2a]">
              <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">이메일</th>
              <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">이름</th>
              <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">가입일</th>
              <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">플랜</th>
              <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">Trial</th>
              <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">관리자</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted-foreground text-sm text-center py-8">
                  결과 없음
                </td>
              </tr>
            )}
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-[#2a2a2a] last:border-b-0 hover:bg-[#202024]">
                <td className="text-foreground text-sm px-4 py-3">{u.email}</td>
                <td className="text-muted-foreground text-sm px-4 py-3">{u.name ?? "—"}</td>
                <td className="text-muted-foreground text-sm px-4 py-3">
                  {/* timeZone 명시 — SSR(UTC) vs hydrate(브라우저 TZ) 불일치 방지 (React #418) */}
                  {new Date(u.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
                </td>
                <td className="px-4 py-3">
                  <Select value={u.plan_type} onValueChange={(v) => onChangePlan(u.id, v as PlanType)}>
                    <SelectTrigger className="w-[120px] bg-[#0d0d0f] border-[#2a2a2a]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <TrialBadge trialEndsAt={u.trial_ends_at} />
                </td>
                <td className="px-4 py-3">
                  <Switch
                    checked={u.is_admin}
                    onCheckedChange={(checked) => onToggleAdmin(u.id, checked)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
