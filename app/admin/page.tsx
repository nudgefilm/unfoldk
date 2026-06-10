import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// MRR/MAU 집계는 RLS 우회 필요 — 이미 layout이 is_admin 검증했으므로 admin 클라이언트 사용
export const dynamic = "force-dynamic"

// ── 데이터 수집 현황 ─────────────────────────────────────────
interface ServiceCollectionStat {
  label: string
  rows: { key: string; value: string }[]
  status: "ok" | "warn" | "unknown"
  lastUpdated: string | null
}

function hoursAgo(iso: string | null): number | null {
  if (!iso) return null
  return (Date.now() - new Date(iso).getTime()) / 3_600_000
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
}

async function loadCollectionStats(): Promise<ServiceCollectionStat[]> {
  const supabase = createSupabaseAdminClient()
  const now = new Date()
  const todayUtc = now.toISOString().slice(0, 10)
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()

  const [
    calTotal,
    calToday,
    calLatest,
    kpopArtistTotal,
    kpopToday,
    kpopLatest,
    dramaTotal,
    dramaToday,
    dramaCronLog,
    foodTotal,
    foodToday,
    foodCronLog,
    phraseTotal,
    phraseToday,
    phraseCronLog,
    spotTotal,
    spotToday,
    tourTotal,
    tourToday,
    curationCronLog,
  ] = await Promise.all([
    // HallyuCalendar — 총 이벤트
    supabase.from("hallyu_calendar_events").select("id", { count: "exact", head: true }),
    // HallyuCalendar — 오늘 추가
    supabase.from("hallyu_calendar_events").select("id", { count: "exact", head: true }).gte("created_at", startOfDay),
    // HallyuCalendar — 최종 업데이트(마지막 수집 이벤트)
    supabase.from("hallyu_calendar_events").select("created_at").order("created_at", { ascending: false }).limit(1),
    // KpopStats — 총 아티스트
    supabase.from("kpop_artists").select("id", { count: "exact", head: true }),
    // KpopStats — 오늘 신규 추가된 아티스트 (kpop_artists.created_at 기준)
    supabase.from("kpop_artists").select("id", { count: "exact", head: true }).gte("created_at", startOfDay),
    // KpopStats — 최신 통계 날짜
    supabase.from("kpop_stats_daily").select("date").order("date", { ascending: false }).limit(1),
    // KdramaMatch — 총 드라마
    supabase.from("dramas").select("id", { count: "exact", head: true }),
    // KdramaMatch — 오늘 추가
    supabase.from("dramas").select("id", { count: "exact", head: true }).gte("created_at", startOfDay),
    // KdramaMatch — 마지막 cron 로그
    supabase.from("cron_logs").select("executed_at, status").eq("route", "ingest-tmdb-dramas").order("executed_at", { ascending: false }).limit(1),
    // KfoodKit — 총 레시피
    supabase.from("food_recipes").select("id", { count: "exact", head: true }),
    // KfoodKit — 오늘 추가
    supabase.from("food_recipes").select("id", { count: "exact", head: true }).gte("created_at", startOfDay),
    // KfoodKit — 마지막 cron 로그
    supabase.from("cron_logs").select("executed_at, status").eq("route", "ingest-food-recipes").order("executed_at", { ascending: false }).limit(1),
    // HangeulGo — 총 표현
    supabase.from("korean_phrases").select("id", { count: "exact", head: true }),
    // HangeulGo — 오늘 추가
    supabase.from("korean_phrases").select("id", { count: "exact", head: true }).gte("created_at", startOfDay),
    // HangeulGo — 마지막 cron 로그
    supabase.from("cron_logs").select("executed_at, status").eq("route", "ingest-korean-phrases").order("executed_at", { ascending: false }).limit(1),
    // Curation K — 총 촬영지
    supabase.from("filming_spots").select("id", { count: "exact", head: true }),
    // Curation K — 오늘 추가 촬영지
    supabase.from("filming_spots").select("id", { count: "exact", head: true }).gte("created_at", startOfDay),
    // Curation K — 총 관광지
    supabase.from("tour_spots").select("id", { count: "exact", head: true }),
    // Curation K — 오늘 추가 관광지
    supabase.from("tour_spots").select("id", { count: "exact", head: true }).gte("created_at", startOfDay),
    // Curation K — 마지막 cron 로그
    supabase.from("cron_logs").select("executed_at, status").in("route", ["ingest-curation-k", "ingest-tour-spots", "ingest-filming-kpop"]).eq("status", "success").order("executed_at", { ascending: false }).limit(1),
  ])

  type CronLogRow = { executed_at: string; status: string }
  const calLastIso: string | null = (calLatest.data?.[0] as { created_at: string } | undefined)?.created_at ?? null
  const kpopLastDate: string | null = (kpopLatest.data?.[0] as { date: string } | undefined)?.date ?? null

  const dramaCron = (dramaCronLog.data?.[0] as CronLogRow | undefined) ?? null
  const foodCron  = (foodCronLog.data?.[0]  as CronLogRow | undefined) ?? null
  const phraseCron = (phraseCronLog.data?.[0] as CronLogRow | undefined) ?? null
  const curationCron = (curationCronLog.data?.[0] as CronLogRow | undefined) ?? null

  const calHours  = hoursAgo(calLastIso)
  const kpopHours = kpopLastDate ? hoursAgo(kpopLastDate + "T23:59:59Z") : null
  const WEEKLY_OK_HOURS = 8 * 24
  const DAILY_OK_HOURS  = 48

  function cronStatus(cron: CronLogRow | null, thresholdHours: number): ServiceCollectionStat["status"] {
    if (!cron) return "unknown"
    if (cron.status !== "success") return "warn"
    const h = hoursAgo(cron.executed_at)
    return h === null ? "unknown" : h < thresholdHours ? "ok" : "warn"
  }

  return [
    {
      label: "HallyuCalendar",
      status: calHours === null ? "unknown" : calHours < 48 ? "ok" : "warn",
      lastUpdated: calLastIso,
      rows: [
        { key: "총 수집",       value: `${(calTotal.count ?? 0).toLocaleString()}건` },
        { key: "오늘 추가",     value: `${calToday.count ?? 0}건` },
        { key: "최종 업데이트", value: fmtTime(calLastIso) },
      ],
    },
    {
      label: "KpopStats",
      status: kpopHours === null ? "unknown" : kpopHours < 48 ? "ok" : "warn",
      lastUpdated: kpopLastDate ? kpopLastDate + "T00:00:00Z" : null,
      rows: [
        { key: "총 수집",       value: `${(kpopArtistTotal.count ?? 0).toLocaleString()}명` },
        { key: "오늘 추가",     value: `${kpopToday.count ?? 0}명` },
        { key: "최종 업데이트", value: kpopLastDate ?? "—" },
      ],
    },
    {
      label: "KdramaMatch",
      status: cronStatus(dramaCron, WEEKLY_OK_HOURS),
      lastUpdated: dramaCron?.executed_at ?? null,
      rows: [
        { key: "총 수집",       value: `${(dramaTotal.count ?? 0).toLocaleString()}편` },
        { key: "오늘 추가",     value: `${dramaToday.count ?? 0}편` },
        { key: "최종 업데이트", value: fmtTime(dramaCron?.executed_at ?? null) },
      ],
    },
    {
      label: "KfoodKit",
      status: cronStatus(foodCron, WEEKLY_OK_HOURS),
      lastUpdated: foodCron?.executed_at ?? null,
      rows: [
        { key: "총 수집",       value: `${(foodTotal.count ?? 0).toLocaleString()}건` },
        { key: "오늘 추가",     value: `${foodToday.count ?? 0}건` },
        { key: "최종 업데이트", value: fmtTime(foodCron?.executed_at ?? null) },
      ],
    },
    {
      label: "HangeulGo",
      status: cronStatus(phraseCron, DAILY_OK_HOURS),
      lastUpdated: phraseCron?.executed_at ?? null,
      rows: [
        { key: "총 수집",       value: `${(phraseTotal.count ?? 0).toLocaleString()}건` },
        { key: "오늘 추가",     value: `${phraseToday.count ?? 0}건` },
        { key: "최종 업데이트", value: fmtTime(phraseCron?.executed_at ?? null) },
      ],
    },
    {
      label: "Curation K",
      status: cronStatus(curationCron, WEEKLY_OK_HOURS),
      lastUpdated: curationCron?.executed_at ?? null,
      rows: [
        { key: "총 수집",       value: `${((spotTotal.count ?? 0) + (tourTotal.count ?? 0)).toLocaleString()}건` },
        { key: "오늘 추가",     value: `${(spotToday.count ?? 0) + (tourToday.count ?? 0)}건` },
        { key: "최종 업데이트", value: fmtTime(curationCron?.executed_at ?? null) },
      ],
    },
  ]
}

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

  // 월 환산 매출: monthly $9 + annual $6 (연 $72 / 12)
  const monthly = monthlyCount ?? 0
  const annual = annualCount ?? 0
  const mrrUsd = monthly * 9 + annual * 6

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

