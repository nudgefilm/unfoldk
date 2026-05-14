import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { CronMonitor } from "@/components/admin/cron-monitor"
import { AdminErrorBanner } from "@/components/admin/admin-error-banner"
import { formatPostgrestError } from "@/lib/admin/format-error"

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

const ROUTES = ["ingest-all", "ingest-kopis", "ingest-ticketmaster", "send-reminders"] as const

type LoadResult =
  | { ok: true; summaries: RouteSummary[]; logs: CronLogRow[] }
  | { ok: false; error: string }

// summaries + recent logs 를 하나의 트랜잭션처럼 로드.
// 어느 하나라도 실패하면 화면에는 배너만 — 0건/누락으로 위장 금지 (2026-05-09 인시던트 회고)
async function load(): Promise<LoadResult> {
  const supabase = createSupabaseAdminClient()

  // 1) 최근 로그 20건
  const { data: logsData, error: logsError } = await supabase
    .from("cron_logs")
    .select("id, route, status, result_json, executed_at")
    .order("executed_at", { ascending: false })
    .limit(20)

  if (logsError) {
    console.error("[admin/cron] cron_logs 조회 실패:", logsError)
    return { ok: false, error: formatPostgrestError(logsError) }
  }
  const logs = (logsData ?? []) as CronLogRow[]

  // 2) 각 라우트의 가장 최근 로그 1건 → summary
  const summaries: RouteSummary[] = []
  for (const route of ROUTES) {
    const { data, error: sumError } = await supabase
      .from("cron_logs")
      .select("status, result_json, executed_at")
      .eq("route", route)
      .order("executed_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (sumError) {
      console.error(`[admin/cron] summary(${route}) 조회 실패:`, sumError)
      return { ok: false, error: formatPostgrestError(sumError) }
    }

    // send-reminders 만 "발송 수", 나머지 ingest-* 는 전부 "수집 이벤트".
    const metricLabel = route === "send-reminders" ? "발송 수" : "수집 이벤트"

    if (!data) {
      summaries.push({
        route,
        lastExecutedAt: null,
        lastStatus: null,
        metric: "—",
        metricLabel,
      })
      continue
    }

    // 라우트별로 result_json 안에서 핵심 메트릭 추출
    let metric = "—"
    if (route === "ingest-all" && data.result_json) {
      // ingest-all 라우트가 payload 에 직접 total_upserted 를 박제 (단일 진실원).
      // 과거 로그는 total_upserted 없음 → 각 단계의 upserted 합산 fallback.
      // (기존 inserted/updated 키 합산 로직은 실제 ingest 결과에 그 키가 없어 항상 0 이던 버그.)
      const rj = data.result_json as Record<string, unknown>
      const direct = typeof rj.total_upserted === "number" ? rj.total_upserted : null
      const total =
        direct ??
        Object.values(rj).reduce<number>((acc, v) => {
          if (typeof v !== "object" || v === null) return acc
          const u = (v as { upserted?: unknown }).upserted
          return acc + (typeof u === "number" ? u : 0)
        }, 0)
      metric = total.toLocaleString()
    } else if (route === "ingest-kopis" && data.result_json) {
      const r = data.result_json as { upserted?: number }
      metric = (r.upserted ?? 0).toLocaleString()
    } else if (route === "ingest-ticketmaster" && data.result_json) {
      const r = data.result_json as { upserted?: number }
      metric = (r.upserted ?? 0).toLocaleString()
    } else if (route === "send-reminders" && data.result_json) {
      const summary = (data.result_json as { summary?: { sent?: number } }).summary
      metric = (summary?.sent ?? 0).toLocaleString()
    }

    summaries.push({
      route,
      lastExecutedAt: data.executed_at,
      lastStatus: data.status,
      metric,
      metricLabel,
    })
  }

  return { ok: true, summaries, logs }
}

export default async function AdminCronPage() {
  const result = await load()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold mb-1">Cron 모니터</h1>
        <p className="text-muted-foreground text-sm">
          {result.ok ? "자동 인제스트 + 리마인더 발송 상태" : "조회 실패"}
        </p>
      </div>

      {!result.ok && (
        <AdminErrorBanner
          title="Cron 로그 조회 실패"
          detail={result.error}
          logPrefix="[admin/cron]"
        />
      )}

      {result.ok && <CronMonitor summaries={result.summaries} logs={result.logs} />}
    </div>
  )
}
