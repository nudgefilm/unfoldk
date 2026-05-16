"use client"

// MypageShell — 마이페이지 공용 레이아웃 (사이드바 + 메인)
//
// 사이드바·프로필·진입 가드를 한 곳에서 처리. 신규 mypage 페이지가 본인 로직에만 집중하도록.
// 기존 /mypage, /mypage/fan-events, /mypage/subscription 은 v0 UI 보존을 위해 자체 사이드바 유지 —
// 본 컴포넌트는 신규 mypage 페이지에서만 사용.
//
// 데이터 흐름:
//   1. 마운트 시 supabase.auth.getUser() — 비로그인은 / 로 redirect
//   2. user_metadata 에서 표시 이름/아바타 추출
//   3. public.users.plan_type 조회 → Free / Hallyu Pass 배지
//   4. 인증 확인 끝나면 children 렌더

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FooterSection } from "@/components/footer-section"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import {
  Home,
  Calendar,
  Music,
  Film,
  Languages,
  UtensilsCrossed,
  CreditCard,
  Settings,
  PartyPopper,
} from "lucide-react"

const sidebarLinks = [
  { icon: Home, label: "Dashboard", href: "/mypage" },
  { icon: Calendar, label: "My Calendar", href: "/mypage/calendar" },
  { icon: Music, label: "My Artists", href: "/mypage/artists" },
  { icon: Film, label: "My Dramas", href: "/mypage/dramas" },
  { icon: Languages, label: "Learning Progress", href: "/mypage/learning" },
  { icon: UtensilsCrossed, label: "Saved Recipes", href: "/mypage/recipes" },
  { icon: PartyPopper, label: "My Fan Events", href: "/mypage/fan-events" },
  { icon: CreditCard, label: "Subscription", href: "/mypage/subscription" },
  { icon: Settings, label: "Settings", href: "/mypage/settings" },
]

type SidebarLabel = (typeof sidebarLinks)[number]["label"]

export function MypageShell({
  activeLabel,
  children,
}: {
  activeLabel: SidebarLabel
  children: ReactNode
}) {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [userName, setUserName] = useState("")
  const [userInitial, setUserInitial] = useState("U")
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [userPlan, setUserPlan] = useState("Free")

  useEffect(() => {
    let cancelled = false
    const supabase = createSupabaseBrowserClient()

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace("/")
        return
      }
      if (cancelled) return

      const meta = (user.user_metadata ?? {}) as { full_name?: string; avatar_url?: string }
      const fallbackName = user.email?.split("@")[0] ?? "User"
      const name = meta.full_name?.trim() || fallbackName
      setUserName(name)
      setUserInitial(name.charAt(0).toUpperCase() || "U")
      setUserAvatar(meta.avatar_url ?? null)

      const { data: profile } = await supabase
        .from("users")
        .select("plan_type")
        .eq("id", user.id)
        .single()
      if (!cancelled) {
        const pt = (profile as { plan_type?: string } | null)?.plan_type
        setUserPlan(pt === "monthly" || pt === "annual" ? "Hallyu Pass" : "Free")
        setAuthChecked(true)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [router])

  if (!authChecked) return null

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0d0d0f" }}>
      <div className="flex-1 flex max-w-7xl mx-auto w-full px-4 md:px-6 py-8 gap-8">
        <aside className="hidden md:flex flex-col w-[240px] flex-shrink-0">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              {userAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userAvatar}
                  alt={userName}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
                  style={{ backgroundColor: "#FF4B6E" }}
                >
                  {userInitial}
                </div>
              )}
              <div>
                <p className="text-foreground font-medium">{userName || "—"}</p>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "rgba(255, 75, 110, 0.15)", color: "#FF4B6E" }}
                >
                  {userPlan}
                </span>
              </div>
            </div>
          </div>

          <nav className="flex flex-col gap-1">
            {sidebarLinks.map((link) => {
              const isActive = link.label === activeLabel
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative ${
                    isActive
                      ? "bg-[#1a1a1a] text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a]/50"
                  }`}
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                      style={{ backgroundColor: "#FF4B6E" }}
                    />
                  )}
                  <link.icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{link.label}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        <main className="flex-1 min-w-0">{children}</main>
      </div>

      <FooterSection />
    </div>
  )
}
