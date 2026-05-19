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
  label: string                                      // 버튼 라벨
  params?: Record<string, string>                    // route 에 붙일 query string
}

interface RouteSummary {
  route: string
  displayName: string                                // UI 카드 제목 (route 식별자와 분리)
  lastExecutedAt: string | null
  lastStatus: "success" | "failed" | null
  metric: string                                     // 수집 이벤트 수 or 발송 수 — 라우트별 의미 다름
  metricLabel: string
  actions?: CronAction[]                             // 미지정 시 단일 "수동 실행" 버튼 (params 없음)
}

// KOPIS 는 2026-05-16 폐기 (글로벌 유저 부적합). 과거 cron_logs 의 'ingest-kopis' 행은
// 화면에 노출 안 됨 — 필요 시 SQL 로 정리.
// ingest-filming-spots 는 2026-05-18 ingest-curation-k 에 흡수 (?include_filming=true 로 수동 실행).
const ROUTES = [
  "ingest-all",
  "ingest-ticketmaster",
  "ingest-tmdb-dramas",
  "ingest-curation-k",
  "ingest-korean-phrases",
  "ingest-food-recipes",
  "send-reminders",
] as const

// 라우트별 한국어 표시명 — 카드 제목에 노출. 식별자는 그대로 두고 라벨만 매핑.
const ROUTE_DISPLAY_NAMES: Record<(typeof ROUTES)[number], string> = {
  "ingest-all": "ingest-all",
  "ingest-ticketmaster": "ingest-ticketmaster",
  "ingest-tmdb-dramas": "KdramaMatch — TMDB 드라마 수집",
  "ingest-curation-k": "Curation K 통합 수집",
  "ingest-korean-phrases": "HangeulGo — 드라마 표현 생성",
  "ingest-food-recipes": "KfoodKit — 레시피 수집",
  "send-reminders": "send-reminders",
}

// 라우트별 수동 트리거 버튼 정의 — 미지정 라우트는 단일 기본 "수동 실행" 버튼.
// ingest-curation-k (2026-05-19): tour_spots + filming_spots + kpop_spots 항상 전체
// 실행하도록 통합 → 분기 옵션 제거.
const ROUTE_ACTIONS: Partial<Record<(typeof ROUTES)[number], CronAction[]>> = {}

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

    // 라우트별 메트릭 라벨:
    //   send-reminders     → 발송 수
    //   curation-k         → tour_spots 신규/변경
    //   tmdb-dramas        → 드라마 수집
    //   korean-phrases     → 생성 표현 수
    //   나머지 ingest-*     → 수집 이벤트
    const metricLabel =
      route === "send-reminders"
        ? "발송 수"
        : route === "ingest-curation-k"
          ? "tour_spots 신규/변경"
          : route === "ingest-tmdb-dramas"
            ? "드라마 수집"
            : route === "ingest-korean-phrases"
              ? "생성 표현 수"
              : route === "ingest-food-recipes"
                ? "레시피 수집"
                : "수집 이벤트"

    const displayName = ROUTE_DISPLAY_NAMES[route]
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
    } else if (route === "ingest-ticketmaster" && data.result_json) {
      const r = data.result_json as { upserted?: number }
      metric = (r.upserted ?? 0).toLocaleString()
    } else if (route === "ingest-curation-k" && data.result_json) {
      // CombinedResult — stage 따라 메트릭 선택.
      //   primary/all → tour_spots 신규/변경 row 합
      //   secondary   → filming + kpop 신규 합
      const r = data.result_json as {
        stage?: string
        total_upserted?: number
        filming?: { spotsInserted?: number } | null
        kpop?: { spotsUpserted?: number } | null
      }
      if (r.stage === "secondary") {
        const film = r.filming?.spotsInserted ?? 0
        const kpop = r.kpop?.spotsUpserted ?? 0
        metric = (film + kpop).toLocaleString()
      } else {
        metric = (r.total_upserted ?? 0).toLocaleString()
      }
    } else if (route === "ingest-tmdb-dramas" && data.result_json) {
      // DramaIngestResult — upserted = 이번 실행 upsert 된 drama 수.
      // calendarLinked 는 부가 정보라 카드엔 노출 안 함 (toast 영역에서 노출 가능).
      const r = data.result_json as { upserted?: number }
      metric = (r.upserted ?? 0).toLocaleString()
    } else if (route === "ingest-korean-phrases" && data.result_json) {
      // KoreanPhrasesIngestResult — generated = 이번 실행 신규 표현 수.
      const r = data.result_json as { generated?: number }
      metric = (r.generated ?? 0).toLocaleString()
    } else if (route === "ingest-food-recipes" && data.result_json) {
      // FoodRecipesIngestResult — upserted = 이번 실행 신규 레시피 수.
      const r = data.result_json as { upserted?: number }
      metric = (r.upserted ?? 0).toLocaleString()
    } else if (route === "send-reminders" && data.result_json) {
      const summary = (data.result_json as { summary?: { sent?: number } }).summary
      metric = (summary?.sent ?? 0).toLocaleString()
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
