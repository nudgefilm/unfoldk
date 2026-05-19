"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Play } from "lucide-react"

interface CronAction {
  label: string                                      // 버튼 라벨
  params?: Record<string, string>                    // route 에 붙일 query string
}

interface RouteSummary {
  route: string                                      // API 식별자 (e.g. "ingest-curation-k")
  displayName?: string                               // UI 표시명 (옵션 — 없으면 route 그대로)
  lastExecutedAt: string | null
  lastStatus: "success" | "failed" | null
  metric: string
  metricLabel: string
  actions?: CronAction[]                             // 미지정 시 단일 "수동 실행" 버튼
}

interface CronLogRow {
  id: string
  route: string
  status: "success" | "failed"
  result_json: Record<string, unknown> | null
  executed_at: string
}

export function CronMonitor({ summaries, logs }: { summaries: RouteSummary[]; logs: CronLogRow[] }) {
  const router = useRouter()
  const { toast } = useToast()
  // 동일 route 라도 actions 가 여러 개 있을 수 있어 key 는 `route|label` 조합
  const [runningKey, setRunningKey] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function runManually(route: string, action?: CronAction) {
    const key = action ? `${route}|${action.label}` : route
    setRunningKey(key)
    try {
      const res = await fetch("/api/admin/cron/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route, params: action?.params }),
      })
      const json = await res.json().catch(() => ({}))

      // 성공 판별 정책 (모든 cron 통일):
      //   - HTTP 200 (json.ok=true) = 함수 정상 종료 → "실행 완료" 라벨
      //     data-level 오류는 result.error 로 description 에 노출
      //   - HTTP 非200 또는 admin 프록시 실패 = "실행 실패" 라벨
      // 주의: HTTP 200 이지만 cron 함수 내부에서 result.error 가 set 된 경우,
      //       제목은 "실행 완료" 유지 + description 에 오류 사유 노출 (DB 로그도 "failed" 기록됨).
      const httpFailed = !res.ok || !json.ok
      const dataLevelError = pickErrorString(json.result)
      const outerError = pickErrorString(json.error)

      if (httpFailed) {
        const description = dataLevelError ?? outerError ?? `HTTP ${res.status}`
        console.error(`[admin/cron] ${route} 수동 실행 실패 (HTTP):`, json)
        toast({ title: "실행 실패", description })
        return
      }

      const summary = summarizeRunResult(route, json.result, json.elapsedMs)
      if (dataLevelError) {
        // HTTP 200 + data-level error — 함수 자체는 동작했지만 인제스트 결과에 오류
        console.warn(`[admin/cron] ${route} data-level 오류:`, json.result)
        toast({
          title: "실행 완료 (데이터 오류)",
          description: `${dataLevelError} · ${summary}`,
        })
      } else {
        toast({ title: "실행 완료", description: summary })
      }
    } catch (err) {
      console.error(`[admin/cron] ${route} 수동 실행 예외:`, err)
      toast({ title: "실행 오류", description: err instanceof Error ? err.message : "알 수 없는 오류" })
    } finally {
      setRunningKey(null)
      startTransition(() => router.refresh())
    }
  }

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {summaries.map((s) => (
          <div key={s.route} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-foreground font-medium">{s.displayName ?? s.route}</h3>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {s.lastExecutedAt
                    ? `마지막: ${new Date(s.lastExecutedAt).toLocaleString("ko-KR")}`
                    : "실행 기록 없음"}
                </p>
              </div>
              {s.lastStatus && (
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor:
                      s.lastStatus === "success" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                    color: s.lastStatus === "success" ? "#22c55e" : "#ef4444",
                  }}
                >
                  {s.lastStatus}
                </span>
              )}
            </div>

            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-muted-foreground text-xs">{s.metricLabel}</p>
                <p className="text-foreground text-2xl font-bold">{s.metric}</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                {(s.actions ?? [{ label: "수동 실행" }]).map((action) => {
                  const key = `${s.route}|${action.label}`
                  const isRunning = runningKey === key
                  return (
                    <Button
                      key={key}
                      size="sm"
                      onClick={() => runManually(s.route, action)}
                      disabled={runningKey !== null}
                      className="rounded-full"
                      style={{ backgroundColor: "#FF4B6E", color: "white" }}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      {isRunning ? "실행 중..." : action.label}
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 최근 로그 */}
      <section>
        <h2 className="text-foreground text-lg font-semibold mb-3">최근 실행 로그 (20건)</h2>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">실행 시각</th>
                <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">라우트</th>
                <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">결과</th>
                <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">요약</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-muted-foreground text-sm text-center py-8">
                    로그 없음
                  </td>
                </tr>
              )}
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-[#2a2a2a] last:border-b-0">
                  <td className="text-muted-foreground text-sm px-4 py-3">
                    {new Date(log.executed_at).toLocaleString("ko-KR")}
                  </td>
                  <td className="text-foreground text-sm px-4 py-3">{log.route}</td>
                  <td className="text-sm px-4 py-3">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor:
                          log.status === "success" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                        color: log.status === "success" ? "#22c55e" : "#ef4444",
                      }}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="text-muted-foreground text-xs px-4 py-3 font-mono truncate max-w-[400px]">
                    {log.result_json ? JSON.stringify(log.result_json).slice(0, 120) : "—"}
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

