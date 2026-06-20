// HallyuPassExclusiveBanner — Hallyu Pass 전용 기능 4종 안내 배너
// /mypage 대시보드 + /mypage/hallyu-pass 양쪽에서 재사용.
// 클릭 시 /mypage/hallyu-pass 로 이동 (plan 분기는 목적지 페이지에서 처리).

import Link from "next/link"
import { Music, CalendarDays, Mic2, TrendingUp } from "lucide-react"
import type { LucideIcon } from "lucide-react"

const FEATURES: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Music,
    title: "Artist Weekly Report",
    desc: "Your favorite artists' highlights, auto-compiled every Monday",
  },
  {
    icon: CalendarDays,
    title: "Hallyu Routine Planner",
    desc: "A personalized K-content routine recommended fresh each week",
  },
  {
    icon: Mic2,
    title: "Comeback Guide",
    desc: "Streaming strategy auto-delivered starting D-7 before a comeback",
  },
  {
    icon: TrendingUp,
    title: "Monthly Trend Report",
    desc: "Last month's Hallyu market analysis, published every 1st",
  },
]

export function HallyuPassExclusiveBanner() {
  return (
    <Link href="/mypage/hallyu-pass" className="block group">
      <div
        className="rounded-2xl p-6 transition-colors"
        style={{
          background: "rgba(255, 75, 110, 0.04)",
          border: "1px solid rgba(255, 75, 110, 0.18)",
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <p
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "#FF4B6E" }}
          >
            Hallyu Pass Exclusive
          </p>
          <span
            className="text-xs font-medium transition-colors text-muted-foreground group-hover:text-foreground"
          >
            View all →
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex flex-col gap-2">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "rgba(255, 75, 110, 0.12)" }}
              >
                <Icon className="w-4 h-4" style={{ color: "#FF4B6E" }} />
              </div>
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </Link>
  )
}
