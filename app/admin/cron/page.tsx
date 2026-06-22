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

interface CronAction {
  label: string
  params?: Record<string, string>
}

export interface RouteSummary {
  route: string
  displayName: string
  lastExecutedAt: string | null
  lastStatus: "success" | "failed" | null
  metric: string
  metricLabel: string
  actions?: CronAction[]
}

export interface ServiceGroup {
  label: string
  routes: string[]
}

// KOPIS 는 2026-05-16 폐기. ingest-curation-k 는 2026-05-22 tour-spots + filming-kpop 으로 분리됨.
// ⚠️ 신규 cron 추가 시 동기화 필수:
//   1. vercel.json crons
//   2. 아래 ROUTES + DISPLAY_NAMES + SERVICE_GROUPS
//   3. app/api/admin/cron/run/route.ts (import + enum + CRON_HANDLERS)
//   4. components/admin/cron-monitor.tsx (summarizeRunResult)

const ROUTES = [
  "ingest-all",
  "ingest-ticketmaster",
  "send-reminders",
  "ingest-kpop-stats",
  "kpop-weekly",
  "ingest-tmdb-dramas",
  "ingest-tour-spots",
  "ingest-filming-kpop",
  "backfill-filming-descriptions",
  "ingest-korean-phrases",
  "ingest-food-recipes",
  "weekly-report",
  "generate-artist-reports",
  "generate-comeback-guides",
  "generate-monthly-report",
  "generate-weekly-routines",
] as const

const DISPLAY_NAMES: Record<(typeof ROUTES)[number], string> = {
  "ingest-all":                    "전체 이벤트 수집 (YouTube·TMDB·Last.fm)",
  "ingest-ticketmaster":           "Ticketmaster 공연·이벤트 수집",
  "send-reminders":                "D-7·D-1·당일 이메일 알림 발송",
  "ingest-kpop-stats":             "아티스트 통계 수집 (YouTube·Last.fm)",
  "kpop-weekly":                   "주간 인사이트·국가차트 생성",
  "ingest-tmdb-dramas":            "TMDB 드라마 수집",
  "ingest-tour-spots":             "TourAPI 관광지·맛집·축제 수집",
  "ingest-filming-kpop":           "촬영지 + K팝 성지 수집",
  "backfill-filming-descriptions": "촬영지 설명 backfill",
  "ingest-korean-phrases":         "드라마 표현 생성",
  "ingest-food-recipes":           "레시피 수집",
  "weekly-report":                 "주간 한류 트렌드 리포트",
  "generate-artist-reports":       "아티스트 위클리 리포트",
  "generate-comeback-guides":      "컴백 가이드 생성",
  "generate-monthly-report":       "월간 트렌드 리포트",
  "generate-weekly-routines":      "한류 루틴 생성",
}

const METRIC_LABELS: Record<(typeof ROUTES)[number], string> = {
  "ingest-all":                    "수집 이벤트",
  "ingest-ticketmaster":           "수집 이벤트",
  "send-reminders":                "발송 수",
  "ingest-kpop-stats":             "아티스트 갱신",
  "kpop-weekly":                   "생성된 주차",
  "ingest-tmdb-dramas":            "드라마 수집",
  "ingest-tour-spots":             "tour_spots 신규/변경",
  "ingest-filming-kpop":           "촬영지 + K팝 성지 신규",
  "backfill-filming-descriptions": "description 보충 수",
  "ingest-korean-phrases":         "생성 표현 수",
  "ingest-food-recipes":           "레시피 + 이미지 매칭",
  "weekly-report":                 "생성된 주차",
  "generate-artist-reports":       "저장 리포트",
  "generate-comeback-guides":      "생성 가이드",
  "generate-monthly-report":       "생성된 월",
  "generate-weekly-routines":      "생성 루틴",
}

// 어드민 수동 실행 버튼 — 다중 버튼이 필요한 라우트만 정의
const ROUTE_ACTIONS: Partial<Record<(typeof ROUTES)[number], CronAction[]>> = {
  "ingest-tour-spots": [
    { label: "축제만 (빠른)", params: { only_festivals: "true" } },
    { label: "전체 카테고리" },
  ],
}

