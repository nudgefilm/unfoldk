"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Crosshair, ShieldCheck, ChevronUp, TrendingUp, Zap, Star, Package, Check, Instagram, Linkedin } from "lucide-react"
import { BeautyNavbar } from "@/components/kbeauty/BeautyNavbar"

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
    <section className="bg-[#1A3A5C] min-h-[82vh] flex items-center justify-center px-6 pt-16 pb-20 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(55% 45% at 85% 15%, rgba(200,168,130,0.15) 0%, transparent 65%), radial-gradient(40% 40% at 8% 88%, rgba(255,255,255,0.04) 0%, transparent 60%)",
        }}
      />

      <div className="max-w-[720px] text-center relative z-10">
        <span className="inline-flex items-center gap-2 text-xs tracking-[0.15em] text-[#C8A882] font-semibold uppercase mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-[#C8A882]" />
          Seller Access
        </span>

        <h1
          className="text-white font-bold leading-[1.06] mb-6 text-balance"
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize: "clamp(32px, 5vw, 58px)",
          }}
        >
          Source K-Beauty Products That
          <br />
          Actually Clear US Customs.
        </h1>

        <p className="text-base md:text-lg text-white/60 leading-relaxed mb-10 max-w-xl mx-auto">
          Ingredient compliance pre-checked. FDA labeling verified.
          <br className="hidden sm:block" />
          Zero detention risk.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/kbeauty/seller/register"
            className="bg-[#C8A882] text-[#0F0F0F] font-bold px-9 py-3.5 rounded-[8px] hover:bg-[#b8956e] transition-colors inline-flex items-center gap-2 text-[15px]"
          >
            Get Seller Access →
          </Link>
          <Link
            href="/kbeauty/seller/login"
            className="text-white/65 hover:text-white text-sm transition-colors px-4 py-3.5"
          >
            Log in
          </Link>
        </div>

        <p className="text-xs text-white/30 mt-5">
          Business accounts only &middot; Amazon · Shopify · TikTok Shop
        </p>
      </div>
    </section>
  )
}

// ─── Section 2: Ingredient Compliance Mechanism ──────────────────────────────

