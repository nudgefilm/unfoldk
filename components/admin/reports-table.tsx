"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Check, X, ExternalLink } from "lucide-react"
import type { AdminReportRow } from "@/app/admin/reports/page"

const REASON_LABELS: Record<AdminReportRow["reason"], string> = {
  mismapping: "Wrong content / mismatch",
  date_error: "Wrong date or time",
  duplicate: "Duplicate",
  cancelled: "Cancelled",
  other: "Other",
}

const STATUS_BADGE: Record<AdminReportRow["status"], { label: string; bg: string; color: string }> = {
  pending: { label: "Pending", bg: "rgba(255, 75, 110, 0.15)", color: "#FF4B6E" },
  reviewed: { label: "Reviewed", bg: "rgba(34, 197, 94, 0.15)", color: "#22c55e" },
  dismissed: { label: "Dismissed", bg: "rgba(136, 136, 136, 0.15)", color: "#888888" },
}

// content_type 별 어드민 편집 페이지 매핑 — 신고 콘텐츠로 빠르게 이동
function adminLinkFor(row: AdminReportRow): string | null {
  switch (row.content_type) {
    case "event":
      return `/admin/events`               // events 페이지 진입 후 검색 (id 포커스는 v0+ 기능)
    case "artist":
      return `/admin/kpop`
    case "drama":
      return null                          // 어드민 드라마 페이지 미구현
    case "phrase":
    case "recipe":
      return null
    default:
      return null
  }
}

export function ReportsTable({ rows }: { rows: AdminReportRow[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function updateStatus(id: string, status: "reviewed" | "dismissed") {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast({
          title: "처리 실패",
          description: err.error?.toString?.() ?? "Unknown error",
        })
        return
      }
      toast({ title: status === "reviewed" ? "처리 완료" : "기각 완료" })
      startTransition(() => router.refresh())
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#2a2a2a]">
            <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">상태</th>
            <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">유형</th>
            <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">사유</th>
            <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">메모</th>
            <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">신고자</th>
            <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">날짜</th>
            <th className="text-right text-muted-foreground text-sm font-medium px-4 py-3">작업</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="text-muted-foreground text-sm text-center py-8">
                신고 없음
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const badge = STATUS_BADGE[r.status]
            const adminLink = adminLinkFor(r)
            return (
              <tr key={r.id} className="border-b border-[#2a2a2a] last:border-b-0 hover:bg-[#202024] align-top">
                <td className="px-4 py-3">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: badge.bg, color: badge.color }}
                  >
                    {badge.label}
                  </span>
                </td>
                <td className="text-foreground text-sm px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span>{r.content_type}</span>
                    {adminLink && (
                      <Link
                        href={adminLink}
                        className="text-muted-foreground hover:text-foreground"
                        title="어드민 페이지로 이동"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs font-mono break-all">
                    {r.content_id}
                  </div>
                </td>
                <td className="text-foreground text-sm px-4 py-3">
                  {REASON_LABELS[r.reason]}
                </td>
                <td className="text-muted-foreground text-sm px-4 py-3 max-w-[240px]">
                  {r.note ?? "—"}
                </td>
                <td className="text-muted-foreground text-sm px-4 py-3">
                  {r.user_email ?? r.user_id.slice(0, 8) + "..."}
                </td>
                <td className="text-muted-foreground text-sm px-4 py-3 whitespace-nowrap">
                  {/* timeZone 명시 — SSR/hydrate 일관성 (DECISIONS 2026-05-09 React #418 fix) */}
                  {new Date(r.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
                </td>
                <td className="text-right px-4 py-3">
                  {r.status === "pending" ? (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateStatus(r.id, "reviewed")}
                        disabled={isPending && updatingId === r.id}
                        title="처리 완료 (수정/삭제 후)"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateStatus(r.id, "dismissed")}
                        disabled={isPending && updatingId === r.id}
                        title="기각 (문제 없음)"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
