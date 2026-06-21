// KInboundPreviewCard — Hallyu Pass 대시보드 내 K-Inbound 기능 소개 카드
// 서버 메모리 캐시(serverless 불안정)를 직접 노출하지 않고,
// 실시간 추적 기능 안내 + /k-inbound CTA 제공.

import Link from "next/link"
import { Plane, ArrowRight, Radio } from "lucide-react"

const TRACKED_AIRPORTS = ["ICN", "GMP", "PUS", "CJU"]

export function KInboundPreviewCard() {
  return (
    <div
      className="rounded-2xl border border-white/10 p-6"
      style={{ background: "rgba(231,236,235,0.05)" }}
    >
      <div className="flex items-start justify-between gap-4">
        {/* 좌: 설명 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <Plane className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">K-Inbound</h2>
            <span
              className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(255,75,110,0.12)", color: "#FF4B6E" }}
            >
              <Radio className="w-2.5 h-2.5" />
              Live
            </span>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Track real-time flights arriving at Korean airports — ICN, GMP, PUS &amp; more.
            Enter a flight number to follow your journey live.
          </p>

          {/* 추적 공항 배지 */}
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            {TRACKED_AIRPORTS.map((code) => (
              <span
                key={code}
                className="text-xs font-medium px-2 py-0.5 rounded"
                style={{ background: "rgba(255,255,255,0.07)", color: "#aaa" }}
              >
                {code}
              </span>
            ))}
            <span className="text-xs text-muted-foreground/60">+ more</span>
          </div>

          <Link
            href="/k-inbound"
            className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:underline"
            style={{ color: "#FF4B6E" }}
          >
            Track a flight
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* 우: 아이콘 장식 */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(255,75,110,0.08)", border: "1px solid rgba(255,75,110,0.15)" }}
        >
          <Plane className="w-7 h-7" style={{ color: "#FF4B6E" }} />
        </div>
      </div>
    </div>
  )
}