function ComplianceSection() {
  return (
    <section className="bg-[#F8F7F5] py-20 px-6">
      <div className="max-w-[1000px] mx-auto">
        <div className="text-center mb-14">
          <h2
            className="text-[#0F0F0F] font-bold leading-tight mb-4"
            style={{
              fontFamily: '"Cormorant Garamond", Georgia, serif',
              fontSize: "clamp(24px, 3.5vw, 40px)",
            }}
          >
            Every Product. Pre-Screened.
            <br />
            Before It Reaches Your Warehouse.
          </h2>
          <p className="text-sm text-[#6B6B6B] max-w-md mx-auto">
            We cross-check every supplier&apos;s ingredient list against FDA prohibited and restricted databases before you source.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">

          {/* 패널 1: Ingredient Sniper */}
          <div className="bg-white border border-[#E8E2DA] rounded-[12px] p-7 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col gap-5">
            <div className="w-10 h-10 rounded-full bg-[#1A3A5C]/[0.07] flex items-center justify-center">
              <Crosshair className="w-5 h-5 text-[#1A3A5C]" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-[#0F0F0F] mb-2">Ingredient Sniper</h3>
              <p className="text-[13px] text-[#6B6B6B] leading-[1.7]">
                Supplier ingredient lists are scanned against FDA prohibited &amp; restricted ingredient database automatically.
              </p>
            </div>
            {/* 목업 카드 */}
            <div className="bg-[#F8F7F5] rounded-[8px] border border-[#E8E2DA] p-4 mt-auto">
              <p className="text-[10px] text-[#9A958C] tracking-widest uppercase font-semibold mb-3">
                Ingredient Checklist
              </p>
              <div className="flex flex-col gap-2.5">
                {[
                  "Retinol % Matrix Check: Pass",
                  "FDA Labeling Guideline Match: 98%",
                  "Safe for US Import",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#1A3A5C] shrink-0 mt-0.5" />
                    <span className="text-[12px] font-medium text-[#0F0F0F] leading-snug">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 패널 2: UnfoldK Compliance Audit (핵심 강조) */}
          <div className="bg-white border-2 border-[#C8A882] rounded-[12px] p-7 shadow-[0_4px_20px_rgba(200,168,130,0.2)] flex flex-col gap-5 relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#C8A882] text-[#0F0F0F] text-[10px] font-bold tracking-wider px-3 py-1 rounded-full uppercase whitespace-nowrap">
              Key Feature
            </span>
            <div className="w-10 h-10 rounded-full bg-[#C8A882]/15 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[#8B6F47]" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-[#0F0F0F] mb-2">UnfoldK Compliance Audit</h3>
              <p className="text-[13px] text-[#6B6B6B] leading-[1.7]">
                Complex Korean regulatory data translated into a 3-line English risk report.
              </p>
            </div>
            {/* Compliance Audit 목업 카드 */}
            <div className="bg-[#FDFAF6] rounded-[8px] border border-[#E8E2DA] p-4 mt-auto">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold tracking-wider text-[#8B6F47] uppercase">
                  UnfoldK Compliance Audit
                </span>
              </div>
              <ol className="flex flex-col gap-2.5">
                <li className="text-[11.5px] text-[#0F0F0F] leading-[1.6]">
                  <span className="font-semibold text-[#1A3A5C]">1. Ingredient Safety:</span>{" "}
                  Clean. No FDA-prohibited substances detected.
                </li>
                <li className="text-[11.5px] text-[#0F0F0F] leading-[1.6]">
                  <span className="font-semibold text-[#1A3A5C]">2. Labeling Compliance:</span>{" "}
                  96% match with US FDA labeling guidelines.
                </li>
                <li className="text-[11.5px] text-[#0F0F0F] leading-[1.6]">
                  <span className="font-semibold text-[#1A3A5C]">3. Import Risk:</span>{" "}
                  Low. Product cleared for North American distribution.
                </li>
              </ol>
            </div>
          </div>

          {/* 패널 3: Source with Confidence */}
          <div className="bg-white border border-[#E8E2DA] rounded-[12px] p-7 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col gap-5">
            <div className="w-10 h-10 rounded-full bg-[#1A3A5C]/[0.07] flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[#1A3A5C]" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-[#0F0F0F] mb-2">Source with Confidence</h3>
              <p className="text-[13px] text-[#6B6B6B] leading-[1.7]">
                Products matched on this platform are pre-screened for North American customs compliance. Source without inventory risk.
              </p>
            </div>
            {/* 신뢰 수치 목업 */}
            <div className="bg-[#F8F7F5] rounded-[8px] border border-[#E8E2DA] p-4 mt-auto">
              <p className="text-[10px] text-[#9A958C] tracking-widest uppercase font-semibold mb-3">
                Platform Metrics
              </p>
              <div className="flex flex-col gap-2.5">
                {[
                  { label: "FDA-screened products", value: "12,400+" },
                  { label: "Customs detention rate", value: "0.0%" },
                  { label: "Verified manufacturers", value: "520+" },
                ].map((m) => (
                  <div key={m.label} className="flex items-center justify-between">
                    <span className="text-[12px] text-[#6B6B6B]">{m.label}</span>
                    <span className="text-[12px] font-bold text-[#1A3A5C]">{m.value}</span>
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

// ─── Section 3: Benefits ──────────────────────────────────────────────────────

function BenefitsSection() {
  const benefits = [
    {
      icon: <Zap className="w-6 h-6 text-[#C8A882]" />,
      badge: "Pro",
      title: "Sourcing Sniper AI",
      desc: "Weekly K-beauty trend alerts based on fan vote data and customs indicators. Know what to stock before your competitors do.",
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-[#C8A882]" />,
      badge: null,
      title: "Zero Detention Risk",
      desc: "FDA ingredient pre-screening before you commit to inventory. Every product vetted against US customs prohibited list.",
    },
    {
      icon: <Package className="w-6 h-6 text-[#C8A882]" />,
      badge: null,
      title: "Direct Supplier Match",
      desc: "Connect directly with verified Korean manufacturers. No middlemen. Compliance report included with every match.",
    },
  ]

  return (
    <section className="bg-white py-20 px-6">
      <div className="max-w-[960px] mx-auto">
        <h2
          className="text-center text-[#0F0F0F] font-bold mb-12"
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize: "clamp(24px, 3vw, 36px)",
          }}
        >
          What You Get as a Seller
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
                  <span className="text-[10px] font-semibold tracking-wider px-2.5 py-1 rounded-full bg-[#1A3A5C] text-white">
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

// ─── Section 4: How to Get Access ────────────────────────────────────────────

function HowToAccessSection() {
  const steps = [
    {
      number: "01",
      title: "Register",
      sub: "Submit your seller info",
      desc: "Amazon · Shopify · TikTok Shop. Business verification required.",
    },
    {
      number: "02",
      title: "Browse & Snipe",
      sub: "Filter verified suppliers by category, certification, trend score",
      desc: "Access the full database of FDA & MFDS-verified Korean manufacturers with Sourcing Sniper rankings.",
    },
    {
      number: "03",
      title: "Source & Sell",
      sub: "Request samples. Compliance report included.",
      desc: "Contact info released after approval. Every sample request includes a full UnfoldK Compliance Audit.",
    },
  ]

  return (
    <section className="bg-[#F8F7F5] py-20 px-6">
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

        <div className="flex flex-col">
          {steps.map((s, i) => (
            <div key={s.number} className="flex gap-6">
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
    <section className="bg-[#1A3A5C] py-24 px-6 text-center relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 60% at 50% 100%, rgba(200,168,130,0.12) 0%, transparent 70%)",
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
          Ready to Source K-Beauty
          <br />
          Without the Risk?
        </h2>
        <p className="text-white/55 text-base mb-10">
          Join sellers already sourcing compliant K-beauty from Korea.
        </p>
        <Link
          href="/kbeauty/seller/register"
          className="bg-[#C8A882] text-[#0F0F0F] font-bold px-10 py-3.5 rounded-[8px] hover:bg-[#b8956e] transition-colors inline-flex items-center gap-2 text-[15px]"
        >
          Get Seller Access →
        </Link>
        <p className="mt-5 text-sm text-white/40">
          Already have an account?{" "}
          <Link href="/kbeauty/seller/login" className="text-white/65 hover:text-white underline transition-colors">
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

export default function SellerLandingPage() {
  return (
    <div
      className="min-h-screen bg-white"
      style={{
        fontFamily:
          '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      }}
    >
      <BeautyNavbar variant="dark" activeLink="seller" loginHref="/kbeauty/seller/login" ctaHref="/kbeauty/seller/register" ctaLabel="Get Seller Access" ctaStyle="gold" />
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