// 수동 실행 응답 → 사용자에게 보여줄 한 줄 요약.
// 라우트별로 result_json 핵심 필드를 추출. 형식 변경 시 신규 라우트 분기 추가.
function summarizeRunResult(route: string, result: unknown, elapsedMs: number): string {
  const time = `${elapsedMs}ms`
  if (typeof result !== "object" || result === null) return time

  const r = result as Record<string, unknown>

  if (route === "ingest-curation-k") {
    // CombinedResult — { stage, total_upserted, total_translated, total_enriched, categories[], filming, kpop, errors }
    const stage = typeof r.stage === "string" ? r.stage : "all"
    const upserted = num(r.total_upserted)
    const translated = num(r.total_translated)
    const enriched = num(r.total_enriched)
    const cats = Array.isArray(r.categories) ? r.categories : []
    const skipped = cats.filter((c) => (c as { skipped?: unknown }).skipped === true).length
    const filming = r.filming as { spotsInserted?: number } | null | undefined
    const kpop = r.kpop as { spotsUpserted?: number } | null | undefined
    const filmPart =
      filming && typeof filming === "object"
        ? ` · 촬영지 신규 ${num(filming.spotsInserted)}`
        : ""
    const kpopPart =
      kpop && typeof kpop === "object"
        ? ` · K-Pop 성지 신규 ${num(kpop.spotsUpserted)}`
        : ""
    const enrichedPart = enriched > 0 ? ` · enrich ${enriched}` : ""
    const translatedPart = translated > 0 ? ` · 번역 ${translated}` : ""
    const skipPart = skipped > 0 ? ` · skip ${skipped}` : ""
    const errors = Array.isArray(r.errors) ? r.errors.length : 0
    const errPart = errors > 0 ? ` · errors ${errors}` : ""
    const stagePart = stage !== "all" ? ` [${stage}]` : ""
    return `${upserted}건 수집${stagePart}${enrichedPart}${translatedPart}${skipPart}${filmPart}${kpopPart}${errPart} · ${time}`
  }

  if (route === "ingest-ticketmaster") {
    return `수집 ${num(r.upserted)}건 · ${time}`
  }

  if (route === "ingest-tmdb-dramas") {
    // DramaIngestResult — 메트릭만 반환. data-level 오류는 runManually 가 별도 처리.
    return `드라마 ${num(r.upserted)}건 (스캔 ${num(r.scanned)} · 캘린더 매핑 ${num(r.calendarLinked)}) · ${time}`
  }

  if (route === "ingest-korean-phrases") {
    // KoreanPhrasesIngestResult — generated/skipped/unknown_dramas/auto_added_dramas/errors.
    const errors = Array.isArray(r.errors) ? r.errors.length : 0
    const errPart = errors > 0 ? ` · errors ${errors}` : ""
    const autoAdded = num(r.auto_added_dramas)
    const autoPart = autoAdded > 0 ? ` · auto-added ${autoAdded}` : ""
    return `생성 ${num(r.generated)}건 (스캔 ${num(r.scanned)} · skip ${num(r.skipped)} · unknown ${num(r.unknown_dramas)})${autoPart}${errPart} · ${time}`
  }

  if (route === "ingest-food-recipes") {
    // FoodRecipesIngestResult — fetched/upserted/skipped/errors.
    const errors = Array.isArray(r.errors) ? r.errors.length : 0
    const errPart = errors > 0 ? ` · errors ${errors}` : ""
    return `레시피 ${num(r.upserted)}건 (페치 ${num(r.fetched)} · skip ${num(r.skipped)})${errPart} · ${time}`
  }

  if (route === "ingest-all") {
    const total = typeof r.total_upserted === "number" ? r.total_upserted : null
    return total !== null ? `수집 ${total.toLocaleString()}건 · ${time}` : `${route} · ${time}`
  }

  if (route === "send-reminders") {
    const summary = r.summary as { sent?: unknown } | undefined
    return `발송 ${num(summary?.sent)}건 · ${time}`
  }

  return `${route} · ${time}`
}

function num(v: unknown): number {
  return typeof v === "number" ? v : 0
}

// 임의 형태의 에러 값을 사람이 읽을 수 있는 단일 문자열로 압축.
//
// 처리 케이스:
//   - string                          → 그대로
//   - Error                           → err.message
//   - { error, details, hint, code }  → "error (code): details — hint" 조합 (PostgrestError 패턴)
//   - { error }                       → recurse
//   - 기타 object                     → JSON.stringify (실패 시 String(...) fallback)
//   - null/undefined                  → null (호출부에서 fallback 처리)
//
// 절대 .toString() 직접 호출 금지 — 객체는 "[object Object]" 가 됨.
function pickErrorString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === "string") return value
  if (value instanceof Error) return value.message
  if (typeof value !== "object") return String(value)

  const obj = value as Record<string, unknown>

  // 인제스트 결과: { error, details, hint, code }
  if (typeof obj.error === "string") {
    const parts = [obj.error]
    if (typeof obj.code === "string") parts[0] = `${obj.error} (${obj.code})`
    if (typeof obj.details === "string") parts.push(obj.details)
    if (typeof obj.hint === "string") parts.push(`힌트: ${obj.hint}`)
    return parts.join(" — ")
  }

  // 중첩 { error: ... } 한 단계만 더 들여다봄
  if ("error" in obj) {
    const nested = pickErrorString(obj.error)
    if (nested) return nested
  }

  try {
    return JSON.stringify(obj).slice(0, 300)
  } catch {
    return String(value)
  }
}
