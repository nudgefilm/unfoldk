"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Menu,
  ChevronUp,
  ShieldCheck,
  FileCheck2,
  Globe2,
  Ship,
  Users,
  ShoppingBag,
  Store,
  TrendingUp,
  AlertTriangle,
  Award,
  BarChart2,
  Zap,
  Instagram,
  Linkedin,
} from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { AdBanner } from "@/components/kbeauty/AdBanner"

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
          <Link href="/kbeauty/buyer" className="text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors">
            For Buyers
          </Link>
          <Link href="/kbeauty/seller" className="text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors">
            For Sellers
          </Link>
          <Link href="/kbeauty/data-sources" className="text-sm font-semibold text-[#0F0F0F] transition-colors">
            Data Sources
          </Link>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/kbeauty/login" className="text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors px-4 py-2">
            Log in
          </Link>
          <Link
            href="/kbeauty/auth"
            className="bg-[#1A3A5C] text-white text-sm font-semibold px-5 py-2.5 rounded-[8px] hover:bg-[#153249] transition-colors"
          >
            Get Started
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
              <Link href="/kbeauty/buyer" className="text-[#6B6B6B] hover:text-[#0F0F0F] py-2">For Buyers</Link>
              <Link href="/kbeauty/seller" className="text-[#6B6B6B] hover:text-[#0F0F0F] py-2">For Sellers</Link>
              <Link href="/kbeauty/data-sources" className="font-semibold text-[#0F0F0F] py-2">Data Sources</Link>
              <div className="border-t border-[#E8E2DA] my-2" />
              <Link href="/kbeauty/login" className="text-[#6B6B6B] hover:text-[#0F0F0F] py-2">Log in</Link>
              <Link
                href="/kbeauty/auth"
                className="bg-[#1A3A5C] text-white font-semibold px-5 py-3 rounded-[8px] w-full mt-2 text-center block"
              >
                Get Started
              </Link>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="px-6 pt-20 pb-16" style={{ background: "linear-gradient(160deg, #F8F7F5 0%, #F0EBE3 100%)" }}>
      <div className="max-w-[720px] mx-auto text-center">
        <span className="inline-flex items-center gap-2 text-xs tracking-[0.15em] text-[#8B6F47] font-semibold uppercase mb-6 bg-[#C8A882]/15 px-4 py-1.5 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-[#C8A882]" />
          Data Sources
        </span>
        <h1
          className="font-bold leading-[1.08] mb-5 text-balance text-[#0F0F0F]"
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize: "clamp(34px, 5vw, 54px)",
          }}
        >
          Where Our Data Comes From
        </h1>
        <p className="text-base md:text-lg text-[#6B6B6B] leading-relaxed max-w-[560px] mx-auto">
          Every supplier, buyer, and seller on UnfoldK Beauty is verified through official government and trade data sources.
        </p>
      </div>
    </section>
  )
}

// ─── Card Component ───────────────────────────────────────────────────────────

interface DataCardProps {
  icon: React.ReactNode
  title: string
  description: string
  badge: string
  badgeVariant?: "government" | "trade" | "marketplace" | "compliance" | "proprietary"
}

