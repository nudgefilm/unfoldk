"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Menu, ChevronDown, Calendar, Music, Film, Languages, UtensilsCrossed, Map, User, LogOut } from "lucide-react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { StartModal } from "@/components/start-modal"
import { EarlyAccessBanner } from "@/components/early-access/early-access-banner"

// Header 를 노출하지 않는 경로들 — 자체 레이아웃이 있거나 풀스크린 인증/결제 페이지.
// root layout 에서 Header 를 단일 마운트하므로 여기서 prefix 매칭으로 가드.
const HIDE_HEADER_PREFIXES = [
  "/admin",            // admin 자체 사이드바·layout
  "/login",
  "/signup",
  "/start",
  "/redeem",
  "/forgot-password",
  "/verify-email",
  "/payment",          // /payment/success, /payment/fail
]

// status: 'live' = 출시됨 (뱃지 없음) / 'soon' = 출시 예정 (Coming Soon 뱃지).
// phase 는 로드맵 모달에서 사용. Curation K 는 M+5 로드맵이었지만 Phase 1 출시 후 live.
const services: Array<{
  icon: typeof Calendar
  name: string
  description: string
  href: string
  status: "live" | "soon"
  phase: string
}> = [
  { icon: Calendar, name: "HallyuCalendar", description: "Never miss a comeback or premiere", href: "/calendar", status: "live", phase: "M+0" },
  { icon: Music, name: "KpopStats", description: "Global charts & streaming stats", href: "/kpop", status: "live", phase: "M+1" },
  { icon: Film, name: "KdramaMatch", description: "UnfoldK drama recommendations", href: "/drama", status: "live", phase: "M+2" },
  { icon: Languages, name: "HangeulGo", description: "Learn Korean from K-dramas", href: "/korean", status: "live", phase: "M+3" },
  { icon: UtensilsCrossed, name: "KfoodKit", description: "Cook your favorite K-drama dishes", href: "/food", status: "soon", phase: "M+4" },
  { icon: Map, name: "Curation K", description: "Explore Korea like a Hallyu fan", href: "/curation-k", status: "live", phase: "M+5" },
]

