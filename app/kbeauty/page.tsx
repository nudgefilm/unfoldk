"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Menu, Check, Instagram, Linkedin } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

type UserRole = "supplier" | "buyer" | null | "loading"

// ─── Navbar ────────────────────────────────────────────────────────────────

function BeautyNavbar({
  onLoginClick,
  onGetStartedClick,
}: {
  onLoginClick: () => void
  onGetStartedClick: () => void
}) {
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
          <a href="#how-it-works" className="text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors">
            How It Works
          </a>
          <a href="#data-sources" className="text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors">
            Data Sources
          </a>
        </nav>

        <div className="hidden md:flex items-center gap-3">
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
        </div>

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
              <a href="#how-it-works" className="text-[#6B6B6B] hover:text-[#0F0F0F] py-2">How It Works</a>
              <a href="#data-sources" className="text-[#6B6B6B] hover:text-[#0F0F0F] py-2">Data Sources</a>
              <div className="border-t border-[#E8E2DA] my-2" />
              <button onClick={onLoginClick} className="text-[#6B6B6B] hover:text-[#0F0F0F] py-2 text-left">
                Log in
              </button>
              <button
                onClick={onGetStartedClick}
                className="bg-[#1A3A5C] text-white font-medium px-5 py-3 rounded-md w-full mt-2"
              >
                Get Started
              </button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}

// ─── Hero ───────────────────────────────────────────────────────────────────

