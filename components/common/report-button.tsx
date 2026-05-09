"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Flag } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { StartModal } from "@/components/start-modal"

// 콘텐츠 신고 공통 컴포넌트 — 전체 서비스(이벤트/아티스트/드라마/학습/레시피) 공유
//
// 동작:
//   - 비로그인 → StartModal 인플레이스 오픈 (페이지 이동 없음). 현재 pathname 을
//     next 로 넘겨 OAuth 완료 후 같은 페이지로 복귀.
//   - 로그인 → 사유 선택 모달 → /api/reports 로 POST → 토스트
//   - "기타" 선택 시 텍스트 입력란 노출 (note 필수)
//
// 디자인:
//   - Dialog 패턴 (events-manager 와 동일) — 어드민 모달과 톤 통일
//   - 트리거 버튼은 muted-foreground 작은 링크 — 콘텐츠 압도하지 않음

export type ReportContentType = "event" | "artist" | "drama" | "phrase" | "recipe"
export type ReportReason = "mismapping" | "date_error" | "duplicate" | "cancelled" | "other"

const REASON_LABELS: Record<ReportReason, string> = {
  mismapping: "Wrong content / mismatch",
  date_error: "Wrong date or time",
  duplicate: "Duplicate entry",
  cancelled: "Cancelled or no longer valid",
  other: "Other (please describe)",
}

interface Props {
  contentType: ReportContentType
  contentId: string
}

export function ReportButton({ contentType, contentId }: Props) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [startModalOpen, setStartModalOpen] = useState(false)
  // StartModal 열 때 캡처한 pathname — 모달 닫혀도 유지돼야 OAuth 완료 후 복귀 가능
  const [pendingNext, setPendingNext] = useState<string | undefined>(undefined)
  const [reason, setReason] = useState<ReportReason>("mismapping")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleClick = async () => {
    const supabase = createSupabaseBrowserClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      // 비로그인 → 페이지 이동 없이 StartModal 오픈, next 로 현재 경로 보존
      setPendingNext(
        typeof window !== "undefined" ? window.location.pathname : "/"
      )
      setStartModalOpen(true)
      return
    }
    setOpen(true)
  }

  const handleSubmit = async () => {
    if (reason === "other" && note.trim().length === 0) {
      toast({ title: "Please describe the issue" })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_type: contentType,
          content_id: contentId,
          reason,
          note: note.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast({
          title: "Report failed",
          description: err.error?.toString?.() ?? "Unknown error",
        })
        return
      }
      toast({ title: "Thanks — we'll review your report." })
      setOpen(false)
      setReason("mismapping")
      setNote("")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
      >
        <Flag className="w-3 h-3" />
        Report incorrect info
      </button>

      {/* 비로그인 클릭 시 같은 자리에서 OAuth 모달 — pendingNext 로 복귀 경로 전달 */}
      <StartModal
        open={startModalOpen}
        onOpenChange={setStartModalOpen}
        next={pendingNext}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#141418] border-[#2a2a2a] text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>Report incorrect info</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-muted-foreground text-xs mb-2 block">
                What&apos;s wrong?
              </label>
              <div className="flex flex-col gap-2">
                {(Object.keys(REASON_LABELS) as ReportReason[]).map((r) => (
                  <label key={r} className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="report-reason"
                      checked={reason === r}
                      onChange={() => setReason(r)}
                      className="mt-1 accent-[#FF4B6E]"
                    />
                    <span>{REASON_LABELS[r]}</span>
                  </label>
                ))}
              </div>
            </div>

            {reason === "other" && (
              <div>
                <label className="text-muted-foreground text-xs mb-1 block">
                  Describe the issue
                </label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="bg-[#0d0d0f] border-[#2a2a2a] min-h-[80px] resize-y"
                  placeholder="Please give us more detail..."
                  maxLength={500}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-full"
              style={{ backgroundColor: "#FF4B6E", color: "white" }}
            >
              {submitting ? "Submitting..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
