"use client"

// 로드맵 모달 — 6개 서비스 출시 타임라인 + 이메일 알림 신청.
// 트리거: EarlyAccessBanner "See what's coming" 버튼 등.

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SERVICES_META } from "@/components/header"
import { EmailSignupForm } from "@/components/early-access/email-signup-form"
import { CheckCircle2, Clock } from "lucide-react"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// phase + status 라벨 → 시각화 색상·아이콘
function statusLabel(status: "live" | "soon", phase: string): { text: string; color: string } {
  if (status === "live") {
    return { text: `${phase} · Available now`, color: "#22c55e" }
  }
  return { text: `${phase} · Coming soon`, color: "#FF4B6E" }
}

export function RoadmapModal({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141416] border-[#2a2a2a] text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">
            What&apos;s coming to UnfoldK
          </DialogTitle>
          <p className="text-muted-foreground text-sm mt-1">
            6 services for K-pop, K-drama, Korean culture fans. Five are live now —
            one more arriving soon.
          </p>
        </DialogHeader>

        {/* 타임라인 */}
        <ul className="space-y-3 mt-4">
          {SERVICES_META.map((service) => {
            const conf = statusLabel(service.status, service.phase)
            const Icon = service.status === "live" ? CheckCircle2 : Clock
            return (
              <li
                key={service.name}
                className="flex items-start gap-3 p-3 rounded-xl bg-[#1a1a1a] border border-border/30"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${conf.color}1f` }}
                >
                  <Icon className="w-4 h-4" style={{ color: conf.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-foreground font-medium text-sm">
                      {service.name}
                    </span>
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: `${conf.color}1f`, color: conf.color }}
                    >
                      {conf.text}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {service.description}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>

        {/* 이메일 알림 신청 */}
        <div className="mt-6 pt-5 border-t border-border/30">
          <p className="text-foreground font-medium text-sm mb-1">
            Get notified at launch
          </p>
          <p className="text-muted-foreground text-xs mb-3">
            We&apos;ll email you the moment each upcoming service goes live.
          </p>
          <EmailSignupForm source="roadmap-modal" />
        </div>
      </DialogContent>
    </Dialog>
  )
}