function DataCard({ icon, title, description, badge, badgeVariant = "government" }: DataCardProps) {
  const badgeColors: Record<string, string> = {
    government: "bg-[#1A3A5C]/8 text-[#1A3A5C]",
    trade:      "bg-[#C8A882]/15 text-[#8B6F47]",
    marketplace: "bg-[#F0EBE3] text-[#6B4C2A]",
    compliance: "bg-red-50 text-red-700",
    proprietary: "bg-[#1A3A5C]/8 text-[#1A3A5C]",
  }
  return (
    <div className="bg-white border border-[#E8E2DA] rounded-2xl p-6 flex flex-col gap-4 hover:shadow-md transition-shadow">
      <div className="w-11 h-11 rounded-xl bg-[#F8F7F5] flex items-center justify-center text-[#1A3A5C]">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-[#0F0F0F] mb-1">{title}</p>
        <p className="text-sm text-[#6B6B6B] leading-relaxed">{description}</p>
      </div>
      <span className={`self-start text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full ${badgeColors[badgeVariant]}`}>
        {badge}
      </span>
    </div>
  )
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function SectionBlock({
  title,
  children,
  alt,
}: {
  title: string
  children: React.ReactNode
  alt?: boolean
}) {
  return (
    <section className={`px-6 py-16 ${alt ? "bg-[#F8F7F5]" : "bg-white"}`}>
      <div className="max-w-[1100px] mx-auto">
        <h2
          className="text-2xl md:text-3xl font-bold text-[#0F0F0F] mb-10"
          style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
        >
          {title}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {children}
        </div>
      </div>
    </section>
  )
}

// ─── Section 1: Supplier Data ─────────────────────────────────────────────────

function SupplierDataSection() {
  return (
    <SectionBlock title="Supplier Data">
      <DataCard
        icon={<ShieldCheck className="w-5 h-5" />}
        title="MFDS (Ministry of Food and Drug Safety)"
        description="Korean cosmetic manufacturer registry. Business registration and administrative sanction history verified in real-time via open API."
        badge="Official Government API"
        badgeVariant="government"
      />
      <DataCard
        icon={<FileCheck2 className="w-5 h-5" />}
        title="National Tax Service (NTS)"
        description="Korean business registration number verification. Automatic validation at supplier onboarding."
        badge="Official Government API"
        badgeVariant="government"
      />
      <DataCard
        icon={<Globe2 className="w-5 h-5" />}
        title="FDA MoCRA Database"
        description="US FDA Modernization of Cosmetics Regulation Act facility registration. Cross-referenced against supplier profiles."
        badge="US Federal Database"
        badgeVariant="government"
      />
    </SectionBlock>
  )
}

// ─── Section 2: Buyer Data ────────────────────────────────────────────────────

function BuyerDataSection() {
  return (
    <SectionBlock title="Buyer Data" alt>
      <DataCard
        icon={<Ship className="w-5 h-5" />}
        title="Global Customs & Shipping Records"
        description="Import history tracked via global trade and shipping data. HS codes 3304, 3305, 3307 — Skincare, Haircare, Fragrance."
        badge="Trade Intelligence"
        badgeVariant="trade"
      />
      <DataCard
        icon={<Users className="w-5 h-5" />}
        title="B2B Contact Verification"
        description="Verified business contact points sourced through GDPR and CCPA compliant global B2B data pipelines."
        badge="Contact Verification"
        badgeVariant="trade"
      />
    </SectionBlock>
  )
}

// ─── Section 3: Seller Data ───────────────────────────────────────────────────

function SellerDataSection() {
  return (
    <SectionBlock title="Seller Data">
      <DataCard
        icon={<ShoppingBag className="w-5 h-5" />}
        title="Amazon Marketplace Data"
        description="K-beauty category seller mapping via marketplace data. Seller name, storefront URL, and product categories tracked."
        badge="Marketplace Intelligence"
        badgeVariant="marketplace"
      />
      <DataCard
        icon={<Store className="w-5 h-5" />}
        title="Shopify Store Intelligence"
        description="Independent Shopify stores selling Korean beauty products. Identified via technology and category signals."
        badge="Store Intelligence"
        badgeVariant="marketplace"
      />
      <DataCard
        icon={<TrendingUp className="w-5 h-5" />}
        title="TikTok Shop Analytics"
        description="TikTok Shop K-beauty category performance tracked by GMV and sales volume. Seller intelligence sourced via globally compliant B2B directory integration."
        badge="Social Commerce"
        badgeVariant="marketplace"
      />
    </SectionBlock>
  )
}

// ─── Section 4: Compliance & Ingredient Data ─────────────────────────────────

function ComplianceDataSection() {
  return (
    <SectionBlock title="Compliance & Ingredient Data" alt>
      <DataCard
        icon={<AlertTriangle className="w-5 h-5" />}
        title="FDA Prohibited Ingredients Database"
        description="17 prohibited and 26 restricted ingredients per 21 CFR regulations. All supplier products pre-screened before buyer matching."
        badge="FDA 21 CFR"
        badgeVariant="compliance"
      />
      <DataCard
        icon={<Award className="w-5 h-5" />}
        title="ISO 22716 / CGMP Certification"
        description="Good Manufacturing Practice certification status verified per supplier profile."
        badge="International Standard"
        badgeVariant="compliance"
      />
      <DataCard
        icon={<Globe2 className="w-5 h-5" />}
        title="CPNP (EU Cosmetics Portal)"
        description="European cosmetic product notification portal registration status. Relevant for EU-bound exports."
        badge="EU Regulation"
        badgeVariant="compliance"
      />
    </SectionBlock>
  )
}

// ─── Section 5: Market Intelligence ──────────────────────────────────────────

function MarketIntelligenceSection() {
  return (
    <SectionBlock title="Market Intelligence">
      <DataCard
        icon={<BarChart2 className="w-5 h-5" />}
        title="UN Comtrade"
        description="Global trade statistics by HS code. Used for import volume tracking and market sizing."
        badge="UN Trade Data"
        badgeVariant="trade"
      />
      <DataCard
        icon={<Zap className="w-5 h-5" />}
        title="Hallyu Fan Vote Engine"
        description="Real-time fan voting data from UnfoldK's global K-beauty community. Weekly Hallyu Velocity Score calculated and fed into Sourcing Sniper trend analytics."
        badge="Proprietary Data"
        badgeVariant="proprietary"
      />
    </SectionBlock>
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
          <span className="text-sm text-white/40">&copy; 2026 UnfoldK Beauty by Unfold Lab.</span>
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

// ─── Back to Top ──────────────────────────────────────────────────────────────

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

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DataSourcesPage() {
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
        <SupplierDataSection />
        <BuyerDataSection />
        <div className="px-6 py-6 bg-white">
          <div className="max-w-[1100px] mx-auto">
            <AdBanner slotId="data_sources_banner" />
          </div>
        </div>
        <SellerDataSection />
        <ComplianceDataSection />
        <MarketIntelligenceSection />
      </main>
      <FooterSection />
      <ScrollTopButton />
    </div>
  )
}
