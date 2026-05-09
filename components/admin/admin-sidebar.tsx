"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, CalendarDays, Megaphone, Activity, Music, Flag } from "lucide-react"

// 어드민 사이드바 — 활성 라우트 표시는 클라이언트 컴포넌트로 분리
const links = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "유저 관리", icon: Users },
  { href: "/admin/events", label: "이벤트 관리", icon: CalendarDays },
  { href: "/admin/fan-events", label: "팬 행사 신청", icon: Megaphone },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/kpop", label: "KpopStats", icon: Music },
  { href: "/admin/cron", label: "Cron 모니터", icon: Activity },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-[240px] flex-shrink-0 bg-[#141418] border-r border-[#2a2a2a] min-h-screen p-4">
      <div className="mb-6 px-3 py-2">
        <Link href="/admin" className="text-foreground text-lg font-semibold">
          UnfoldK <span style={{ color: "#FF4B6E" }}>Admin</span>
        </Link>
      </div>

      <nav className="flex flex-col gap-1">
        {links.map((link) => {
          // exact=true는 정확 일치만, 그 외는 prefix 매칭
          const active = link.exact
            ? pathname === link.href
            : pathname.startsWith(link.href)

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium relative ${
                active
                  ? "bg-[#1a1a1a] text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a]/50"
              }`}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                  style={{ backgroundColor: "#FF4B6E" }}
                />
              )}
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto pt-6">
        <Link
          href="/"
          className="text-foreground text-lg font-semibold px-3 py-2 block hover:opacity-80 transition-opacity"
        >
          ← UnfoldK <span style={{ color: "#FF4B6E" }}>HOME</span>
        </Link>
      </div>
    </aside>
  )
}
