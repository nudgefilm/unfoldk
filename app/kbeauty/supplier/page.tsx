"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Menu, ShieldCheck, ChevronUp, FileCheck2, Award, Globe2, Users, Package, Check, Instagram, Linkedin } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

// ─── 네비게이션 ──────────────────────────────────────────────────────────────

function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  return (
    <header className={`sticky top-0 z-50 w-full h-16 transition-all duration-200 ${scrolled ? "bg-white/95 backdrop-blur-sm shadow-sm" : "bg-[#1A3A5C]"}`}>
      <div className="max-w-[1280px] mx-auto h-full px-6 flex items-center justify-between">
        <Link href="/kbeauty" className="flex items-center gap-1">
          <span className={`font-bold transition-colors ${scrolled ? "text-[#0F0F0F]" : "text-white"}`}>UnfoldK Beauty</span>
          <span className="text-[#C8A882]">&#9670;</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          <Link href="/kbeauty/supplier" className={`text-sm transition-colors ${scrolled ? "text-[#0F0F0F] font-semibold" : "text-white/80 hover:text-white"}`}>
            공급사
          </Link>
          <Link href="/kbeauty/buyer" className={`text-sm transition-colors ${scrolled ? "text-[#6B6B6B] hover:text-[#0F0F0F]" : "text-white/70 hover:text-white"}`}>
            For Buyers
          </Link>
          <Link href="/kbeauty/seller" className={`text-sm transition-colors ${scrolled ? "text-[#6B6B6B] hover:text-[#0F0F0F]" : "text-white/70 hover:text-white"}`}>
            For Sellers
          </Link>
          <Link href="/kbeauty/data-sources" className={`text-sm transition-colors ${scrolled ? "text-[#6B6B6B] hover:text-[#0F0F0F]" : "text-white/70 hover:text-white"}`}>
            Data Sources
          </Link>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/kbeauty/supplier/login"
            className={`text-sm transition-colors px-4 py-2 ${scrolled ? "text-[#6B6B6B] hover:text-[#0F0F0F]" : "text-white/80 hover:text-white"}`}
          >
            로그인
          </Link>
          <Link
            href="/kbeauty/supplier/register"
            className="bg-[#C8A882] text-[#0F0F0F] text-sm font-semibold px-5 py-2.5 rounded-[8px] hover:bg-[#b8956e] transition-colors"
          >
            파트너 신청
          </Link>
        </div>

        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <button className={`p-2 transition-colors ${scrolled ? "text-[#0F0F0F]" : "text-white"}`}>
              <Menu className="h-6 w-6" />
              <span className="sr-only">메뉴 열기</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="bg-[#1A3A5C] border-t border-white/10">
            <nav className="flex flex-col gap-4 mt-6">
              <Link href="/kbeauty/supplier" className="text-white font-medium py-2">공급사</Link>
              <Link href="/kbeauty/buyer" className="text-white/70 py-2">For Buyers</Link>
              <Link href="/kbeauty/seller" className="text-white/70 py-2">For Sellers</Link>
              <Link href="/kbeauty/data-sources" className="text-white/70 py-2">Data Sources</Link>
              <div className="border-t border-white/10 my-2" />
              <Link href="/kbeauty/supplier/login" className="text-white/80 py-2">로그인</Link>
              <Link
                href="/kbeauty/supplier/register"
                className="bg-[#C8A882] text-[#0F0F0F] font-semibold px-5 py-3 rounded-[8px] w-full mt-2 text-center block"
              >
                파트너 신청
              </Link>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}

function ScrollTopButton() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  if (!visible) return null
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-8 right-8 z-50 w-11 h-11 rounded-full flex items-center justify-center shadow-lg hover:opacity-80 transition-opacity"
      style={{ background: "#1A3A5C" }}
      aria-label="Back to top"
    >
      <ChevronUp className="w-5 h-5 text-white" />
    </button>
  )
}