const STATUS_COLOR: Record<ServiceCollectionStat["status"], string> = {
  ok: "#22c55e",
  warn: "#ef4444",
  unknown: "#888888",
}
const STATUS_LABEL: Record<ServiceCollectionStat["status"], string> = {
  ok: "정상",
  warn: "오래된 데이터",
  unknown: "로그 없음",
}

function CollectionCard({ stat }: { stat: ServiceCollectionStat }) {
  const dot = STATUS_COLOR[stat.status]
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-foreground text-sm font-semibold">{stat.label}</p>
        <span className="flex items-center gap-1.5 text-xs" style={{ color: dot }}>
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: dot }} />
          {STATUS_LABEL[stat.status]}
        </span>
      </div>
      <dl className="space-y-1.5">
        {stat.rows.map((r) => (
          <div key={r.key} className="flex justify-between text-sm">
            <dt className="text-muted-foreground">{r.key}</dt>
            <dd className="text-foreground font-medium tabular-nums">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export default async function AdminDashboardPage() {
  const [stats, collectionStats] = await Promise.all([loadStats(), loadCollectionStats()])
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

      <section>
        <h2 className="text-foreground text-lg font-semibold mb-1">데이터 수집 현황</h2>
        <p className="text-muted-foreground text-xs mb-4">
          <span className="inline-flex items-center gap-1 mr-3"><span className="w-2 h-2 rounded-full inline-block bg-[#22c55e]" /> 정상 (48h 이내)</span>
          <span className="inline-flex items-center gap-1 mr-3"><span className="w-2 h-2 rounded-full inline-block bg-[#ef4444]" /> 오래된 데이터</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block bg-[#888888]" /> 로그 없음 (첫 실행 전)</span>
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {collectionStats.map((s) => (
            <CollectionCard key={s.label} stat={s} />
          ))}
        </div>
      </section>
    </div>
  )
}
