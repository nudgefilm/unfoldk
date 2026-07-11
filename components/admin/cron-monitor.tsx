"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Play, ChevronDown } from "lucide-react"
import type { RouteSummary, CronLogRow, ServiceGroup } from "@/app/admin/cron/page"

export function CronMonitor({
  summaries,
  logs,
  groups,
}: {
  summaries: RouteSummary[]
  logs: CronLogRow[]
  groups: ServiceGroup[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [runningKey, setRunningKey] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  // 기본 모두 열린 상태
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    () => Object.fromEntries(groups.map((g) => [g.label, true]))
  )

  const summaryMap = Object.fromEntries(summaries.map((s) => [s.route, s]))

  function toggleGroup(label: string) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  async function runManually(route: string, action?: { label: string; params?: Record<string, string> }) {
    const key = action ? `${route}|${action.label}` : route
    setRunningKey(key)
    try {
      const res = await fetch("/api/admin/cron/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route, params: action?.params }),
      })
      const json = await res.json().catch(() => ({}))
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
        console.warn(`[admin/cron] ${route} data-level 오류:`, json.result)
        toast({ title: "실행 완료 (데이터 오류)", description: `${dataLevelError} · ${summary}` })
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
    <div className="space-y-3">
      {groups.map((group) => {
        const isOpen = !!openGroups[group.label]
        const groupSummaries = group.routes.map((r) => summaryMap[r]).filter(Boolean)
        const allOk = groupSummaries.every((s) => s.lastStatus === "success")
        const anyFailed = groupSummaries.some((s) => s.lastStatus === "failed")
        const statusColor = anyFailed ? "#ef4444" : allOk && groupSummaries.length > 0 ? "#22c55e" : "#6b7280"

        return (
          <div key={group.label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
            {/* 아코디언 헤더 */}
            <button
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
              onClick={() => toggleGroup(group.label)}
            >
              <div className="flex items-center gap-3">
                <span className="text-foreground font-semibold">{group.label}</span>
                <span className="text-muted-foreground text-xs">{groupSummaries.length}개 cron</span>
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: statusColor }}
                />
              </div>
              <ChevronDown
                className="w-4 h-4 text-muted-foreground transition-transform duration-200"
                style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>

            {/* 아코디언 바디 */}
            {isOpen && (
              <div className="border-t border-[#2a2a2a] divide-y divide-[#2a2a2a]">
                {groupSummaries.map((s) => (
                  <div key={s.route} className="flex items-center justify-between gap-4 px-5 py-4">
                    {/* 왼쪽: 이름 + 마지막 실행 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-foreground text-sm font-medium">{s.displayName ?? s.route}</span>
                        {s.lastStatus && (
                          <span
                            className="text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor:
                                s.lastStatus === "success"
                                  ? "rgba(34, 197, 94, 0.15)"
                                  : "rgba(239, 68, 68, 0.15)",
                              color: s.lastStatus === "success" ? "#22c55e" : "#ef4444",
                            }}
                          >
                            {s.lastStatus}
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        {s.lastExecutedAt
                          ? `${new Date(s.lastExecutedAt).toLocaleString("ko-KR")} · ${s.metricLabel}: ${s.metric}`
                          : "실행 기록 없음"}
                      </p>
                    </div>

                    {/* 오른쪽: 실행 버튼 */}
                    <div className="flex flex-wrap gap-2 justify-end flex-shrink-0">
                      {(s.actions ?? [{ label: "Run" }]).map((action) => {
                        const key = `${s.route}|${action.label}`
                        const isRunning = runningKey === key
                        return (
                          <Button
                            key={key}
                            size="sm"
                            onClick={() => runManually(s.route, action)}
                            disabled={runningKey !== null}
                            className="rounded-full text-xs h-7 px-3"
                            style={{ backgroundColor: "#FF4B6E", color: "white" }}
                          >
                            <Play className="w-3 h-3 mr-1" />
                            {isRunning ? "실행 중..." : action.label}
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* 최근 로그 */}
      <section className="pt-2">
        <h2 className="text-foreground text-base font-semibold mb-3">최근 실행 로그 (20건)</h2>
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
                  <td className="text-muted-foreground text-sm px-4 py-3 whitespace-nowrap">
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

// 수동 실행 응답 → 사용자에게 보여줄 한 줄 요약
function summarizeRunResult(route: string, result: unknown, elapsedMs: number): string {
  const time = `${elapsedMs}ms`
  if (typeof result !== "object" || result === null) return time

  const r = result as Record<string, unknown>

  if (route === "ingest-tour-spots") {
    const upserted = num(r.total_upserted)
    const translated = num(r.total_translated)
    const enriched = num(r.total_enriched)
    const cats = Array.isArray(r.categories) ? r.categories : []
    const skipped = cats.filter((c) => (c as { skipped?: unknown }).skipped === true).length
    const enrichedPart = enriched > 0 ? ` · enrich ${enriched}` : ""
    const translatedPart = translated > 0 ? ` · 번역 ${translated}` : ""
    const skipPart = skipped > 0 ? ` · skip ${skipped}` : ""
    const errors = Array.isArray(r.errors) ? r.errors.length : 0
    const errPart = errors > 0 ? ` · errors ${errors}` : ""
    return `${upserted}건 수집${enrichedPart}${translatedPart}${skipPart}${errPart} · ${time}`
  }

  if (route === "ingest-filming-kpop") {
    const filming = r.filming as { spotsInserted?: number } | null | undefined
    const kpop = r.kpop as { spotsUpserted?: number; claude?: { upserted?: number } | null } | null | undefined
    const filmCount = filming && typeof filming === "object" ? num(filming.spotsInserted) : 0
    const kpopCount = kpop && typeof kpop === "object" ? num(kpop.spotsUpserted) : 0
    const claudeCount = kpop?.claude && typeof kpop.claude === "object" ? num(kpop.claude.upserted) : 0
    const claudePart = claudeCount > 0 ? ` · Claude +${claudeCount}` : ""
    const errors = Array.isArray(r.errors) ? r.errors.length : 0
    const errPart = errors > 0 ? ` · errors ${errors}` : ""
    return `촬영지 ${filmCount}건 · K팝 성지 ${kpopCount}건${claudePart}${errPart} · ${time}`
  }

  if (route === "ingest-ticketmaster") return `수집 ${num(r.upserted)}건 · ${time}`

  if (route === "ingest-tmdb-dramas") {
    return `드라마 ${num(r.upserted)}건 (스캔 ${num(r.scanned)} · 캘린더 매핑 ${num(r.calendarLinked)}) · ${time}`
  }

  if (route === "ingest-kpop-stats") {
    const errors = Array.isArray(r.errors) ? r.errors.length : 0
    const errPart = errors > 0 ? ` · errors ${errors}` : ""
    const mapped = num(r.channelsAutoMapped)
    const mapPart = mapped > 0 ? ` · 채널 자동매핑 ${mapped}` : ""
    const thumb = num(r.thumbnailsBackfilled)
    const thumbPart = thumb > 0 ? ` · thumb +${thumb}` : ""
    return (
      `stats ${num(r.upserted)}건 ` +
      `(YT ${num(r.youtubeFetched)} · Last.fm ${num(r.lastfmFetched)} · rank ${num(r.ranksFetched)})` +
      `${mapPart}${thumbPart}${errPart} · ${time}`
    )
  }

  if (route === "ingest-korean-phrases") {
    const errors = Array.isArray(r.errors) ? r.errors.length : 0
    const errPart = errors > 0 ? ` · errors ${errors}` : ""
    const autoAdded = num(r.auto_added_dramas)
    const autoPart = autoAdded > 0 ? ` · auto-added ${autoAdded}` : ""
    return `생성 ${num(r.generated)}건 (스캔 ${num(r.scanned)} · skip ${num(r.skipped)} · unknown ${num(r.unknown_dramas)})${autoPart}${errPart} · ${time}`
  }

  if (route === "ingest-food-recipes") {
    const errors = Array.isArray(r.errors) ? r.errors.length : 0
    const errPart = errors > 0 ? ` · errors ${errors}` : ""
    const backfill = r.backfill as
      | { candidates?: unknown; phase1_updated?: unknown; phase2_updated?: unknown; phase3_updated?: unknown; unmatched?: unknown }
      | null
      | undefined
    const backfillPart =
      backfill && typeof backfill === "object"
        ? ` · 이미지 mfds ${num(backfill.phase1_updated) + num(backfill.phase2_updated)} + unsplash ${num(backfill.phase3_updated)} (cand ${num(backfill.candidates)} · miss ${num(backfill.unmatched)})`
        : ""
    const titleBackfill = r.title_backfill as { updated?: unknown; pending?: unknown } | null | undefined
    const titlePart =
      titleBackfill && typeof titleBackfill === "object"
        ? ` · 영문 ${num(titleBackfill.updated)}건 (pending ${num(titleBackfill.pending)})`
        : ""
    return `레시피 ${num(r.upserted)}건 (페치 ${num(r.fetched)} · skip ${num(r.skipped)})${backfillPart}${titlePart}${errPart} · ${time}`
  }

  if (route === "send-reminders") {
    const summary = r.summary as { sent?: unknown } | undefined
    return `발송 ${num(summary?.sent)}건 · ${time}`
  }

  if (route === "backfill-filming-descriptions") {
    const errors = Array.isArray(r.errors) ? r.errors.length : 0
    const errPart = errors > 0 ? ` · errors ${errors}` : ""
    const apiErr = num(r.apiErrors)
    const apiErrPart = apiErr > 0 ? ` · api-err ${apiErr}` : ""
    return `backfill ${num(r.updated)}건 (스캔 ${num(r.scanned)})${apiErrPart}${errPart} · ${time}`
  }

  if (route === "generate-artist-reports") return `리포트 ${num(r.saved)}건 · ${time}`
  if (route === "generate-comeback-guides") return `가이드 ${num(r.saved)}건 · ${time}`
  if (route === "generate-monthly-report") {
    const month = (r.month as string | undefined) ?? "—"
    return `월간 리포트 ${month} · ${time}`
  }
  if (route === "generate-weekly-routines") return `루틴 ${num(r.saved)}건 · ${time}`
  if (route === "weekly-report") {
    const wr = r as { duplicate?: boolean; week_start?: string }
    return wr.duplicate ? `skip (이미 생성) · ${time}` : `주간 리포트 ${wr.week_start ?? "—"} · ${time}`
  }
  if (route === "kpop-weekly") return `완료 · ${time}`

  return `${route} · ${time}`
}

function num(v: unknown): number {
  return typeof v === "number" ? v : 0
}

function pickErrorString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === "string") return value
  if (value instanceof Error) return value.message
  if (typeof value !== "object") return String(value)

  const obj = value as Record<string, unknown>

  if (typeof obj.error === "string") {
    const parts = [obj.error]
    if (typeof obj.code === "string") parts[0] = `${obj.error} (${obj.code})`
    if (typeof obj.details === "string") parts.push(obj.details)
    if (typeof obj.hint === "string") parts.push(`힌트: ${obj.hint}`)
    return parts.join(" — ")
  }

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