// ─── Section 1: 히어로 ────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="bg-[#1A3A5C] min-h-[82vh] flex items-center justify-center px-6 pt-16 pb-20 relative overflow-hidden">
      {/* 배경 글로우 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(55% 45% at 85% 20%, rgba(200,168,130,0.12) 0%, transparent 70%), radial-gradient(40% 35% at 10% 85%, rgba(255,255,255,0.04) 0%, transparent 70%)",
        }}
      />

      <div className="max-w-[680px] text-center relative z-10">
        <span className="inline-flex items-center gap-2 text-xs tracking-[0.15em] text-[#C8A882] font-semibold uppercase mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-[#C8A882]" />
          공급사 전용
        </span>

        <h1
          className="text-white font-bold leading-[1.08] mb-6 text-balance"
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize: "clamp(36px, 5vw, 58px)",
          }}
        >
          북미 바이어와 연결되는
          <br />
          가장 빠른 방법
        </h1>

        <p className="text-base md:text-lg text-white/65 leading-relaxed mb-10 max-w-lg mx-auto">
          식약처·FDA 데이터 기반 자동 인증으로
          <br />
          글로벌 신뢰 배지를 즉시 획득하세요
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/kbeauty/supplier/register"
            className="bg-[#C8A882] text-[#0F0F0F] font-bold px-9 py-3.5 rounded-[8px] hover:bg-[#b8956e] transition-colors inline-flex items-center gap-2 text-[15px]"
          >
            공급사 파트너 신청 →
          </Link>
          <Link
            href="/kbeauty/supplier/login"
            className="text-white/70 hover:text-white text-sm transition-colors px-4 py-3.5"
          >
            로그인
          </Link>
        </div>

        <p className="text-xs text-white/35 mt-5">
          사업자등록번호 입력만으로 자동 인증 · 서류 제출 불필요
        </p>
      </div>
    </section>
  )
}

// ─── Section 2: Verified Badge 획득 메커니즘 ────────────────────────────────

function VerifiedBadgeSection() {
  const steps = [
    {
      step: "Step 1",
      icon: <ShieldCheck className="w-6 h-6 text-[#1A3A5C]" />,
      title: "식약처 API 자동 조회",
      desc: "사업자등록번호 입력 → 식약처 행정처분 이력 및 CGMP·ISO22716 데이터 실시간 매핑",
    },
    {
      step: "Step 2",
      icon: <FileCheck2 className="w-6 h-6 text-[#1A3A5C]" />,
      title: "FDA 데이터 연동",
      desc: "FDA MoCRA 등록 데이터베이스와 공급사 정보 자동 대조",
    },
    {
      step: "Step 3",
      icon: <Award className="w-6 h-6 text-[#1A3A5C]" />,
      title: "UnfoldK Verified Badge 발급",
      desc: "검증 완료 즉시 Verified 배지 발급 → 바이어 검색 결과에 우선 노출",
    },
  ]

  return (
    <section className="bg-[#F8F7F5] py-20 px-6">
      <div className="max-w-[960px] mx-auto">
        <div className="text-center mb-14">
          <h2
            className="text-[#0F0F0F] font-bold leading-tight mb-4"
            style={{
              fontFamily: '"Cormorant Garamond", Georgia, serif',
              fontSize: "clamp(26px, 3.5vw, 38px)",
            }}
          >
            복잡한 서류 제출 없이,
            <br />
            1초 만에 글로벌 신뢰를 증명하세요
          </h2>
          <p className="text-sm text-[#6B6B6B]">사업자등록번호 하나로 모든 인증 프로세스가 자동 처리됩니다</p>
        </div>

        {/* 3단계 카드 */}
        <div className="grid md:grid-cols-3 gap-5 mb-12">
          {steps.map((s) => (
            <div
              key={s.step}
              className="bg-white border border-[#E8E2DA] rounded-[12px] p-7 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.1)]"
            >
              <span className="text-[10px] tracking-[0.16em] font-semibold text-[#C8A882] uppercase block mb-4">
                {s.step}
              </span>
              <div className="w-10 h-10 rounded-full bg-[#1A3A5C]/[0.07] flex items-center justify-center mb-4">
                {s.icon}
              </div>
              <h3 className="text-[15px] font-bold text-[#0F0F0F] mb-2">{s.title}</h3>
              <p className="text-[13px] text-[#6B6B6B] leading-[1.7]">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* 대시보드 목업 카드 */}
        <div className="bg-white border border-[#E8E2DA] rounded-[12px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden max-w-[480px] mx-auto">
          {/* 목업 타이틀 바 */}
          <div className="bg-[#1A3A5C] px-5 py-3 flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
            </div>
            <span className="text-[11px] text-white/50 ml-2">UnfoldK Beauty — 공급사 프로필</span>
          </div>
          {/* 목업 바디 */}
          <div className="p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[11px] text-[#6B6B6B] mb-1">등록 공급사</p>
                <p className="text-base font-bold text-[#0F0F0F]">㈜ 한국 코스메틱스</p>
                <p className="text-[12px] text-[#6B6B6B] mt-0.5">스킨케어 · 마스크팩</p>
              </div>
              <span className="inline-flex items-center gap-1.5 bg-[#1A3A5C] text-white text-[11px] font-semibold px-3 py-1.5 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified
              </span>
            </div>
            <div className="border-t border-[#E8E2DA] pt-4">
              <p className="text-[10px] tracking-[0.12em] text-[#6B6B6B] uppercase font-semibold mb-3">인증 현황</p>
              <div className="flex flex-col gap-2.5">
                {[
                  { label: "CGMP 인증", sub: "화장품 제조업 기준" },
                  { label: "MoCRA 등록", sub: "FDA 데이터베이스 확인" },
                  { label: "ISO 22716", sub: "국제 품질 기준" },
                ].map((cert) => (
                  <div key={cert.label} className="flex items-center justify-between">
                    <div>
                      <span className="text-[13px] font-medium text-[#0F0F0F]">{cert.label}</span>
                      <span className="text-[11px] text-[#6B6B6B] ml-2">{cert.sub}</span>
                    </div>
                    <span className="text-[12px] font-semibold text-[#1A3A5C] flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> 완료
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Section 3: 혜택 ─────────────────────────────────────────────────────────

function BenefitsSection() {
  const benefits = [
    {
      icon: <Globe2 className="w-6 h-6 text-[#C8A882]" />,
      badge: "노출",
      title: "글로벌 바이어 2,000개사 노출",
      desc: "북미·유럽 수입사 데이터베이스에 공급사 프로필이 자동 노출됩니다",
      plan: null,
    },
    {
      icon: <Users className="w-6 h-6 text-[#C8A882]" />,
      badge: "Free",
      title: "매칭 요청 무제한 수신",
      desc: "바이어가 먼저 찾아옵니다. 요청 수신은 무료 플랜에서도 무제한입니다",
      plan: "free",
    },
    {
      icon: <Package className="w-6 h-6 text-[#C8A882]" />,
      badge: "Pro",
      title: "샘플 요청·컨택 정보 공개",
      desc: "Pro 플랜에서 매칭 승인, 샘플 수락, 담당자 정보 공개가 가능합니다",
      plan: "pro",
    },
  ]

  return (
    <section className="bg-white py-20 px-6">
      <div className="max-w-[960px] mx-auto">
        <h2
          className="text-center text-[#0F0F0F] font-bold mb-12"
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize: "clamp(24px, 3vw, 34px)",
          }}
        >
          UnfoldK에 입점하면 달라지는 것들
        </h2>

        <div className="grid md:grid-cols-3 gap-5">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="border border-[#E8E2DA] rounded-[12px] p-7 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.1)]"
            >
              <div className="flex items-start justify-between mb-5">
                <div className="w-10 h-10 rounded-full bg-[#F8F7F5] flex items-center justify-center">
                  {b.icon}
                </div>
                {b.badge && (
                  <span
                    className={`text-[10px] font-semibold tracking-wider px-2.5 py-1 rounded-full ${
                      b.badge === "Pro"
                        ? "bg-[#1A3A5C] text-white"
                        : b.badge === "Free"
                        ? "bg-[#E8E2DA] text-[#6B6B6B]"
                        : "bg-[#C8A882]/15 text-[#8B6F47]"
                    }`}
                  >
                    {b.badge}
                  </span>
                )}
              </div>
              <h3 className="text-[15px] font-bold text-[#0F0F0F] mb-2">{b.title}</h3>
              <p className="text-[13px] text-[#6B6B6B] leading-[1.7]">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Section 4: How to Get Started ───────────────────────────────────────────

function HowToStartSection() {
  const steps = [
    {
      number: "01",
      title: "사업자 인증",
      sub: "국세청 API 자동 검증",
      desc: "사업자등록번호를 입력하면 국세청 API와 식약처 데이터를 실시간으로 조회합니다",
    },
    {
      number: "02",
      title: "제품 등록",
      sub: "인증 배지 포함 상세 등록",
      desc: "검증된 인증 배지와 함께 제품 카테고리·MOQ·가격대·샘플 조건을 등록합니다",
    },
    {
      number: "03",
      title: "바이어 매칭",
      sub: "검증된 바이어에게 직접 요청 수신",
      desc: "북미·유럽 바이어가 공급사 프로필을 발견하면 매칭 요청을 직접 보냅니다",
    },
  ]

  return (
    <section className="bg-[#F8F7F5] py-20 px-6">
      <div className="max-w-[800px] mx-auto">
        <h2
          className="text-center text-[#0F0F0F] font-bold mb-14"
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize: "clamp(24px, 3vw, 34px)",
          }}
        >
          시작하는 방법
        </h2>

        <div className="flex flex-col gap-0">
          {steps.map((s, i) => (
            <div key={s.number} className="flex gap-6 relative">
              {/* 왼쪽: 번호 + 연결선 */}
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-[#1A3A5C] flex items-center justify-center shrink-0 z-10">
                  <span className="text-[13px] font-bold text-white">{s.number}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className="w-[1.5px] flex-1 bg-[#1A3A5C]/20 mt-1 mb-1 min-h-[48px]" />
                )}
              </div>
              {/* 오른쪽: 텍스트 */}
              <div className={`pb-10 ${i === steps.length - 1 ? "pb-0" : ""}`}>
                <p className="text-[11px] tracking-[0.12em] text-[#C8A882] font-semibold uppercase mb-1">
                  {s.sub}
                </p>
                <h3 className="text-[16px] font-bold text-[#0F0F0F] mb-2">{s.title}</h3>
                <p className="text-[13px] text-[#6B6B6B] leading-[1.7]">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Section 5: Final CTA ────────────────────────────────────────────────────

function FinalCTASection() {
  return (
    <section className="bg-[#1A3A5C] py-24 px-6 text-center relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 60% at 50% 100%, rgba(200,168,130,0.1) 0%, transparent 70%)",
        }}
      />
      <div className="max-w-[560px] mx-auto relative z-10">
        <h2
          className="text-white font-bold leading-tight mb-4"
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize: "clamp(28px, 4vw, 44px)",
          }}
        >
          지금 바로 글로벌 바이어와
          <br />
          연결하세요
        </h2>
        <p className="text-white/60 text-base mb-10">
          이미 500개 이상의 FDA 등록 공급사가 입점해 있습니다
        </p>
        <Link
          href="/kbeauty/supplier/register"
          className="bg-[#C8A882] text-[#0F0F0F] font-bold px-10 py-3.5 rounded-[8px] hover:bg-[#b8956e] transition-colors inline-flex items-center gap-2 text-[15px]"
        >
          공급사 파트너 신청 →
        </Link>
        <p className="mt-5 text-sm text-white/45">
          이미 계정이 있으신가요?{" "}
          <Link href="/kbeauty/supplier/login" className="text-white/70 hover:text-white underline transition-colors">
            로그인 →
          </Link>
        </p>
      </div>
    </section>
  )
}

// ─── Footer ──────────────────────────────────────────────────────────────────

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
            <Link href="/privacy" className="text-sm text-white/60 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-sm text-white/60 hover:text-white transition-colors">
              Terms of Service
            </Link>
            <Link href="/kbeauty/refund" className="text-sm text-white/60 hover:text-white transition-colors">
              Refund Policy
            </Link>
            <a href="mailto:contact@unfoldk.com" className="text-sm text-white/60 hover:text-white transition-colors">
              Contact
            </a>
          </div>
        </div>
        <div className="border-t border-white/10 my-6" />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <a href="/kbeauty/admin" className="text-sm text-white/40" style={{ textDecoration: "none" }}>
            &copy; 2026 UnfoldK Beauty by Unfold Lab.
          </a>
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

// ─── 메인 ─────────────────────────────────────────────────────────────────────

export default function SupplierLandingPage() {
  return (
    <div
      className="min-h-screen bg-white"
      style={{
        fontFamily:
          '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      }}
    >
      <Navbar />
      <main>
        <HeroSection />
        <VerifiedBadgeSection />
        <BenefitsSection />
        <HowToStartSection />
        <FinalCTASection />
      </main>
      <FooterSection />
      <ScrollTopButton />
    </div>
  )
}
