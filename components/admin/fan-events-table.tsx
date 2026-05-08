"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

type Status = "pending" | "approved" | "rejected"

export interface AdminFanEventRow {
  id: string
  user_id: string
  user_email: string | null
  title: string
  description: string | null
  event_date: string
  location: string | null
  proof_url: string | null
  status: Status
  admin_note: string | null
  created_at: string
  reviewed_at: string | null
}

const STATUS_STYLE: Record<Status, { label: string; bg: string; color: string }> = {
  pending: { label: "Pending", bg: "rgba(234, 179, 8, 0.15)", color: "#eab308" },
  approved: { label: "Approved", bg: "rgba(34, 197, 94, 0.15)", color: "#22c55e" },
  rejected: { label: "Rejected", bg: "rgba(239, 68, 68, 0.15)", color: "#ef4444" },
}

export function FanEventsTable({ rows }: { rows: AdminFanEventRow[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState("")
  const [isPending, startTransition] = useTransition()

  async function callPatch(id: string, body: { action: "approve" | "reject"; admin_note?: string }) {
    const res = await fetch(`/api/admin/fan-events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast({ title: "처리 실패", description: json.error?.toString?.() ?? "알 수 없는 오류" })
      return false
    }
    if (json.warning) {
      toast({ title: "처리 완료 (경고)", description: json.warning })
    } else {
      toast({ title: "처리 완료" })
    }
    return true
  }

  function handleApprove(id: string) {
    if (!confirm("이 신청을 승인하시겠습니까? (캘린더에 자동 등록됩니다)")) return
    startTransition(async () => {
      const ok = await callPatch(id, { action: "approve" })
      if (ok) router.refresh()
    })
  }

  function startReject(id: string) {
    setRejectingId(id)
    setRejectNote("")
  }

  function submitReject() {
    if (!rejectingId) return
    const id = rejectingId
    const note = rejectNote.trim()
    startTransition(async () => {
      const ok = await callPatch(id, { action: "reject", admin_note: note || undefined })
      if (ok) {
        setRejectingId(null)
        router.refresh()
      }
    })
  }

  return (
    <>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2a2a2a]">
              <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">행사</th>
              <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">신청자</th>
              <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">개최일</th>
              <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">증빙</th>
              <th className="text-left text-muted-foreground text-sm font-medium px-4 py-3">상태</th>
              <th className="text-right text-muted-foreground text-sm font-medium px-4 py-3">작업</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted-foreground text-sm text-center py-8">
                  신청 없음
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const style = STATUS_STYLE[r.status]
              return (
                <tr key={r.id} className="border-b border-[#2a2a2a] last:border-b-0 hover:bg-[#202024]">
                  <td className="text-foreground text-sm px-4 py-3">
                    <div className="font-medium">{r.title}</div>
                    {r.location && <div className="text-muted-foreground text-xs">{r.location}</div>}
                  </td>
                  <td className="text-muted-foreground text-sm px-4 py-3">{r.user_email ?? "—"}</td>
                  <td className="text-muted-foreground text-sm px-4 py-3">
                    {new Date(r.event_date).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="text-sm px-4 py-3">
                    {r.proof_url ? (
                      <a
                        href={r.proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                        style={{ color: "#FF4B6E" }}
                      >
                        열기
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="text-sm px-4 py-3">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: style.bg, color: style.color }}
                    >
                      {style.label}
                    </span>
                  </td>
                  <td className="text-right px-4 py-3">
                    {r.status === "pending" ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startReject(r.id)}
                          disabled={isPending}
                        >
                          거절
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(r.id)}
                          disabled={isPending}
                          className="rounded-full"
                          style={{ backgroundColor: "#FF4B6E", color: "white" }}
                        >
                          승인
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        {r.reviewed_at && new Date(r.reviewed_at).toLocaleDateString("ko-KR")}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 거절 사유 모달 */}
      <Dialog open={Boolean(rejectingId)} onOpenChange={(open) => !open && setRejectingId(null)}>
        <DialogContent className="bg-[#141418] border-[#2a2a2a] text-foreground">
          <DialogHeader>
            <DialogTitle>거절 사유 입력</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="신청자에게 전달될 사유 (선택)"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            className="bg-[#0d0d0f] border-[#2a2a2a] min-h-[120px]"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectingId(null)}>
              취소
            </Button>
            <Button
              onClick={submitReject}
              disabled={isPending}
              className="rounded-full"
              style={{ backgroundColor: "#ef4444", color: "white" }}
            >
              거절 처리
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
