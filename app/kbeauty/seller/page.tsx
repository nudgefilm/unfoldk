"use client"

import Link from "next/link"
import { Menu, Instagram, Linkedin } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

// Transparent Navbar Component (floats over navy hero)
function TransparentNavbar() {
  return (
    <header className="absolute top-0 left-0 right-0 z-50 h-16">
      <div className="max-w-[1280px] mx-auto h-full px-6 flex items-center justify-between">
        {/* Left: Logo */}
        <Link href="/kbeauty" className="flex items-center gap-1">
          <span className="font-bold text-white">UnfoldK Beauty</span>
          <span className="text-[#C8A882]">&#9670;</span>
        </Link>

        {/* Center: Nav Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-8">
          <Link href="/kbeauty/supplier" className="text-sm text-white/70 hover:text-white transition-colors">
            For Suppliers
          </Link>
          <Link href="/kbeauty/buyer" className="text-sm text-white/70 hover:text-white transition-colors">
            For Buyers
          </Link>
          <Link href="/kbeauty/seller" className="text-sm text-white/70 hover:text-white transition-colors">
            For Sellers
          </Link>
          <a href="/kbeauty#how-it-works" className="text-sm text-white/70 hover:text-white transition-colors">
            How It Works
          </a>
          <a href="/kbeauty#data-sources" className="text-sm text-white/70 hover:text-white transition-colors">
            Data Sources
          </a>
        </nav>

        {/* Right: Buttons (Desktop) */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/kbeauty/seller/login" className="text-sm text-white hover:text-white/80 transition-colors px-4 py-2">
            Log in
          </Link>
          <Link
            href="/kbeauty/seller/register"
            className="bg-[#C8A882] text-[#0F0F0F] text-sm font-semibold px-5 py-2.5 rounded-md hover:bg-[#b8956e] transition-colors"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile Hamburger */}
        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <button className="p-2 text-white">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="bg-[#1A3A5C] border-t border-white/10">
            <nav className="flex flex-col gap-4 mt-6">
              <Link href="/kbeauty/supplier" className="text-white py-2">
                For Suppliers
              </Link>
              <Link href="/kbeauty/buyer" className="text-white py-2">
                For Buyers
              </Link>
              <Link href="/kbeauty/seller" className="text-white py-2">
                For Sellers
              </Link>
              <a href="/kbeauty#how-it-works" className="text-white py-2">
                How It Works
              </a>
              <a href="/kbeauty#data-sources" className="text-white py-2">
                Data Sources
              </a>
              <div className="border-t border-white/10 my-2" />
              <Link href="/kbeauty/seller/login" className="text-white py-2 text-left">
                Log in
              </Link>
              <Link
                href="/kbeauty/seller/register"
                className="bg-[#C8A882] text-[#0F0F0F] font-semibold px-5 py-3 rounded-md w-full mt-2 text-center block"
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

// Hero Section
function HeroSection() {
  return (
    <section className="bg-[#1A3A5C] min-h-[80vh] flex items-center justify-center px-6 pt-[120px] pb-20">
      <div className="max-w-[640px] text-center">
        {/* Label */}
        <span className="text-xs tracking-[0.15em] text-[#C8A882] font-medium mb-6 block">
          SELLER ACCESS
        </span>

        {/* Headline */}
        <h1 className="font-serif text-4xl md:text-[52px] text-white leading-[1.1] mb-6">
          Source Trending K-Beauty
          <br />
          Products.
        </h1>

        {/* Sub */}
        <p className="text-base text-white/65 mb-10">
          Sourcing Sniper powered. FDA-verified. Data-backed.
        </p>

        {/* CTA */}
        <Link
          href="/kbeauty/seller/register"
          className="bg-[#C8A882] text-[#0F0F0F] font-semibold px-9 py-3.5 rounded-lg hover:bg-[#b8956e] transition-colors inline-flex items-center justify-center gap-2"
        >
          Get Seller Access
          <span className="text-lg">&#8594;</span>
        </Link>

        {/* Trust Line */}
        <p className="text-xs text-white/45 mt-4">
          Business accounts only &middot; Amazon &middot; Shopify &middot; TikTok Shop
        </p>
      </div>
    </section>
  )
}

// Stats Section
function DataStatsSection() {
  return (
    <section className="bg-white py-20 px-6">
      <div className="max-w-[960px] mx-auto">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-[#F8F7F5] rounded-xl p-8 text-center">
            <div className="font-serif text-5xl text-[#C8A882] mb-2">2,000+</div>
            <div className="text-[13px] font-medium text-[#6B6B6B] mb-1">
              Verified US Importers
            </div>
            <div className="text-xs text-[#6B6B6B]">
              Global customs &amp; shipping records
            </div>
          </div>

          <div className="bg-[#F8F7F5] rounded-xl p-8 text-center">
            <div className="font-serif text-5xl text-[#C8A882] mb-2">500+</div>
            <div className="text-[13px] font-medium text-[#6B6B6B] mb-1">
              FDA-Registered Suppliers
            </div>
            <div className="text-xs text-[#6B6B6B]">
              MoCRA-compliant manufacturers
            </div>
          </div>

          <div className="bg-[#F8F7F5] rounded-xl p-8 text-center">
            <div className="font-serif text-5xl text-[#C8A882] mb-2">TOP 10</div>
            <div className="text-[13px] font-medium text-[#6B6B6B] mb-1">
              Weekly Rising Items
            </div>
            <div className="text-xs text-[#6B6B6B]">
              Sourcing Sniper powered
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// Benefits Section
function SellerBenefitsSection() {
  const benefits = [
    {
      badge: "Sniper",
      badgeStyle: "bg-[#C8A882]/15 text-[#8B6F47]",
      title: "Sourcing Sniper",
      desc: "Weekly K-beauty trend alerts based on US customs data and Hallyu indicators.",
    },
    {
      badge: "Verified",
      badgeStyle: "bg-[#1A3A5C]/10 text-[#1A3A5C]",
      title: "Verified Suppliers",
      desc: "FDA-registered Korean manufacturers verified through Global customs &amp; shipping records.",
    },
    {
      badge: "Direct",
      badgeStyle: "bg-[#1A3A5C]/10 text-[#1A3A5C]",
      title: "Direct Match",
      desc: "Connect directly with suppliers after verification. No middlemen.",
    },
  ]

  return (
    <section className="bg-[#F8F7F5] py-20 px-6">
      <div className="max-w-[960px] mx-auto">
        <h2 className="text-[28px] font-bold text-[#0F0F0F] text-center mb-12">
          What You Get as a Seller
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="bg-white border border-[#E8E2DA] rounded-xl p-8 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
            >
              <span className={`inline-block text-xs font-medium px-3 py-1.5 rounded-full mb-4 ${benefit.badgeStyle}`}>
                {benefit.badge}
              </span>
              <h3 className="text-lg font-bold text-[#0F0F0F] mb-2">
                {benefit.title}
              </h3>
              <p className="text-sm text-[#6B6B6B] leading-relaxed">
                {benefit.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// How to Get Access Section
function HowToGetAccessSection() {
  const steps = [
    {
      number: "1",
      title: "Register",
      sub: "Submit your seller info",
      desc: "Amazon · Shopify · TikTok Shop",
    },
    {
      number: "2",
      title: "Get Matched",
      sub: "Browse verified Korean suppliers",
      desc: "Filter by category · MOQ",
    },
    {
      number: "3",
      title: "Source & Sell",
      sub: "Request samples and matches",
      desc: "Contact info released after approval",
    },
  ]

  return (
    <section className="bg-white py-20 px-6">
      <div className="max-w-[720px] mx-auto">
        <h2 className="text-[28px] font-bold text-[#0F0F0F] text-center mb-14">
          How to Get Access
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.number} className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#F8F7F5] border-[1.5px] border-[#1A3A5C] flex items-center justify-center mx-auto mb-5">
                <span className="text-[#1A3A5C] font-bold text-lg">{step.number}</span>
              </div>
              <h4 className="text-base font-bold text-[#0F0F0F] mb-2">{step.title}</h4>
              <p className="text-[13px] text-[#6B6B6B] mb-1">{step.sub}</p>
              <p className="text-xs text-[#6B6B6B]">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Final CTA Section
function FinalCTASection() {
  return (
    <section className="bg-[#1A3A5C] py-24 px-6 text-center">
      <div className="max-w-[640px] mx-auto">
        <h2 className="font-serif text-4xl md:text-[44px] text-white mb-4">
          Ready to Source K-Beauty?
        </h2>
        <p className="text-base text-white/65 mb-10">
          Join sellers already sourcing from Korea.
        </p>
        <Link
          href="/kbeauty/seller/register"
          className="bg-[#C8A882] text-[#0F0F0F] font-semibold px-10 py-3.5 rounded-lg hover:bg-[#b8956e] transition-colors inline-flex items-center justify-center gap-2"
        >
          Get Seller Access
          <span className="text-lg">&#8594;</span>
        </Link>
      </div>
    </section>
  )
}

// Footer Section
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
            <p className="text-[13px] text-white/40">
              Your gateway to verified K-Beauty trade.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-sm text-white/60 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-sm text-white/60 hover:text-white transition-colors">
              Terms of Service
            </Link>
            <a href="mailto:contact@unfoldk.com" className="text-sm text-white/60 hover:text-white transition-colors">
              Contact
            </a>
          </div>
        </div>

        <div className="border-t border-white/10 my-6" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-xs text-white/30">
            &copy; 2026 UnfoldK Beauty by Unfold Lab.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-white/40 hover:text-white transition-colors">
              <Instagram className="w-5 h-5" />
              <span className="sr-only">Instagram</span>
            </a>
            <a href="#" className="text-white/40 hover:text-white transition-colors">
              <Linkedin className="w-5 h-5" />
              <span className="sr-only">LinkedIn</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

// Main Page Component
export default function SellerLandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <TransparentNavbar />
      <main>
        <HeroSection />
        <DataStatsSection />
        <SellerBenefitsSection />
        <HowToGetAccessSection />
        <FinalCTASection />
      </main>
      <FooterSection />
    </div>
  )
}
