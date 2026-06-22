"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

const LS_KEY = "unfoldk_maintenance_hidden_date"

export function MaintenanceModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const hidden = localStorage.getItem(LS_KEY)
    const today = new Date().toISOString().slice(0, 10)
    if (hidden !== today) {
      setOpen(true)
    }
  }, [])

  function handleGotIt() {
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem(LS_KEY, today)
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
      {/* 오버레이 — 클릭 시 세션 닫기 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* 모달 카드 */}
      <div
        className="relative z-10 w-full max-w-[440px] rounded-2xl p-8"
        style={{ backgroundColor: "#141418", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* × 닫기 — 세션 동안 */}
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 text-white/40 hover:text-white/70 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 제목 */}
        <h2 className="text-foreground text-xl font-semibold mb-4">
          {/* 사용자 명시 요청 이모지 */}
          We&apos;re Rebuilding UnfoldK 🛠️
        </h2>

        {/* 본문 */}
        <p className="text-muted-foreground text-sm leading-relaxed mb-6">
          We&apos;re currently redesigning our services to bring you a better Hallyu experience.
          <br />
          Some features may be temporarily unavailable.
          <br />
          Thank you for your patience!
          <br /><br />
          Questions?{" "}
          <a
            href="mailto:support@unfoldk.com"
            className="underline"
            style={{ color: "#FF4B6E" }}
          >
            support@unfoldk.com
          </a>
        </p>

        {/* Got it — 오늘 하루 보지 않기 */}
        <Button
          onClick={handleGotIt}
          className="w-full rounded-full font-medium text-white"
          style={{ backgroundColor: "#FF4B6E" }}
        >
          Got it
        </Button>
      </div>
    </div>
  )
}
