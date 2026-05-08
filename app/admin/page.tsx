import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// MRR/MAU 집계는 RLS 우회 필요 — 이미 layout이 is_admin 검증했으므로 admin 클라이언트 사용
export const dynamic = "force-dynamic"

interface DashboardStats {
  totalUsers: number
  paidUsers: number
  monthlyCount: number
  annualCount: number
  freeCount: number
  mrrUsd: number
  newSignupsThisMonth: number
  couponsIssued: number
  couponsRedeemed: number
}

async function loadStats(): Promise<DashboardStats> {
  const supabase = createSupabaseAdminClient()

  // 이번 달 시작 (UTC 기준)
  const now = new Date()
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

  const [
    { count: totalUsers },
    { count: monthlyCount },
    { count: annualCount },
    { count: freeCount },
    { count: newSignupsThisMonth },
    { count: couponsIssued },
    { count: couponsRedeemed },
  ] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("users").select("id", { count: "exact", head: true }).eq("plan_type", "monthly"),
    supabase.from("users").select("id", { count: "exact", head: true }).eq("plan_type", "annual"),
    supabase.from("users").select("id", { count: "exact", head: true }).eq("plan_type", "free"),
    supabase.from("users").select("id", { count: "exact", head: true }).gte("created_at", startOfMonth),
    supabase.from("coupons").select("id", { count: "exact", head: true }),
    supabase.from("coupons").select("id", { count: "exact", head: true }).not("used_by", "is", null),
  ])

  // 월 환산 매출: monthly $15 + annual $10 (연 $120 / 12)
  const monthly = monthlyCount ?? 0
  const annual = annualCount ?? 0
  const mrrUsd = monthly * 15 + annual * 10

  return {
    totalUsers: totalUsers ?? 0,
    paidUsers: monthly + annual,
    monthlyCount: monthly,
    annualCount: annual,
    freeCount: freeCount ?? 0,
    mrrUsd,
    newSignupsThisMonth: newSignupsThisMonth ?? 0,
    couponsIssued: couponsIssued ?? 0,
    couponsRedeemed: couponsRedeemed ?? 0,
  }
}

function StatCard({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
      <p className="text-muted-foreground text-sm mb-2">{label}</p>
      <p className="text-foreground text-3xl font-bold">
        {value}
        {suffix && <span className="text-muted-foreground text-base font-normal ml-1">{suffix}</span>}
      </p>
    </div>
  )
}

export default async function AdminDashboardPage() {
  const stats = await loadStats()
  const total = stats.totalUsers || 1 // 0 나눗셈 방지

  // 플랜 분포 — 비율은 정수 % 표시
  const distribution = [
    { plan: "Free", count: stats.freeCount, color: "#888888" },
    { plan: "Monthly", count: stats.monthlyCount, color: "#FF4B6E" },
    { plan: "Annual", count: stats.annualCount, color: "#22c55e" },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-foreground text-2xl font-semibold mb-1">대시보드</h1>
        <p className="text-muted-foreground text-sm">UnfoldK 운영 지표 — 이번 달 기준</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="총 유저 (MAU)" value={stats.totalUsers.toLocaleString()} />
        <StatCard label="유료 유저" value={stats.paidUsers.toLocaleString()} />
        <StatCard label="이번 달 MRR" value={`$${stats.mrrUsd.toLocaleString()}`} />
        <StatCard label="신규 가입 (이번 달)" value={stats.newSignupsThisMonth.toLocaleString()} />
        <StatCard label="발급된 쿠폰" value={stats.couponsIssued.toLocaleString()} />
        <StatCard
          label="사용된 쿠폰"
          value={stats.couponsRedeemed.toLocaleString()}
          suffix={
            stats.couponsIssued > 0
              ? `(${Math.round((stats.couponsRedeemed / stats.couponsIssued) * 100)}%)`
              : undefined
          }
        />
      </div>

      <section>
        <h2 className="text-foreground text-lg font-semibold mb-3">플랜 분포</h2>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th className="text-left text-muted-foreground text-sm font-medium px-5 py-3">플랜</th>
                <th className="text-right text-muted-foreground text-sm font-medium px-5 py-3">유저 수</th>
                <th className="text-right text-muted-foreground text-sm font-medium px-5 py-3">비율</th>
              </tr>
            </thead>
            <tbody>
              {distribution.map((row) => (
                <tr key={row.plan} className="border-b border-[#2a2a2a] last:border-b-0">
                  <td className="text-foreground text-sm px-5 py-3">
                    <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: row.color }} />
                    {row.plan}
                  </td>
                  <td className="text-foreground text-sm text-right px-5 py-3">{row.count.toLocaleString()}</td>
                  <td className="text-foreground text-sm text-right px-5 py-3">
                    {Math.round((row.count / total) * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
