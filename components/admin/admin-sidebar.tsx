"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { LayoutDashboard, Users, CalendarDays, Megaphone, Activity, Music, Flag, Film, UtensilsCrossed, ImageIcon, BookOpen, ShoppingBag, Video, Newspaper } from "lucide-react"

// 어드민 사이드바 — 활성 라우트 표시는 클라이언트 컴포넌트로 분리
const links = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "유저 관리", icon: Users },
  { href: "/admin/events", label: "이벤트 관리", icon: CalendarDays },
  { href: "/admin/fan-events", label: "팬 행사 신청", icon: Megaphone },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/kpop", label: "KpopStats", icon: Music },
  { href: "/admin/dramas", label: "KdramaMatch", icon: Film },
  { href: "/admin/drama-items", label: "Shop this drama", icon: ShoppingBag },
  { href: "/admin/videos", label: "YouTube 영상", icon: Video },
  { href: "/admin/hallyu-news", label: "Hallyu News", icon: Newspaper },
  { href: "/admin/food", label: "KfoodKit", icon: UtensilsCrossed, exact: true },
  { href: "/admin/food/images", label: "이미지 검수", icon: ImageIcon },
  { href: "/admin/korean", label: "HangeulGo", icon: BookOpen },
  { href: "/admin/cron", label: "Cron 모니터", icon: Activity },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const [imageReviewCount, setImageReviewCount] = useState<number | null>(null)
  const [videoPendingCount, setVideoPendingCount] = useState<number | null>(null)
  const [newsCount, setNewsCount] = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/hallyu-news?count_only=true")
      .then((r) => r.json())
      .then((json: unknown) => {
        if (json && typeof json === "object" && "count" in json && typeof (json as { count: unknown }).count === "number") {
          setNewsCount((json as { count: number }).count)
        }
      })
      .catch(() => {})

    fetch("/api/admin/food/images?count_only=true")
      .then((r) => r.json())
      .then((json: unknown) => {
        if (json && typeof json === "object" && "total" in json && typeof (json as { total: unknown }).total === "number") {
          setImageReviewCount((json as { total: number }).total)
        }
      })
      .catch(() => {})

    fetch("/api/admin/videos?count_only=true")
      .then((r) => r.json())
      .then((json: unknown) => {
        if (json && typeof json === "object" && "total" in json && typeof (json as { total: unknown }).total === "number") {
          setVideoPendingCount((json as { total: number }).total)
        }
      })
      .catch(() => {})
  }, [])

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
              {link.href === "/admin/food/images" && imageReviewCount !== null && imageReviewCount > 0 && (
                <span className="ml-auto text-[10px] font-medium bg-[#FF4B6E] text-white rounded-full px-1.5 py-0.5 leading-none min-w-[18px] text-center">
                  {imageReviewCount > 99 ? "99+" : imageReviewCount}
                </span>
              )}
              {link.href === "/admin/videos" && videoPendingCount !== null && videoPendingCount > 0 && (
                <span className="ml-auto text-[10px] font-medium bg-[#FF4B6E] text-white rounded-full px-1.5 py-0.5 leading-none min-w-[18px] text-center">
                  {videoPendingCount > 99 ? "99+" : videoPendingCount}
                </span>
              )}
              {link.href === "/admin/hallyu-news" && newsCount !== null && newsCount > 0 && (
                <span className="ml-auto text-[10px] font-medium bg-zinc-600 text-white rounded-full px-1.5 py-0.5 leading-none min-w-[18px] text-center">
                  {newsCount > 999 ? "999+" : newsCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto pt-6">
        <Link
          href="/"
          className="text-foreground text-lg font-semibold px-3 py-2 block hover:opacity-80 transition-opacity"
        >
          UnfoldK <span style={{ color: "#FF4B6E" }}>HOME</span>
        </Link>
      </div>
    </aside>
  )
}
