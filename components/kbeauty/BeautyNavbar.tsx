"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Menu, LogOut } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BeautyAuthInfo {
  loaded: boolean
  email: string | null
  dashboards: { href: string; label: string }[]
}

interface Props {
  activeLink?: "supplier" | "buyer" | "seller" | "market-intelligence"
  /** light=화이트 상시 / dark=네이비→스크롤시 화이트 / black=블랙 상시 */
  variant?: "light" | "dark" | "black"
  loginHref?: string
  loginLabel?: string
  ctaHref?: string
  ctaLabel?: string
  ctaStyle?: "navy" | "gold"
}

// ─── BeautyNavbar ─────────────────────────────────────────────────────────────

export function BeautyNavbar({
  activeLink,
  variant = "light",
  loginHref = "/kbeauty/login",
  loginLabel = "Log in",
  ctaHref = "/kbeauty/auth",
  ctaLabel = "Get Started",
  ctaStyle = "navy",
}: Props) {
  const supabase = createSupabaseBrowserClient()
  const [auth, setAuth] = useState<BeautyAuthInfo>({ loaded: false, email: null, dashboards: [] })
  const [scrolled, setScrolled] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    if (!dropdownOpen) return
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [dropdownOpen])

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setAuth({ loaded: true, email: null, dashboards: [] }); return }

      const [
        { data: supplier },
        { data: buyer },
        { data: seller },
        { data: isAdminResult },
      ] = await Promise.all([
        supabase.from("beauty_suppliers").select("id").eq("user_id", user.id).maybeSingle(),
        supabase.from("beauty_buyers").select("id").eq("user_id", user.id).maybeSingle(),
        supabase.from("beauty_sellers").select("id").eq("user_id", user.id).maybeSingle(),
        supabase.rpc("is_admin", { uid: user.id }),
      ])

      const dashboards: { href: string; label: string }[] = []
      if (supplier)      dashboards.push({ href: "/kbeauty/dashboard/supplier", label: "공급사 대시보드" })
      if (buyer)         dashboards.push({ href: "/kbeauty/dashboard/buyer",    label: "바이어 대시보드" })
      if (seller)        dashboards.push({ href: "/kbeauty/dashboard/seller",   label: "셀러 대시보드" })
      if (isAdminResult) dashboards.push({ href: "/kbeauty/admin",              label: "어드민" })

      setAuth({ loaded: true, email: user.email ?? user.id, dashboards })
    }
    checkAuth()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setAuth({ loaded: true, email: null, dashboards: [] })
    setDropdownOpen(false)
  }

  const isLoggedIn = auth.loaded && auth.email !== null
  const initial = auth.email ? auth.email[0].toUpperCase() : "?"

  // ── 배경 / 텍스트 토큰 ────────────────────────────────────────────────────
  // 데스크톱 헤더 배경
  const headerBg =
    variant === "black"
      ? "bg-[#0F0F0F]"
      : variant === "dark"
        ? scrolled ? "bg-white/95 backdrop-blur-sm shadow-sm" : "bg-[#1A3A5C]"
        : scrolled ? "bg-white/95 backdrop-blur-sm shadow-sm" : "bg-white border-b border-[#E8E2DA]"

  // 데스크톱 링크에서 "어두운 배경" 여부 (네이비 미스크롤 or 블랙)
  const onDarkBg = variant === "black" || (variant === "dark" && !scrolled)

  const logoTextClass = onDarkBg ? "text-white" : "text-[#0F0F0F]"

  function linkClass(link: string) {
    const isActive = activeLink === link
    if (onDarkBg) return isActive ? "text-sm font-semibold text-white transition-colors" : "text-sm text-white/65 hover:text-white transition-colors"
    return isActive ? "text-sm font-semibold text-[#0F0F0F] transition-colors" : "text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors"
  }

  const loginBtnClass = onDarkBg
    ? "text-sm text-white/75 hover:text-white transition-colors px-4 py-2"
    : "text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors px-4 py-2"

  const ctaBtnClass = ctaStyle === "gold"
    ? "bg-[#C8A882] text-[#0F0F0F] text-sm font-semibold px-5 py-2.5 rounded-[8px] hover:bg-[#b8956e] transition-colors"
    : "bg-[#1A3A5C] text-white text-sm font-semibold px-5 py-2.5 rounded-[8px] hover:bg-[#153249] transition-colors"

  const menuBtnClass = onDarkBg ? "p-2 text-white" : "p-2 text-[#0F0F0F]"

  // 모바일 Sheet — 항상 variant 기준 (스크롤 무관)
  const isMobileDark = variant !== "light"
  const sheetBg = variant === "black" ? "bg-[#1A1A1A] border-t border-white/10"
    : variant === "dark" ? "bg-[#1A3A5C] border-t border-white/10"
    : "bg-white border-t border-[#E8E2DA]"

  const dividerClass = isMobileDark ? "border-t border-white/10 my-2" : "border-t border-[#E8E2DA] my-2"

  function mobileLinkClass(link: string) {
    const isActive = activeLink === link
    if (isMobileDark) return isActive ? "text-white font-semibold py-2" : "text-white/70 py-2"
    return isActive ? "text-[#0F0F0F] font-semibold py-2" : "text-[#6B6B6B] hover:text-[#0F0F0F] py-2"
  }

  const mobileLoginClass = isMobileDark ? "text-white/70 py-2" : "text-[#6B6B6B] hover:text-[#0F0F0F] py-2"

  const mobileCtaClass = ctaStyle === "gold"
    ? "bg-[#C8A882] text-[#0F0F0F] font-semibold px-5 py-3 rounded-[8px] w-full mt-2 text-center block"
    : "bg-[#1A3A5C] text-white font-semibold px-5 py-3 rounded-[8px] w-full mt-2 text-center block"

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <header className={`sticky top-0 z-50 w-full h-16 transition-all duration-200 ${headerBg}`}>
      <div className="max-w-[1280px] mx-auto h-full px-6 flex items-center justify-between">
        {/* 로고 */}
        <Link href="/kbeauty" className="flex items-center gap-1">
          <span className={`font-bold ${logoTextClass}`}>UnfoldK Beauty</span>
          <span className="text-[#C8A882]">&#9670;</span>
        </Link>

        {/* 데스크톱 링크 */}
        <nav className="hidden md:flex items-center gap-7">
          <Link href="/kbeauty/supplier" className={linkClass("supplier")}>For Suppliers</Link>
          <Link href="/kbeauty/buyer" className={linkClass("buyer")}>For Buyers</Link>
          <Link href="/kbeauty/seller" className={linkClass("seller")}>For Sellers</Link>
          <Link href="/kbeauty/market-intelligence" className={linkClass("market-intelligence")}>Market Intelligence</Link>
        </nav>

        {/* 데스크톱 우측: 비로그인 버튼 / 로그인 아바타 */}
        <div className="hidden md:flex items-center gap-3">
          {!isLoggedIn ? (
            <>
              <Link href={loginHref} className={loginBtnClass}>{loginLabel}</Link>
              <Link href={ctaHref} className={ctaBtnClass}>{ctaLabel}</Link>
            </>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(v => !v)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white hover:opacity-85 transition-opacity"
                style={{ background: "#C8A882" }}
                aria-label="계정 메뉴"
              >
                {initial}
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-11 w-56 bg-white border border-[#E8E2DA] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] py-1.5 z-50">
                  <p className="px-4 pt-1 pb-2.5 text-[11px] text-[#6B6B6B] truncate border-b border-[#F3F4F6]">
                    {auth.email}
                  </p>
                  {auth.dashboards.map(d => (
                    <Link
                      key={d.href}
                      href={d.href}
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2.5 text-sm text-[#0F0F0F] hover:bg-[#F8F7F5] transition-colors"
                    >
                      {d.label}
                    </Link>
                  ))}
                  <div className="border-t border-[#E8E2DA] my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 모바일 햄버거 */}
        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <button className={menuBtnClass}>
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className={sheetBg}>
            <nav className="flex flex-col gap-4 mt-6">
              <Link href="/kbeauty/supplier" className={mobileLinkClass("supplier")}>For Suppliers</Link>
              <Link href="/kbeauty/buyer" className={mobileLinkClass("buyer")}>For Buyers</Link>
              <Link href="/kbeauty/seller" className={mobileLinkClass("seller")}>For Sellers</Link>
              <Link href="/kbeauty/market-intelligence" className={mobileLinkClass("market-intelligence")}>Market Intelligence</Link>
              <div className={dividerClass} />
              {!isLoggedIn ? (
                <>
                  <Link href={loginHref} className={mobileLoginClass}>{loginLabel}</Link>
                  <Link href={ctaHref} className={mobileCtaClass}>{ctaLabel}</Link>
                </>
              ) : (
                <>
                  <p className={`text-xs truncate ${isMobileDark ? "text-white/50" : "text-[#6B6B6B]"}`}>{auth.email}</p>
                  {auth.dashboards.map(d => (
                    <Link
                      key={d.href}
                      href={d.href}
                      className={`py-2 font-medium transition-colors ${isMobileDark ? "text-white hover:text-white/80" : "text-[#0F0F0F] hover:text-[#1A3A5C]"}`}
                    >
                      {d.label}
                    </Link>
                  ))}
                  <button
                    onClick={handleLogout}
                    className={`py-2 text-left flex items-center gap-2 text-sm ${isMobileDark ? "text-red-400" : "text-red-600"}`}
                  >
                    <LogOut className="w-4 h-4" />
                    로그아웃
                  </button>
                </>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