// 서비스별 그룹 — 아코디언 섹션 순서
export const SERVICE_GROUPS: ServiceGroup[] = [
  {
    label: "HallyuCalendar",
    routes: ["ingest-all", "ingest-ticketmaster", "send-reminders"],
  },
  {
    label: "KpopStats",
    routes: ["ingest-kpop-stats", "kpop-weekly"],
  },
  {
    label: "KdramaMatch",
    routes: ["ingest-tmdb-dramas"],
  },
  {
    label: "Curation K",
    routes: ["ingest-tour-spots", "ingest-filming-kpop", "backfill-filming-descriptions"],
  },
  {
    label: "HangeulGo",
    routes: ["ingest-korean-phrases"],
  },
  {
    label: "KfoodKit",
    routes: ["ingest-food-recipes"],
  },
  {
    label: "Hallyu Pass",
    routes: ["weekly-report", "generate-artist-reports", "generate-comeback-guides", "generate-monthly-report", "generate-weekly-routines"],
  },
]

type LoadResult =
  | { ok: true; summaries: RouteSummary[]; logs: CronLogRow[] }
  | { ok: false; error: string }

async function load(): Promise<LoadResult> {
  const supabase = createSupabaseAdminClient()

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

    const metricLabel = METRIC_LABELS[route]
    const displayName = DISPLAY_NAMES[route]
    const actions = ROUTE_ACTIONS[route]

    if (!data) {
      summaries.push({
        route,
        displayName,
        lastExecutedAt: null,
        lastStatus: null,
        metric: "—",
        metricLabel,
        actions,
      })
      continue
    }

    const r = (data.result_json ?? {}) as Record<string, unknown>
    let metric = "—"

    if (route === "ingest-all") {
      const direct = typeof r.total_upserted === "number" ? r.total_upserted : null
      const total =
        direct ??
        Object.values(r).reduce<number>((acc, v) => {
          if (typeof v !== "object" || v === null) return acc
          const u = (v as { upserted?: unknown }).upserted
          return acc + (typeof u === "number" ? u : 0)
        }, 0)
      metric = total.toLocaleString()
    } else if (route === "ingest-ticketmaster") {
      metric = ((r.upserted as number | undefined) ?? 0).toLocaleString()
    } else if (route === "ingest-tour-spots") {
      metric = ((r.total_upserted as number | undefined) ?? 0).toLocaleString()
    } else if (route === "ingest-filming-kpop") {
      const filming = r.filming as { spotsInserted?: number } | null | undefined
      const kpop = r.kpop as { spotsUpserted?: number } | null | undefined
      metric = ((filming?.spotsInserted ?? 0) + (kpop?.spotsUpserted ?? 0)).toLocaleString()
    } else if (route === "ingest-kpop-stats") {
      metric = ((r.upserted as number | undefined) ?? 0).toLocaleString()
    } else if (route === "ingest-tmdb-dramas") {
      metric = ((r.upserted as number | undefined) ?? 0).toLocaleString()
    } else if (route === "ingest-korean-phrases") {
      metric = ((r.generated as number | undefined) ?? 0).toLocaleString()
    } else if (route === "ingest-food-recipes") {
      const ingested = (r.upserted as number | undefined) ?? 0
      const bf = r.backfill as { phase1_updated?: number; phase2_updated?: number; phase3_updated?: number } | null | undefined
      const img = (bf?.phase1_updated ?? 0) + (bf?.phase2_updated ?? 0) + (bf?.phase3_updated ?? 0)
      metric = (ingested + img).toLocaleString()
    } else if (route === "send-reminders") {
      const summary = r.summary as { sent?: number } | undefined
      metric = (summary?.sent ?? 0).toLocaleString()
    } else if (route === "backfill-filming-descriptions") {
      metric = ((r.updated as number | undefined) ?? 0).toLocaleString()
    } else if (route === "weekly-report") {
      const wr = r as { duplicate?: boolean; week_start?: string }
      metric = wr.duplicate ? "skip" : (wr.week_start ?? "—")
    } else if (route === "generate-artist-reports") {
      metric = ((r.saved as number | undefined) ?? 0).toLocaleString()
    } else if (route === "generate-comeback-guides") {
      metric = ((r.saved as number | undefined) ?? 0).toLocaleString()
    } else if (route === "generate-monthly-report") {
      metric = (r.month as string | undefined) ?? "—"
    } else if (route === "generate-weekly-routines") {
      metric = ((r.saved as number | undefined) ?? 0).toLocaleString()
    }

    summaries.push({
      route,
      displayName,
      lastExecutedAt: data.executed_at,
      lastStatus: data.status,
      metric,
      metricLabel,
      actions,
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
          {result.ok ? "서비스별 자동 수집·생성 현황" : "조회 실패"}
        </p>
      </div>

      {!result.ok && (
        <AdminErrorBanner
          title="Cron 로그 조회 실패"
          detail={result.error}
          logPrefix="[admin/cron]"
        />
      )}

      {result.ok && (
        <CronMonitor
          summaries={result.summaries}
          logs={result.logs}
          groups={SERVICE_GROUPS}
        />
      )}
    </div>
  )
}
