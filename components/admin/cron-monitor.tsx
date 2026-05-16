"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Play } from "lucide-react"

interface RouteSummary {
  route: string                                      // API 식별자 (e.g. "ingest-filming-spots")
  displayName?: string                               // UI 표시명 (옵션 — 없으면 route 그대로)
  lastExecutedAt: string | null
  lastStatus: "success" | "failed" | null
  metric: string
  metricLabel: string
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
  const [runningRoute, setRunningRoute] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function runManually(route: string) {
    setRunningRoute(route)
    try {
      const res = await fetch("/api/admin/cron/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        toast({ title: "실행 실패", description: json.error?.toString?.() ?? `HTTP ${res.status}` })
      } else {
        toast({
          title: "실행 완료",
          description: summarizeRunResult(route, json.result, json.elapsedMs),
        })
      }
    } catch (err) {
      toast({ title: "실행 오류", description: err instanceof Error ? err.message : "알 수 없는 오류" })
    } finally {
      setRunningRoute(null)
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

            <div className="flex items-end justify-between">
              <div>
                <p className="text-muted-foreground text-xs">{s.metricLabel}</p>
                <p className="text-foreground text-2xl font-bold">{s.metric}</p>
              </div>
              <Button
                size="sm"
                onClick={() => runManually(s.route)}
                disabled={runningRoute !== null}
                className="rounded-full"
                style={{ backgroundColor: "#FF4B6E", color: "white" }}
              >
                <Play className="w-3 h-3 mr-1" />
                {runningRoute === s.route ? "실행 중..." : "수동 실행"}
              </Button>
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

  if (route === "ingest-filming-spots") {
    const inserted = num(r.spotsInserted)
    const confirmed = num(r.spotsConfirmed)
    const pending = num(r.spotsPending)
    const retried = num(r.pendingRetried)
    const promoted = num(r.pendingPromoted)
    const errors = Array.isArray(r.errors) ? r.errors.length : 0
    const retryPart =
      retried > 0 ? ` · pending 재시도 ${retried}/${promoted} 승격` : ""
    const errPart = errors > 0 ? ` · errors ${errors}` : ""
    return `신규 ${inserted}건 (confirmed ${confirmed} / pending ${pending})${retryPart}${errPart} · ${time}`
  }

  if (route === "ingest-ticketmaster") {
    return `수집 ${num(r.upserted)}건 · ${time}`
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
