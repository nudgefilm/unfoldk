import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { CronMonitor } from "@/components/admin/cron-monitor"

export const dynamic = "force-dynamic"

export interface CronLogRow {
  id: string
  route: string
  status: "success" | "failed"
  result_json: Record<string, unknown> | null
  executed_at: string
}

interface RouteSummary {
  route: string
  lastExecutedAt: string | null
  lastStatus: "success" | "failed" | null
  metric: string                                     // 수집 이벤트 수 or 발송 수 — 라우트별 의미 다름
  metricLabel: string
}

const ROUTES = ["ingest-all", "send-reminders"] as const

// 각 라우트의 가장 최근 로그를 1건씩 조회
async function loadSummaries(): Promise<RouteSummary[]> {
  const supabase = createSupabaseAdminClient()

  const summaries: RouteSummary[] = []

  for (const route of ROUTES) {
    const { data } = await supabase
      .from("cron_logs")
      .select("status, result_json, executed_at")
      .eq("route", route)
      .order("executed_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!data) {
      summaries.push({
        route,
        lastExecutedAt: null,
        lastStatus: null,
        metric: "—",
        metricLabel: route === "ingest-all" ? "수집 이벤트" : "발송 수",
      })
      continue
    }

    // 라우트별로 result_json 안에서 핵심 메트릭 추출
    let metric = "—"
    if (route === "ingest-all" && data.result_json) {
      // tmdb/youtube/lastfm 각 단계의 inserted/updated 합산 — 정확한 키는 ingest 결과에 따라 다르므로 대략치
      const total = Object.values(data.result_json as Record<string, unknown>).reduce<number>((acc, v) => {
        if (typeof v === "object" && v !== null) {
          const obj = v as Record<string, unknown>
          const ins = typeof obj.inserted === "number" ? obj.inserted : 0
          const upd = typeof obj.updated === "number" ? obj.updated : 0
          return acc + ins + upd
        }
        return acc
      }, 0)
      metric = total.toLocaleString()
    } else if (route === "send-reminders" && data.result_json) {
      const summary = (data.result_json as { summary?: { sent?: number } }).summary
      metric = (summary?.sent ?? 0).toLocaleString()
    }

    summaries.push({
      route,
      lastExecutedAt: data.executed_at,
      lastStatus: data.status,
      metric,
      metricLabel: route === "ingest-all" ? "수집 이벤트" : "발송 수",
    })
  }

  return summaries
}

async function loadRecentLogs(): Promise<CronLogRow[]> {
  const supabase = createSupabaseAdminClient()
  const { data } = await supabase
    .from("cron_logs")
    .select("id, route, status, result_json, executed_at")
    .order("executed_at", { ascending: false })
    .limit(20)
  return (data ?? []) as CronLogRow[]
}

export default async function AdminCronPage() {
  const [summaries, logs] = await Promise.all([loadSummaries(), loadRecentLogs()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold mb-1">Cron 모니터</h1>
        <p className="text-muted-foreground text-sm">자동 인제스트 + 리마인더 발송 상태</p>
      </div>

      <CronMonitor summaries={summaries} logs={logs} />
    </div>
  )
}
