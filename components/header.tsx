"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Menu, ChevronDown, Calendar, Music, Film, Languages, UtensilsCrossed, User, LogOut } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { StartModal } from "@/components/start-modal"

const services = [
  { icon: Calendar, name: "HallyuCalendar", description: "Never miss a comeback or premiere", href: "/calendar" },
  { icon: Music, name: "KpopStats", description: "Global charts & streaming stats", href: "/kpop" },
  { icon: Film, name: "KdramaMatch", description: "AI-powered drama recommendations", href: "/drama" },
  { icon: Languages, name: "HangeulGo", description: "Learn Korean from K-dramas", href: "/korean" },
  { icon: UtensilsCrossed, name: "KfoodKit", description: "Cook your favorite K-drama dishes", href: "/food" },
]

export function Header() {
  const router = useRouter()
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

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full py-4 px-6 bg-background">
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
                      <div>
                        <div className="text-foreground font-medium text-sm">{service.name}</div>
                        <div className="text-muted-foreground text-xs mt-0.5">{service.description}</div>
                      </div>
                    </Link>
                  ))}
                </div>
                
                {/* Full-width KfoodKit */}
                <Link
                  href={services[4].href}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#252525] transition-colors mt-2"
                >
                  <UtensilsCrossed className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-foreground font-medium text-sm">{services[4].name}</div>
                    <div className="text-muted-foreground text-xs mt-0.5">{services[4].description}</div>
                  </div>
                </Link>

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
                  <div>
                    <div className="text-foreground font-medium text-sm">{service.name}</div>
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