function HeroSection({
  onSupplierCTA,
  onBuyerCTA,
}: {
  onSupplierCTA: () => void
  onBuyerCTA: () => void
}) {
  return (
    <section className="bg-white py-20 px-6 min-h-[calc(100vh-64px)] flex items-center">
      <div className="max-w-[1280px] mx-auto w-full">
        <div className="grid lg:grid-cols-[55%_45%] gap-12 items-center">
          <div>
            <span className="text-xs tracking-[0.15em] text-[#C8A882] font-medium mb-4 block">
              B2B PLATFORM
            </span>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-[56px] text-[#0F0F0F] leading-[1.1] mb-6">
              Connect with Verified
              <br />
              Korean Beauty Suppliers.
            </h1>
            <div className="mb-10 max-w-lg">
              <p className="text-base text-[#0F0F0F] leading-relaxed">
                ImportGenius 세관 데이터 기반 북미 바이어 2,000개사.
              </p>
              <p className="text-base text-[#6B6B6B] leading-relaxed mt-1">
                500+ FDA-registered Korean manufacturers.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <button
                onClick={onSupplierCTA}
                className="bg-[#1A3A5C] text-white font-semibold px-7 py-3.5 rounded-md hover:bg-[#153249] transition-colors inline-flex items-center justify-center gap-2"
              >
                공급사 파트너 신청
                <span className="text-lg">&#8594;</span>
              </button>
              <button
                onClick={onBuyerCTA}
                className="border-[1.5px] border-[#1A3A5C] text-[#1A3A5C] font-semibold px-7 py-3.5 rounded-md hover:bg-[#1A3A5C]/5 transition-colors inline-flex items-center justify-center gap-2"
              >
                Get Buyer Access
                <span className="text-lg">&#8594;</span>
              </button>
            </div>

            <p className="text-xs text-[#C8A882] mt-4">
              2,000+ verified buyers &middot; 500+ FDA-registered suppliers
            </p>
          </div>

          <div className="relative hidden lg:block">
            <div className="relative h-[400px] w-[380px]">
              <div
                className="absolute w-52 h-72 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#E8E2DA]/50"
                style={{ backgroundColor: "#C4B5A0", top: "10px", left: "0px", transform: "rotate(-8deg)" }}
              />
              <div
                className="absolute w-52 h-72 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] border border-[#E8E2DA]/50"
                style={{ backgroundColor: "#E8C9A0", top: "20px", left: "60px", transform: "rotate(4deg)" }}
              />
              <div
                className="absolute w-52 h-72 rounded-xl shadow-[0_16px_50px_rgba(0,0,0,0.18)] border border-[#E8E2DA]/50"
                style={{ backgroundColor: "#D4A896", top: "40px", left: "120px", transform: "rotate(-3deg)" }}
              >
                <div className="absolute top-4 left-4 bg-[#1A3A5C] text-white text-[10px] font-medium px-2.5 py-1.5 rounded-md shadow-sm">
                  VERIFIED SUPPLIER
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Trust Stats ────────────────────────────────────────────────────────────

function TrustStatsSection() {
  return (
    <section id="data-sources" className="bg-[#1A3A5C] py-16 px-6">
      <div className="max-w-[960px] mx-auto">
        <div className="grid md:grid-cols-3 gap-8 md:gap-0">
          <div className="text-center md:border-r md:border-white/15 md:pr-8">
            <div className="font-serif text-5xl text-[#C8A882] mb-2">2,000+</div>
            <div className="text-[11px] uppercase tracking-wider text-white/60 mb-1">VERIFIED US IMPORTERS</div>
            <div className="text-[13px] text-white/40">ImportGenius customs records</div>
          </div>
          <div className="text-center md:border-r md:border-white/15 md:px-8">
            <div className="font-serif text-5xl text-[#C8A882] mb-2">500+</div>
            <div className="text-[11px] uppercase tracking-wider text-white/60 mb-1">FDA-REGISTERED SUPPLIERS</div>
            <div className="text-[13px] text-white/40">MoCRA-compliant manufacturers</div>
          </div>
          <div className="text-center md:pl-8">
            <div className="font-serif text-[30px] text-[#C8A882] mb-2">3304 &middot; 3305 &middot; 3307</div>
            <div className="text-[11px] uppercase tracking-wider text-white/60 mb-1">HS CODES COVERED</div>
            <div className="text-[13px] text-white/40">Skincare &middot; Haircare &middot; Fragrance</div>
          </div>
        </div>
      </div>
    </section>
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
      <div className="max-w-[880px] mx-auto">
        <h2 className="text-2xl md:text-[28px] font-bold text-[#0F0F0F] text-center mb-12">
          Are you in the business?
        </h2>

        <div className="grid md:grid-cols-2 gap-6" id="buyers">
          {/* 공급사 카드 */}
          <div className="bg-white border border-[#E8E2DA] rounded-xl p-8 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <span className="inline-block bg-[#1A3A5C]/10 text-[#1A3A5C] text-xs font-medium px-4 py-1.5 rounded-full mb-4">
              공급사
            </span>
            <h3 className="text-[22px] font-bold text-[#0F0F0F] mb-1">국내 공급사</h3>
            <p className="text-sm text-[#6B6B6B] mb-6">K-뷰티 제조&middot;브랜드사라면</p>
            <div className="border-t border-[#E8E2DA] my-6" />
            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-3 text-sm text-[#0F0F0F]">
                <Check className="w-4 h-4 text-[#1A3A5C] mt-0.5 flex-shrink-0" />
                검증된 북미 바이어 2,000개사 연결
              </li>
              <li className="flex items-start gap-3 text-sm text-[#0F0F0F]">
                <Check className="w-4 h-4 text-[#1A3A5C] mt-0.5 flex-shrink-0" />
                FDA 등록 기반 신뢰 배지 제공
              </li>
              <li className="flex items-start gap-3 text-sm text-[#0F0F0F]">
                <Check className="w-4 h-4 text-[#1A3A5C] mt-0.5 flex-shrink-0" />
                국세청 API 사업자 인증으로 빠른 입점
              </li>
            </ul>
            <button
              onClick={onSupplierCTA}
              className="w-full bg-[#1A3A5C] text-white font-semibold py-3.5 rounded-md hover:bg-[#153249] transition-colors inline-flex items-center justify-center gap-2"
            >
              공급사 파트너 신청
              <span className="text-lg">&#8594;</span>
            </button>
          </div>

          {/* 바이어 카드 */}
          <div className="bg-white border border-[#E8E2DA] rounded-xl p-8 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <span className="inline-block bg-[#C8A882]/15 text-[#8B6F47] text-xs font-medium px-4 py-1.5 rounded-full mb-4">
              Buyer
            </span>
            <h3 className="text-[22px] font-bold text-[#0F0F0F] mb-1">For Global Buyers</h3>
            <p className="text-sm text-[#6B6B6B] mb-6">Looking for Korean beauty suppliers?</p>
            <div className="border-t border-[#E8E2DA] my-6" />
            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-3 text-sm text-[#0F0F0F]">
                <Check className="w-4 h-4 text-[#C8A882] mt-0.5 flex-shrink-0" />
                ImportGenius-verified supplier database
              </li>
              <li className="flex items-start gap-3 text-sm text-[#0F0F0F]">
                <Check className="w-4 h-4 text-[#C8A882] mt-0.5 flex-shrink-0" />
                FDA-registered Korean manufacturers
              </li>
              <li className="flex items-start gap-3 text-sm text-[#0F0F0F]">
                <Check className="w-4 h-4 text-[#C8A882] mt-0.5 flex-shrink-0" />
                Market insight reports (HS 3304&middot;3305&middot;3307)
              </li>
            </ul>
            <button
              onClick={onBuyerCTA}
              className="w-full border-[1.5px] border-[#C8A882] text-[#8B6F47] font-semibold py-3.5 rounded-md hover:bg-[#C8A882]/10 transition-colors inline-flex items-center justify-center gap-2"
            >
              Get Buyer Access
              <span className="text-lg">&#8594;</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── How It Works ───────────────────────────────────────────────────────────

function HowItWorksSection() {
  const [activeTab, setActiveTab] = useState<"supplier" | "buyer">("supplier")

  const supplierSteps = [
    { number: "1", title: "사업자 인증", desc1: "국세청 API 자동 검증", desc2: "빠르고 정확한 국내 사업자 확인" },
    { number: "2", title: "제품 등록", desc1: "인증 배지 포함 상세 등록", desc2: "MOQ·가격·수출 조건 포함" },
    { number: "3", title: "바이어 매칭 요청", desc1: "타깃 국가·카테고리 설정", desc2: "검증된 바이어에게 직접 요청" },
    { number: "4", title: "컨택 정보 공개", desc1: "관리자 최종 승인 후", desc2: "직접 소통 시작" },
  ]

  const buyerSteps = [
    { number: "1", title: "Submit Business Info", desc1: "EIN · VAT · Website required", desc2: "Business accounts only" },
    { number: "2", title: "Get Approved", desc1: "Admin review within 1 business day", desc2: "Confirmation via email" },
    { number: "3", title: "Browse Suppliers", desc1: "Filter by FDA · Certification · MOQ", desc2: "Access verified Korean manufacturers" },
    { number: "4", title: "Request a Match", desc1: "Submit business documents", desc2: "Contact info released after approval" },
  ]

  const steps = activeTab === "supplier" ? supplierSteps : buyerSteps

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
            공급사
          </button>
          <button
            onClick={() => setActiveTab("buyer")}
            className={cn(
              "text-sm font-semibold pb-2 border-b-2 transition-colors",
              activeTab === "buyer" ? "text-[#1A3A5C] border-[#1A3A5C]" : "text-[#6B6B6B] border-transparent hover:text-[#0F0F0F]"
            )}
          >
            Buyer
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
            <a href="mailto:contact@unfoldk.com" className="text-sm text-white/60 hover:text-white transition-colors">Contact</a>
          </div>
        </div>
        <div className="border-t border-white/10 my-6" />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-sm text-white/40">&copy; 2026 UnfoldK Beauty by Unfold Lab.</p>
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
  const [userRole, setUserRole] = useState<UserRole>("loading")

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setUserRole(null); return }

      const { data: supplier } = await supabase
        .from("beauty_suppliers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()
      if (supplier) { setUserRole("supplier"); return }

      const { data: buyer } = await supabase
        .from("beauty_buyers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()
      if (buyer) { setUserRole("buyer"); return }

      setUserRole(null)
    })
  }, [])

  const handleSupplierCTA = () => {
    if (userRole === "supplier") { router.push("/kbeauty/dashboard/supplier"); return }
    if (userRole === "buyer") { router.push("/kbeauty/dashboard/buyer"); return }
    router.push("/kbeauty/supplier")
  }

  const handleBuyerCTA = () => {
    if (userRole === "supplier") { router.push("/kbeauty/dashboard/supplier"); return }
    if (userRole === "buyer") { router.push("/kbeauty/dashboard/buyer"); return }
    router.push("/kbeauty/buyer/register")
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <BeautyNavbar
        onLoginClick={() => router.push("/kbeauty/login")}
        onGetStartedClick={() => router.push("/kbeauty/auth")}
      />
      <main>
        <HeroSection onSupplierCTA={handleSupplierCTA} onBuyerCTA={handleBuyerCTA} />
        <TrustStatsSection />
        <EntryCardsSection onSupplierCTA={handleSupplierCTA} onBuyerCTA={handleBuyerCTA} />
        <HowItWorksSection />
      </main>
      <FooterSection />
    </div>
  )
}
