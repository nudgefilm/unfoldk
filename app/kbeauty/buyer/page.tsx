"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Menu, ShieldCheck, ChevronUp, Zap, Globe2, FileCheck2, BarChart3, Package, Check, Instagram, Linkedin } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

// ─── Navbar ──────────────────────────────────────────────────────────────────

function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  return (
    <header className={`sticky top-0 z-50 w-full h-16 transition-shadow ${scrolled ? "bg-white/95 backdrop-blur-sm shadow-sm" : "bg-white border-b border-[#E8E2DA]"}`}>
      <div className="max-w-[1280px] mx-auto h-full px-6 flex items-center justify-between">
        <Link href="/kbeauty" className="flex items-center gap-1">
          <span className="font-bold text-[#0F0F0F]">UnfoldK Beauty</span>
          <span className="text-[#C8A882]">&#9670;</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          <Link href="/kbeauty/supplier" className="text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors">
            For Suppliers
          </Link>
          <Link href="/kbeauty/buyer" className="text-sm font-semibold text-[#0F0F0F] transition-colors">
            For Buyers
          </Link>
          <Link href="/kbeauty/seller" className="text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors">
            For Sellers
          </Link>
          <Link href="/kbeauty/data-sources" className="text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors">
            Data Sources
          </Link>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/kbeauty/buyer/login"
            className="text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors px-4 py-2"
          >
            Log in
          </Link>
          <Link
            href="/kbeauty/buyer/register"
            className="bg-[#1A3A5C] text-white text-sm font-semibold px-5 py-2.5 rounded-[8px] hover:bg-[#153249] transition-colors"
          >
            Get Buyer Access
          </Link>
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
              <Link href="/kbeauty/supplier" className="text-[#6B6B6B] hover:text-[#0F0F0F] py-2">For Suppliers</Link>
              <Link href="/kbeauty/buyer" className="font-semibold text-[#0F0F0F] py-2">For Buyers</Link>
              <Link href="/kbeauty/seller" className="text-[#6B6B6B] hover:text-[#0F0F0F] py-2">For Sellers</Link>
              <Link href="/kbeauty/data-sources" className="text-[#6B6B6B] hover:text-[#0F0F0F] py-2">Data Sources</Link>
              <div className="border-t border-[#E8E2DA] my-2" />
              <Link href="/kbeauty/buyer/login" className="text-[#6B6B6B] hover:text-[#0F0F0F] py-2">Log in</Link>
              <Link
                href="/kbeauty/buyer/register"
                className="bg-[#1A3A5C] text-white font-semibold px-5 py-3 rounded-[8px] w-full mt-2 text-center block"
              >
                Get Buyer Access
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

// ─── Section 1: Hero ─────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section
      className="px-6 pt-20 pb-24 relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #F8F7F5 0%, #F0EBE3 100%)" }}
    >
      {/* 배경 글로우 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(55% 50% at 90% 10%, rgba(200,168,130,0.22) 0%, transparent 65%), radial-gradient(40% 40% at 5% 90%, rgba(26,58,92,0.05) 0%, transparent 60%)",
        }}
      />

      <div className="max-w-[760px] mx-auto text-center relative z-10">
        <span className="inline-flex items-center gap-2 text-xs tracking-[0.15em] text-[#8B6F47] font-semibold uppercase mb-6 bg-[#C8A882]/15 px-4 py-1.5 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-[#C8A882]" />
          Buyer Access
        </span>

        <h1
          className="text-[#0F0F0F] font-bold leading-[1.06] mb-6 text-balance"
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize: "clamp(34px, 5vw, 60px)",
          }}
        >
          Find Verified Korean Beauty
          <br />
          Suppliers. Instantly.
        </h1>

        <p className="text-base md:text-lg text-[#6B6B6B] leading-relaxed mb-10 max-w-xl mx-auto">
          FDA &amp; MFDS data cross-checked. AI compliance analysis.
          <br className="hidden sm:block" />
          No broker. No guesswork.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/kbeauty/buyer/register"
            className="bg-[#1A3A5C] text-white font-bold px-9 py-3.5 rounded-[8px] hover:bg-[#153249] transition-colors inline-flex items-center gap-2 text-[15px] shadow-[0_4px_16px_rgba(26,58,92,0.25)]"
          >
            Get Buyer Access →
          </Link>
          <Link
            href="/kbeauty/buyer/login"
            className="text-[#6B6B6B] hover:text-[#0F0F0F] text-sm transition-colors px-4 py-3.5"
          >
            Log in
          </Link>
        </div>

        <p className="text-xs text-[#9A958C] mt-5">
          Business accounts only &middot; Approved within 1 business day
        </p>
      </div>
    </section>
  )
}

// ─── Section 2: FDA·MFDS Cross-Check + AI Compliance Engine ─────────────────

function ComplianceSection() {
  return (
    <section className="bg-white py-20 px-6">
      <div className="max-w-[1000px] mx-auto">
        <div className="text-center mb-14">
          <h2
            className="text-[#0F0F0F] font-bold leading-tight mb-4"
            style={{
              fontFamily: '"Cormorant Garamond", Georgia, serif',
              fontSize: "clamp(26px, 3.5vw, 40px)",
            }}
          >
            Stop Trusting Brokers.
            <br />
            Start Reading the Data.
          </h2>
          <p className="text-sm text-[#6B6B6B] max-w-md mx-auto">
            Every supplier on UnfoldK is cross-checked against MFDS and FDA registries before you see them.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">

          {/* 패널 1: Compliance Data Viewer */}
          <div className="border border-[#E8E2DA] rounded-[12px] p-7 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col gap-5">
            <div className="w-10 h-10 rounded-full bg-[#1A3A5C]/[0.07] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[#1A3A5C]" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-[#0F0F0F] mb-2">Compliance Data Viewer</h3>
              <p className="text-[13px] text-[#6B6B6B] leading-[1.7]">
                MFDS-certified CGMP status and FDA MoCRA Facility Registration Number displayed at a glance.
              </p>
            </div>
            {/* 목업 박스 */}
            <div className="bg-[#F8F7F5] rounded-[8px] border border-[#E8E2DA] p-4 mt-auto">
              <p className="text-[10px] text-[#9A958C] tracking-widest uppercase font-semibold mb-3">
                Supplier Verification
              </p>
              <div className="flex flex-col gap-2">
                {[
                  "CGMP Certified",
                  "MoCRA Facility No. 12345678",
                  "ISO 22716",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#1A3A5C] shrink-0" />
                    <span className="text-[12px] font-medium text-[#0F0F0F]">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 패널 2: AI Compliance Summary (핵심 강조) */}
          <div className="border-2 border-[#C8A882] rounded-[12px] p-7 shadow-[0_4px_20px_rgba(200,168,130,0.2)] flex flex-col gap-5 relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#C8A882] text-[#0F0F0F] text-[10px] font-bold tracking-wider px-3 py-1 rounded-full uppercase">
              Key Feature
            </span>
            <div className="w-10 h-10 rounded-full bg-[#C8A882]/15 flex items-center justify-center">
              <Zap className="w-5 h-5 text-[#8B6F47]" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-[#0F0F0F] mb-2">
                UnfoldK Compliance Audit
              </h3>
              <p className="text-[13px] text-[#6B6B6B] leading-[1.7]">
                Complex Korean regulatory data translated into a 3-line English risk report — instantly.
              </p>
            </div>
            {/* Compliance Audit 카드 목업 */}
            <div className="bg-[#FDFAF6] rounded-[8px] border border-[#E8E2DA] p-4 mt-auto">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold tracking-wider text-[#8B6F47] uppercase">
                  UnfoldK Compliance Audit
                </span>
              </div>
              <ol className="flex flex-col gap-2.5">
                <li className="text-[11.5px] text-[#0F0F0F] leading-[1.6]">
                  <span className="font-semibold text-[#1A3A5C]">1. MFDS Status:</span>{" "}
                  Clean. No administrative sanctions within 24 months.
                </li>
                <li className="text-[11.5px] text-[#0F0F0F] leading-[1.6]">
                  <span className="font-semibold text-[#1A3A5C]">2. US FDA MoCRA:</span>{" "}
                  Compliant. Facility registration and product listing verified.
                </li>
                <li className="text-[11.5px] text-[#0F0F0F] leading-[1.6]">
                  <span className="font-semibold text-[#1A3A5C]">3. Export Readiness:</span>{" "}
                  Optimal. Holds ISO 22716 with high-volume production capacity.
                </li>
              </ol>
            </div>
          </div>

          {/* 패널 3: Direct Match */}
          <div className="border border-[#E8E2DA] rounded-[12px] p-7 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col gap-5">
            <div className="w-10 h-10 rounded-full bg-[#1A3A5C]/[0.07] flex items-center justify-center">
              <Globe2 className="w-5 h-5 text-[#1A3A5C]" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-[#0F0F0F] mb-2">Direct Match</h3>
              <p className="text-[13px] text-[#6B6B6B] leading-[1.7]">
                Connect directly with verified suppliers after compliance check. No middlemen.
              </p>
            </div>
            {/* 목업 박스 */}
            <div className="bg-[#F8F7F5] rounded-[8px] border border-[#E8E2DA] p-4 mt-auto">
              <p className="text-[10px] text-[#9A958C] tracking-widest uppercase font-semibold mb-3">
                Match Flow
              </p>
              <div className="flex flex-col gap-2.5">
                {[
                  { step: "1", label: "Browse verified suppliers" },
                  { step: "2", label: "Request a match" },
                  { step: "3", label: "Contact info unlocked" },
                ].map((item) => (
                  <div key={item.step} className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#1A3A5C] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {item.step}
                    </span>
                    <span className="text-[12px] text-[#0F0F0F]">{item.label}</span>
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

// ─── Section 3: Benefits ─────────────────────────────────────────────────────

function BenefitsSection() {
  const benefits = [
    {
      icon: <ShieldCheck className="w-6 h-6 text-[#C8A882]" />,
      title: "Customs Data-Verified Suppliers",
      desc: "Verified through global trade and shipping records. Every listed supplier has been cross-checked.",
    },
    {
      icon: <FileCheck2 className="w-6 h-6 text-[#C8A882]" />,
      title: "FDA-Registered Manufacturers",
      desc: "MoCRA-compliant Korean manufacturers with active FDA facility registrations.",
    },
    {
      icon: <BarChart3 className="w-6 h-6 text-[#C8A882]" />,
      title: "Market Insight Reports",
      desc: "HS 3304·3305·3307 based US import analytics — know exactly what's moving, and from where.",
    },
  ]

  return (
    <section className="bg-[#F8F7F5] py-20 px-6">
      <div className="max-w-[960px] mx-auto">
        <h2
          className="text-center text-[#0F0F0F] font-bold mb-12"
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize: "clamp(24px, 3vw, 36px)",
          }}
        >
          What You Get as a Buyer
        </h2>

        <div className="grid md:grid-cols-3 gap-5">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="bg-white border border-[#E8E2DA] rounded-[12px] p-7 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.1)]"
            >
              <div className="w-10 h-10 rounded-full bg-[#F8F7F5] flex items-center justify-center mb-5">
                {b.icon}
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

// ─── Section 4: How to Get Access ────────────────────────────────────────────

function HowToAccessSection() {
  const steps = [
    {
      number: "01",
      title: "Register",
      sub: "Submit your buyer info",
      desc: "Amazon · Shopify · B2B importer. Business verification required.",
    },
    {
      number: "02",
      title: "Browse Suppliers",
      sub: "Filter by category, certification, MOQ",
      desc: "Access the full database of FDA & MFDS-verified Korean manufacturers.",
    },
    {
      number: "03",
      title: "Match & Source",
      sub: "Request samples. Contact info released after approval",
      desc: "Once matched, supplier contact details are unlocked for direct communication.",
    },
  ]

  return (
    <section className="bg-white py-20 px-6">
      <div className="max-w-[800px] mx-auto">
        <h2
          className="text-center text-[#0F0F0F] font-bold mb-14"
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize: "clamp(24px, 3vw, 36px)",
          }}
        >
          How to Get Access
        </h2>

        <div className="flex flex-col gap-0">
          {steps.map((s, i) => (
            <div key={s.number} className="flex gap-6 relative">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-[#1A3A5C] flex items-center justify-center shrink-0 z-10">
                  <span className="text-[13px] font-bold text-white">{s.number}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className="w-[1.5px] flex-1 bg-[#1A3A5C]/20 mt-1 mb-1 min-h-[48px]" />
                )}
              </div>
              <div className={`${i < steps.length - 1 ? "pb-10" : "pb-0"}`}>
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

// ─── Section 5: Final CTA ─────────────────────────────────────────────────────

function FinalCTASection() {
  return (
    <section className="py-24 px-6 text-center relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #F0EBE3 0%, #E8E0D4 100%)" }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 60% at 50% 0%, rgba(26,58,92,0.06) 0%, transparent 70%)",
        }}
      />
      <div className="max-w-[560px] mx-auto relative z-10">
        <h2
          className="text-[#0F0F0F] font-bold leading-tight mb-4"
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize: "clamp(28px, 4vw, 44px)",
          }}
        >
          Ready to Source
          <br />
          Verified K-Beauty?
        </h2>
        <p className="text-[#6B6B6B] text-base mb-10">
          Join verified buyers already sourcing from Korea.
        </p>
        <Link
          href="/kbeauty/buyer/register"
          className="bg-[#1A3A5C] text-white font-bold px-10 py-3.5 rounded-[8px] hover:bg-[#153249] transition-colors inline-flex items-center gap-2 text-[15px] shadow-[0_4px_16px_rgba(26,58,92,0.25)]"
        >
          Get Buyer Access →
        </Link>
        <p className="mt-5 text-sm text-[#9A958C]">
          Already have an account?{" "}
          <Link href="/kbeauty/buyer/login" className="text-[#6B6B6B] hover:text-[#0F0F0F] underline transition-colors">
            Log in →
          </Link>
        </p>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

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

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function BuyerLandingPage() {
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
        <ComplianceSection />
        <BenefitsSection />
        <HowToAccessSection />
        <FinalCTASection />
      </main>
      <FooterSection />
      <ScrollTopButton />
    </div>
  )
}
