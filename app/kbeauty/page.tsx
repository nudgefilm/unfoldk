"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Menu, Check, Instagram, Linkedin, LogOut } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import HeroSection from "@/components/kbeauty/HeroSection"

// ─── 타입 ──────────────────────────────────────────────────────────────────

interface AuthInfo {
  loaded: boolean
  email: string | null
  dashboards: { href: string; label: string }[]
}

// ─── Navbar ────────────────────────────────────────────────────────────────

function BeautyNavbar({
  onLoginClick,
  onGetStartedClick,
  auth,
  onLogout,
}: {
  onLoginClick: () => void
  onGetStartedClick: () => void
  auth: AuthInfo
  onLogout: () => void
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  const isLoggedIn = auth.loaded && auth.email !== null
  const initial = auth.email ? auth.email[0].toUpperCase() : "?"

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-[#E8E2DA] h-16">
      <div className="max-w-[1280px] mx-auto h-full px-6 flex items-center justify-between">
        <Link href="/kbeauty" className="flex items-center gap-1">
          <span className="font-bold text-[#0F0F0F]">UnfoldK Beauty</span>
          <span className="text-[#C8A882]">&#9670;</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <a href="#suppliers" className="text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors">
            For Suppliers
          </a>
          <a href="#buyers" className="text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors">
            For Buyers
          </a>
          <Link href="/kbeauty/seller" className="text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors">
            For Sellers
          </Link>
          <a href="#how-it-works" className="text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors">
            How It Works
          </a>
          <a href="#data-sources" className="text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors">
            Data Sources
          </a>
        </nav>

        {/* 데스크톱: 비로그인 버튼 / 로그인 아바타 */}
        <div className="hidden md:flex items-center gap-3">
          {!isLoggedIn ? (
            <>
              <button
                onClick={onLoginClick}
                className="text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors px-4 py-2"
              >
                Log in
              </button>
              <button
                onClick={onGetStartedClick}
                className="bg-[#1A3A5C] text-white text-sm font-medium px-5 py-2.5 rounded-md hover:bg-[#153249] transition-colors"
              >
                Get Started
              </button>
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
                    onClick={() => { setDropdownOpen(false); onLogout() }}
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
            <button className="p-2 text-[#0F0F0F]">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="bg-white border-t border-[#E8E2DA]">
            <nav className="flex flex-col gap-4 mt-6">
              <a href="#suppliers" className="text-[#6B6B6B] hover:text-[#0F0F0F] py-2">For Suppliers</a>
              <a href="#buyers" className="text-[#6B6B6B] hover:text-[#0F0F0F] py-2">For Buyers</a>
              <Link href="/kbeauty/seller" className="text-[#6B6B6B] hover:text-[#0F0F0F] py-2">For Sellers</Link>
              <a href="#how-it-works" className="text-[#6B6B6B] hover:text-[#0F0F0F] py-2">How It Works</a>
              <a href="#data-sources" className="text-[#6B6B6B] hover:text-[#0F0F0F] py-2">Data Sources</a>
              <div className="border-t border-[#E8E2DA] my-2" />
              {!isLoggedIn ? (
                <>
                  <button onClick={onLoginClick} className="text-[#6B6B6B] hover:text-[#0F0F0F] py-2 text-left">
                    Log in
                  </button>
                  <button
                    onClick={onGetStartedClick}
                    className="bg-[#1A3A5C] text-white font-medium px-5 py-3 rounded-md w-full mt-2"
                  >
                    Get Started
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-[#6B6B6B] truncate">{auth.email}</p>
                  {auth.dashboards.map(d => (
                    <Link
                      key={d.href}
                      href={d.href}
                      className="text-[#0F0F0F] hover:text-[#1A3A5C] py-2 font-medium transition-colors"
                    >
                      {d.label}
                    </Link>
                  ))}
                  <button
                    onClick={onLogout}
                    className="text-red-600 py-2 text-left flex items-center gap-2 text-sm"
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

// ─── Entry Cards ────────────────────────────────────────────────────────────

function EntryCardsSection({
  onSupplierCTA,
  onBuyerCTA,
}: {
  onSupplierCTA: () => void
  onBuyerCTA: () => void
}) {
  return (
    <section id="suppliers" className="bg-[#F8F7F5] py-20 px-6">
      <div className="max-w-[1120px] mx-auto">
        <h2 className="text-2xl md:text-[28px] font-bold text-[#0F0F0F] text-center mb-12">
          Are you in the business?
        </h2>

        <div className="grid md:grid-cols-3 gap-6 items-stretch" id="buyers">
          {/* 공급사 카드 */}
          <div className="bg-white border border-[#E8E2DA] rounded-xl p-8 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col">
            <span className="inline-block bg-[#1A3A5C]/10 text-[#1A3A5C] text-xs font-medium px-4 py-1.5 rounded-full mb-4">
              Supplier
            </span>
            <h3 className="text-[22px] font-bold text-[#0F0F0F] mb-1">Korean Suppliers</h3>
            <p className="text-sm text-[#6B6B6B] mb-6">K-beauty manufacturers &amp; brands</p>
            <div className="border-t border-[#E8E2DA] my-6" />
            <ul className="space-y-3 flex-1">
              <li className="flex items-start gap-3 text-sm text-[#0F0F0F]">
                <Check className="w-4 h-4 text-[#1A3A5C] mt-0.5 flex-shrink-0" />
                Connect with 2,000+ verified global buyers
              </li>
              <li className="flex items-start gap-3 text-sm text-[#0F0F0F]">
                <Check className="w-4 h-4 text-[#1A3A5C] mt-0.5 flex-shrink-0" />
                FDA-registration based trust badges
              </li>
              <li className="flex items-start gap-3 text-sm text-[#0F0F0F]">
                <Check className="w-4 h-4 text-[#1A3A5C] mt-0.5 flex-shrink-0" />
                Fast onboarding via business verification API
              </li>
            </ul>
            <button
              onClick={onSupplierCTA}
              className="w-full mt-8 bg-[#1A3A5C] text-white font-semibold py-3.5 rounded-md hover:bg-[#153249] transition-colors inline-flex items-center justify-center gap-2"
            >
              Apply as Supplier
              <span className="text-lg">&#8594;</span>
            </button>
          </div>

          {/* 바이어 카드 */}
          <div className="bg-white border border-[#E8E2DA] rounded-xl p-8 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col">
            <span className="inline-block bg-[#C8A882]/15 text-[#8B6F47] text-xs font-medium px-4 py-1.5 rounded-full mb-4">
              바이어
            </span>
            <h3 className="text-[22px] font-bold text-[#0F0F0F] mb-1">해외 바이어</h3>
            <p className="text-sm text-[#6B6B6B] mb-6">한국 뷰티 공급사를 찾고 있다면</p>
            <div className="border-t border-[#E8E2DA] my-6" />
            <ul className="space-y-3 flex-1">
              <li className="flex items-start gap-3 text-sm text-[#0F0F0F]">
                <Check className="w-4 h-4 text-[#C8A882] mt-0.5 flex-shrink-0" />
                ImportGenius 검증 공급사 데이터베이스
              </li>
              <li className="flex items-start gap-3 text-sm text-[#0F0F0F]">
                <Check className="w-4 h-4 text-[#C8A882] mt-0.5 flex-shrink-0" />
                FDA 등록 한국 제조사
              </li>
              <li className="flex items-start gap-3 text-sm text-[#0F0F0F]">
                <Check className="w-4 h-4 text-[#C8A882] mt-0.5 flex-shrink-0" />
                시장 인사이트 리포트 (HS 3304&middot;3305&middot;3307)
              </li>
            </ul>
            <button
              onClick={onBuyerCTA}
              className="w-full mt-8 border-[1.5px] border-[#C8A882] text-[#8B6F47] font-semibold py-3.5 rounded-md hover:bg-[#C8A882]/10 transition-colors inline-flex items-center justify-center gap-2"
            >
              바이어 액세스 신청
              <span className="text-lg">&#8594;</span>
            </button>
          </div>

          {/* 셀러 카드 */}
          <div className="bg-white border border-[#E8E2DA] rounded-xl p-8 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col">
            <span className="inline-block bg-[#C8A882]/15 text-[#8B6F47] text-xs font-medium px-4 py-1.5 rounded-full mb-4">
              셀러
            </span>
            <h3 className="text-[22px] font-bold text-[#0F0F0F] mb-1">해외 셀러</h3>
            <p className="text-sm text-[#6B6B6B] mb-6">글로벌 마켓플레이스 판매자라면</p>
            <div className="border-t border-[#E8E2DA] my-6" />
            <ul className="space-y-3 flex-1">
              <li className="flex items-start gap-3 text-sm text-[#0F0F0F]">
                <Check className="w-4 h-4 text-[#C8A882] mt-0.5 flex-shrink-0" />
                검증된 K-뷰티 공급사 직접 소싱
              </li>
              <li className="flex items-start gap-3 text-sm text-[#0F0F0F]">
                <Check className="w-4 h-4 text-[#C8A882] mt-0.5 flex-shrink-0" />
                아마존·Shopify·TikTok Shop 판매 채널 연결
              </li>
              <li className="flex items-start gap-3 text-sm text-[#0F0F0F]">
                <Check className="w-4 h-4 text-[#C8A882] mt-0.5 flex-shrink-0" />
                마진 분석 및 트렌드 리포트 제공
              </li>
            </ul>
            <Link
              href="/kbeauty/seller"
              className="w-full mt-8 border-[1.5px] border-[#C8A882] text-[#8B6F47] font-semibold py-3.5 rounded-md hover:bg-[#C8A882]/10 transition-colors inline-flex items-center justify-center gap-2"
            >
              셀러 액세스 신청
              <span className="text-lg">&#8594;</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── How It Works ───────────────────────────────────────────────────────────

function HowItWorksSection() {
  const [activeTab, setActiveTab] = useState<"supplier" | "buyer" | "seller">("supplier")

  const supplierSteps = [
    { number: "1", title: "Business Verification", desc1: "Automatic verification via National Tax Service API", desc2: "Fast and accurate business confirmation" },
    { number: "2", title: "Product Registration", desc1: "List products with certifications, MOQ, and pricing", desc2: "Include certification badges" },
    { number: "3", title: "Buyer Match Request", desc1: "Set target country and category", desc2: "Receive match requests from verified buyers" },
    { number: "4", title: "Contact Info Revealed", desc1: "After admin approval", desc2: "Start direct communication with buyers" },
  ]

  const buyerSteps = [
    { number: "1", title: "사업자 정보 제출", desc1: "EIN · VAT · 웹사이트 필수", desc2: "법인 계정 전용" },
    { number: "2", title: "승인 대기", desc1: "영업일 1일 내 관리자 검토", desc2: "이메일로 결과 안내" },
    { number: "3", title: "공급사 탐색", desc1: "FDA · 인증 · MOQ 기준 필터", desc2: "검증된 한국 제조사 접근" },
    { number: "4", title: "매칭 요청", desc1: "사업 서류 제출 후", desc2: "승인 완료 시 컨택 정보 공개" },
  ]

  const sellerSteps = [
    { number: "1", title: "계정 생성", desc1: "셀러 계정 등록", desc2: "아마존 · Shopify · TikTok Shop" },
    { number: "2", title: "공급사 탐색", desc1: "카테고리 · 인증 · 가격 기준", desc2: "원하는 조건으로 필터링" },
    { number: "3", title: "샘플 요청", desc1: "발주 전 품질 직접 확인", desc2: "제조사 직접 배송" },
    { number: "4", title: "판매 시작", desc1: "직접 소싱으로 마진 극대화", desc2: "검증된 공급망으로 운영" },
  ]

  const steps = activeTab === "supplier" ? supplierSteps : activeTab === "buyer" ? buyerSteps : sellerSteps

  return (
    <section id="how-it-works" className="bg-white py-20 px-6">
      <div className="max-w-[960px] mx-auto">
        <h2 className="text-2xl md:text-[28px] font-bold text-[#0F0F0F] text-center mb-12">
          How It Works
        </h2>

        <div className="flex justify-center gap-8 mb-12">
          <button
            onClick={() => setActiveTab("supplier")}
            className={cn(
              "text-sm font-semibold pb-2 border-b-2 transition-colors",
              activeTab === "supplier" ? "text-[#1A3A5C] border-[#1A3A5C]" : "text-[#6B6B6B] border-transparent hover:text-[#0F0F0F]"
            )}
          >
            Supplier
          </button>
          <button
            onClick={() => setActiveTab("buyer")}
            className={cn(
              "text-sm font-semibold pb-2 border-b-2 transition-colors",
              activeTab === "buyer" ? "text-[#1A3A5C] border-[#1A3A5C]" : "text-[#6B6B6B] border-transparent hover:text-[#0F0F0F]"
            )}
          >
            바이어
          </button>
          <button
            onClick={() => setActiveTab("seller")}
            className={cn(
              "text-sm font-semibold pb-2 border-b-2 transition-colors",
              activeTab === "seller" ? "text-[#1A3A5C] border-[#1A3A5C]" : "text-[#6B6B6B] border-transparent hover:text-[#0F0F0F]"
            )}
          >
            셀러
          </button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-[18px] left-[calc(50%+24px)] w-[calc(100%-48px)] border-t border-dashed border-[#E8E2DA]" />
              )}
              <div className="flex flex-col items-center text-center">
                <div className="w-9 h-9 rounded-full bg-[#F8F7F5] border-[1.5px] border-[#1A3A5C] flex items-center justify-center mb-4">
                  <span className="text-[#1A3A5C] font-semibold text-sm">{step.number}</span>
                </div>
                <h4 className="text-[15px] font-semibold text-[#0F0F0F] mb-2">{step.title}</h4>
                <p className="text-[13px] text-[#6B6B6B] leading-relaxed">
                  {step.desc1}
                  <br />
                  {step.desc2}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Footer ─────────────────────────────────────────────────────────────────

function FooterSection() {
  return (
    <footer className="bg-[#0F0F0F] py-12 px-6">
      <div className="max-w-[1280px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-1 mb-2">
              <span className="font-bold text-white">UnfoldK Beauty</span>
              <span className="text-[#C8A882]">&#9670;</span>
            </div>
            <p className="text-[13px] text-white/40">Your gateway to verified K-Beauty trade.</p>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-sm text-white/60 hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-sm text-white/60 hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/kbeauty/refund" className="text-sm text-white/60 hover:text-white transition-colors">Refund Policy</Link>
            <a href="mailto:contact@unfoldk.com" className="text-sm text-white/60 hover:text-white transition-colors">Contact</a>
          </div>
        </div>
        <div className="border-t border-white/10 my-6" />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <a href="/kbeauty/admin" className="text-sm text-white/40" style={{ textDecoration: "none" }}>&copy; 2026 UnfoldK Beauty by Unfold Lab.</a>
          <div className="flex items-center gap-4">
            <a href="#" className="text-white/60 hover:text-white transition-colors">
              <Instagram className="w-5 h-5" />
              <span className="sr-only">Instagram</span>
            </a>
            <a href="#" className="text-white/60 hover:text-white transition-colors">
              <Linkedin className="w-5 h-5" />
              <span className="sr-only">LinkedIn</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function BeautyLandingPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [auth, setAuth] = useState<AuthInfo>({ loaded: false, email: null, dashboards: [] })

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setAuth({ loaded: true, email: null, dashboards: [] }); return }

      // 역할별 대시보드 + 어드민 병렬 확인
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
    // 현재 페이지 유지
  }

  const handleSupplierCTA = () => {
    if (auth.dashboards.length > 0) { router.push(auth.dashboards[0].href); return }
    router.push("/kbeauty/supplier")
  }

  const handleBuyerCTA = () => {
    if (auth.dashboards.length > 0) { router.push(auth.dashboards[0].href); return }
    router.push("/kbeauty/buyer/register")
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <BeautyNavbar
        onLoginClick={() => router.push("/kbeauty/login")}
        onGetStartedClick={() => router.push("/kbeauty/auth")}
        auth={auth}
        onLogout={handleLogout}
      />
      <main>
        <HeroSection />
        <EntryCardsSection onSupplierCTA={handleSupplierCTA} onBuyerCTA={handleBuyerCTA} />
        <HowItWorksSection />
      </main>
      <FooterSection />
    </div>
  )
}