// 서비스 목록 export — RoadmapModal 등 외부 컴포넌트 재사용
export type ServiceMeta = (typeof services)[number]
export const SERVICES_META = services

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [closeTimeout, setCloseTimeout] = useState<NodeJS.Timeout | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  // getUser() 완료 전까진 인증 버튼 영역 숨김 — 비로그인 UI 가 잠깐 깜빡이는 현상 방지
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false)
  const [userInitial, setUserInitial] = useState<string>("")
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  // 프로필 hover 드롭다운 — Services 드롭다운과 동일 패턴
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [profileCloseTimeout, setProfileCloseTimeout] = useState<NodeJS.Timeout | null>(null)
  // 비로그인 My Page 클릭 시 인플레이스 OAuth 모달 — ReportButton 과 동일 패턴
  const [mypageStartOpen, setMypageStartOpen] = useState(false)
  // 모바일 시트 — My Page (비로그인) 클릭 시 시트 닫고 모달 띄우기 위해 controlled 로 전환
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)

  // pathname 변경 시 드롭다운 / 시트 / 모달 자동 close.
  // root layout 에 Header 가 단일 마운트되며 instance 가 영속되므로 페이지 이동해도
  // hover 드롭다운이 열린 채 남는 등의 문제 방지.
  useEffect(() => {
    setIsDropdownOpen(false)
    setIsProfileOpen(false)
    setMobileSheetOpen(false)
    setMypageStartOpen(false)
  }, [pathname])

  useEffect(() => {
    // 로그인 상태 + Google 프로필을 헤더에 반영. onAuthStateChange로 실시간 갱신.
    const supabase = createSupabaseBrowserClient()

    const applyUser = (user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) => {
      if (!user) {
        setIsLoggedIn(false)
        setUserInitial("")
        setUserAvatar(null)
        return
      }
      const meta = (user.user_metadata ?? {}) as { full_name?: string; avatar_url?: string }
      const baseName = meta.full_name?.trim() || user.email?.split("@")[0] || "U"
      setIsLoggedIn(true)
      setUserInitial(baseName.charAt(0).toUpperCase() || "U")
      setUserAvatar(meta.avatar_url ?? null)
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      applyUser(user)
      setIsAuthReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ?? null)
      setIsAuthReady(true)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleMouseEnter = () => {
    if (closeTimeout) {
      clearTimeout(closeTimeout)
      setCloseTimeout(null)
    }
    setIsDropdownOpen(true)
  }

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      setIsDropdownOpen(false)
    }, 200)
    setCloseTimeout(timeout)
  }

  const handleScrollToPricing = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    e.preventDefault()
    const targetElement = document.getElementById("pricing-section")
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth" })
    }
    setIsDropdownOpen(false)
  }

  const handleScrollToAbout = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const targetElement = document.getElementById("faq-section")
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth" })
    }
  }

  // 프로필 드롭다운 hover 핸들러 — 200ms 지연 close로 마우스 이동 여유 확보
  const handleProfileMouseEnter = () => {
    if (profileCloseTimeout) {
      clearTimeout(profileCloseTimeout)
      setProfileCloseTimeout(null)
    }
    setIsProfileOpen(true)
  }

  const handleProfileMouseLeave = () => {
    const timeout = setTimeout(() => {
      setIsProfileOpen(false)
    }, 200)
    setProfileCloseTimeout(timeout)
  }

  // My Page 클릭 핸들러 — 인증 ready + 비로그인이면 navigation 차단하고 OAuth 모달 인플레이스.
  // 로딩 중 / 로그인 됨 → Link 가 정상 navigate (로그인 됨이면 /mypage 진입,
  // 로딩 중이면 middleware 가 /로 리디렉트하던 기존 동작 유지).
  const handleMyPageClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isAuthReady && !isLoggedIn) {
      e.preventDefault()
      // 모바일 시트가 열려있다면 같이 닫음 — 시트 위에 모달 올리지 않기 위해
      setMobileSheetOpen(false)
      setMypageStartOpen(true)
    }
  }

  // 로그아웃 — Supabase 세션 종료 후 메인으로 복귀, RSC 캐시 무효화로 헤더 즉시 갱신
  const handleLogout = async () => {
    setIsProfileOpen(false)
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  // 노출 가드 — 자체 레이아웃이 있거나 풀스크린 인증/결제 페이지에서는 Header 미노출.
  // hooks 호출 후에 위치해야 React rules-of-hooks 위반하지 않음.
  if (pathname && HIDE_HEADER_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full bg-background">
      {/* Early Access 공지 배너 — Header 내부 위쪽. session 1회 dismiss 후 미노출.
          fixed Header 의 첫 children 으로 마운트 → 같은 fixed 영역에 포함 + Header 의
          HIDE_PREFIXES 가드 자동 적용 (admin/login 등에서는 Header 자체가 null). */}
      <EarlyAccessBanner />

      <div className="py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Brand */}
        <Link href="/" className="flex items-center">
          <span className="text-foreground text-xl font-semibold">UnfoldK</span>
        </Link>

        {/* Right: Services Dropdown + About + CTA */}
        <div className="hidden md:flex items-center gap-4">
          {/* Services Dropdown */}
          <div 
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-1.5 text-[#888888] hover:text-foreground px-4 py-2 rounded-full font-medium transition-colors"
            >
              Services
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute top-full right-0 pt-2 w-[480px] z-50">
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 shadow-xl">
                {/* Two-column grid for first 4 items */}
                <div className="grid grid-cols-2 gap-3">
                  {services.slice(0, 4).map((service) => (
                    <Link
                      key={service.name}
                      href={service.href}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#252525] transition-colors"
                    >
                      <service.icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-foreground font-medium text-sm">{service.name}</span>
                          {service.status === "soon" && <ComingSoonBadge />}
                        </div>
                        <div className="text-muted-foreground text-xs mt-0.5">{service.description}</div>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Full-width 카드 — 5번째부터 (KfoodKit, Curation K …) */}
                {services.slice(4).map((service) => (
                  <Link
                    key={service.name}
                    href={service.href}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#252525] transition-colors mt-2"
                  >
                    <service.icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-foreground font-medium text-sm">{service.name}</span>
                        {service.status === "soon" && <ComingSoonBadge />}
                      </div>
                      <div className="text-muted-foreground text-xs mt-0.5">{service.description}</div>
                    </div>
                  </Link>
                ))}

                {/* Divider */}
                <div className="border-t border-[#2a2a2a] my-3" />

                {/* Footer link to Pricing */}
                <Link
                  href="/#pricing"
                  className="w-full text-left text-primary font-medium text-sm hover:underline px-3 py-2 block"
                >
                  View Hallyu Pass
                </Link>
                </div>
              </div>
            )}
          </div>

          <Link
            href="/about"
            className="text-[#888888] hover:text-foreground px-4 py-2 rounded-full font-medium transition-colors"
          >
            About
          </Link>
          <Link
            href="/mypage"
            prefetch={false}
            onClick={handleMyPageClick}
            className="text-[#888888] hover:text-foreground px-4 py-2 rounded-full font-medium transition-colors"
          >
            My Page
          </Link>
          {/* 인증 슬롯 — min-w 로 자리를 고정해 어떤 상태(loading/avatar/Start)든
              컨테이너 폭이 동일. Start 버튼(~88px) 기준 여유롭게 100px 확보.
              내부 항목은 justify-end 로 우측 정렬해 우측 메뉴 그룹의 right edge 일정 유지. */}
          <div className="min-w-[100px] flex justify-end">
          {isAuthReady && (isLoggedIn ? (
            <div
              className="relative"
              onMouseEnter={handleProfileMouseEnter}
              onMouseLeave={handleProfileMouseLeave}
            >
              <Link
                href="/mypage"
                prefetch={false}
                aria-label="My Page"
                className="h-10 px-4 rounded-full transition-colors flex items-center justify-center"
              >
                {userAvatar ? (
                  <img
                    src={userAvatar}
                    alt="Profile"
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                    style={{ backgroundColor: "#FF4B6E" }}
                  >
                    {userInitial || "U"}
                  </div>
                )}
              </Link>

              {/* hover 드롭다운 — Services 메뉴와 동일 시각 패턴 */}
              {isProfileOpen && (
                <div className="absolute top-full right-0 pt-2 w-[200px] z-50">
                  <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-2 shadow-xl">
                    <Link
                      href="/mypage"
                      prefetch={false}
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#252525] transition-colors text-foreground text-sm"
                    >
                      <User className="w-4 h-4 text-muted-foreground" />
                      My Page
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#252525] transition-colors text-foreground text-sm"
                    >
                      <LogOut className="w-4 h-4 text-muted-foreground" />
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // 비로그인: 단일 Start 버튼 — 클릭 시 StartModal 열려 Google OAuth 진입
            <StartModal
              trigger={
                <Button
                  className="px-6 py-2 rounded-full font-medium shadow-sm"
                  style={{ backgroundColor: "#FF4B6E", color: "white" }}
                >
                  Start
                </Button>
              }
            />
          ))}
          </div>
        </div>

        {/* Mobile Hamburger Menu */}
        <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" className="text-foreground">
              <Menu className="h-7 w-7" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="bg-[#1a1a1a] border-t border-[#2a2a2a] text-foreground">
            <SheetHeader>
              <SheetTitle className="text-left text-xl font-semibold text-foreground">Menu</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-2 mt-6">
              {/* Services Section */}
              <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-2 px-2">Services</div>
              {services.map((service) => (
                <Link
                  key={service.name}
                  href={service.href}
                  className="flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-[#252525] transition-colors"
                >
                  <service.icon className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-foreground font-medium text-sm">{service.name}</span>
                      {service.status === "soon" && <ComingSoonBadge />}
                    </div>
                    <div className="text-muted-foreground text-xs">{service.description}</div>
                  </div>
                </Link>
              ))}

              {/* Divider */}
              <div className="border-t border-[#2a2a2a] my-3" />

              {/* About Link */}
              <Link
                href="/about"
                className="text-foreground hover:text-primary px-2 py-3 font-medium"
              >
                About
              </Link>

              {/* My Page Link */}
              <Link
                href="/mypage"
                prefetch={false}
                onClick={handleMyPageClick}
                className="text-foreground hover:text-primary px-2 py-3 font-medium"
              >
                My Page
              </Link>

              {/* Hallyu Pass Link */}
              <Link
                href="/#pricing"
                className="text-left text-primary font-medium px-2 py-3"
              >
                View Hallyu Pass
              </Link>

              {/* Start 버튼 — 비로그인 상태에서만 노출, StartModal 단일 진입 */}
              {!isLoggedIn && (
                <div className="w-full mt-4">
                  <StartModal
                    trigger={
                      <Button
                        className="w-full px-6 py-3 rounded-full font-medium shadow-sm"
                        style={{ backgroundColor: "#FF4B6E", color: "white" }}
                      >
                        Start
                      </Button>
                    }
                  />
                </div>
              )}
            </nav>
          </SheetContent>
        </Sheet>
        </div>
      </div>

      {/* My Page (비로그인) 클릭 시 인플레이스 OAuth 모달.
          OAuth 완료 후 next=/mypage 로 복귀 — 사용자가 의도한 페이지로 직접 진입. */}
      <StartModal
        open={mypageStartOpen}
        onOpenChange={setMypageStartOpen}
        next="/mypage"
      />
    </header>
  )
}

// 미출시 서비스용 작은 뱃지. brand 컬러 알파, uppercase, tight padding.
function ComingSoonBadge() {
  return (
    <span
      className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: "rgba(255, 75, 110, 0.18)", color: "#FF4B6E" }}
    >
      Soon
    </span>
  )
}
