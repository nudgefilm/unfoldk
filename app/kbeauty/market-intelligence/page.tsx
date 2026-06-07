"use client"

import { useState, useEffect, type ElementType } from "react"
import Link from "next/link"
import { ChevronUp, Lock, Zap, TrendingUp, Crosshair, Instagram, Linkedin } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { BeautyNavbar } from "@/components/kbeauty/BeautyNavbar"
import { AdBanner } from "@/components/kbeauty/AdBanner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface IngredientCard {
  rank: number
  name: string
  nameKo: string
  velocityScore: string
  velocityRaw: number
  insight: string
}

// ─── Fallback 데이터 (beauty_trade_analytics 미수집 시) ───────────────────────

const FALLBACK_TOP2: IngredientCard[] = [
  {
    rank: 1,
    name: "Rice Extract",
    nameKo: "쌀 추출물",
    velocityScore: "+54%",
    velocityRaw: 54,
    insight:
      "Accelerating in cleanser/toner categories driven by slow-aging demand in North American markets.",
  },
  {
    rank: 2,
    name: "Snail Mucin",
    nameKo: "달팽이 점액",
    velocityScore: "+32%",
    velocityRaw: 32,
    insight:
      "Rising demand for moisture cream/essence targeting sensitive skin in European markets.",
  },
]

// ─── ScrollTopButton ──────────────────────────────────────────────────────────

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
            <Link href="/privacy" className="text-sm text-white/60 hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-sm text-white/60 hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/kbeauty/refund" className="text-sm text-white/60 hover:text-white transition-colors">Refund Policy</Link>
            <a href="mailto:contact@unfoldk.com" className="text-sm text-white/60 hover:text-white transition-colors">Contact</a>
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

// ─── Ingredient Card (Rank 1·2) ───────────────────────────────────────────────

function IngredientCardActive({ card }: { card: IngredientCard }) {
  return (
    <div className="bg-white border border-[#E8E2DA] rounded-2xl p-7 shadow-[0_2px_12px_rgba(0,0,0,0.06)] flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-[0.18em] text-[#6B6B6B] uppercase">
          Rank {card.rank}
        </span>
        <span className="text-[11px] font-bold text-[#C8A882] bg-[#C8A882]/10 px-2.5 py-1 rounded-full">
          {card.velocityScore} Velocity
        </span>
      </div>

      <div>
        <h3 className="text-[22px] font-bold text-[#0F0F0F] leading-tight">{card.name}</h3>
        <p className="text-sm text-[#6B6B6B] mt-0.5">{card.nameKo}</p>
      </div>

      {/* Velocity bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-[#6B6B6B]">
          <span>Hallyu Velocity Score</span>
          <span className="font-semibold text-[#C8A882]">{card.velocityRaw}/100</span>
        </div>
        <div className="h-1.5 w-full bg-[#F3F4F6] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(card.velocityRaw, 100)}%`, background: "#C8A882" }}
          />
        </div>
      </div>

      <p className="text-sm text-[#4B4B4B] leading-relaxed border-l-2 border-[#C8A882]/40 pl-3">
        {card.insight}
      </p>

      <Link
        href="/kbeauty/dashboard/buyer/suppliers"
        className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-[#1A3A5C] hover:text-[#C8A882] transition-colors"
      >
        View Verified Suppliers <span>&#8594;</span>
      </Link>
    </div>
  )
}

// ─── Locked Section (Rank 3~10) ───────────────────────────────────────────────

function LockedSection() {
  return (
    <div className="relative bg-[#1A3A5C] rounded-2xl overflow-hidden flex flex-col items-center justify-center p-8 min-h-[340px]">
      {/* 블러 배경 힌트 */}
      <div className="absolute inset-0 opacity-10 blur-sm pointer-events-none select-none">
        {["Centella Asiatica", "Niacinamide", "Bakuchiol", "Mugwort Extract", "Heartleaf"].map((name, i) => (
          <div key={i} className="py-3 px-4 border-b border-white/10 text-white text-sm font-medium">
            Rank {i + 3} &nbsp; {name}
          </div>
        ))}
      </div>

      {/* 잠금 오버레이 */}
      <div className="relative z-10 flex flex-col items-center text-center gap-5">
        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
          <Lock className="w-6 h-6 text-[#C8A882]" />
        </div>

        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-[#C8A882]/70 uppercase mb-2">
            Ranks 3 – 10 Locked
          </p>
          <h3 className="text-[18px] font-bold text-white leading-snug max-w-[260px]">
            Unlock Top 10 Hidden Ingredients &amp; Supplier Matches
          </h3>
        </div>

        <Link
          href="/kbeauty/sourcing-sniper"
          className="bg-[#C8A882] text-[#0F0F0F] text-sm font-bold px-6 py-3 rounded-[8px] hover:bg-[#b8956e] transition-colors flex items-center gap-2"
        >
          Upgrade to Sourcing Sniper Pro &#8594;
        </Link>
      </div>
    </div>
  )
}

// ─── Process Step ─────────────────────────────────────────────────────────────

function ProcessStep({
  number,
  icon: Icon,
  title,
  description,
  badge,
  formula,
  isLast,
}: {
  number: string
  icon: ElementType
  title: string
  description: string
  badge: string
  formula?: string
  isLast?: boolean
}) {
  return (
    <div className="flex gap-6">
      {/* 타임라인 선 */}
      <div className="flex flex-col items-center gap-0">
        <div className="w-10 h-10 rounded-full bg-[#1A3A5C] flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-white" />
        </div>
        {!isLast && <div className="w-px flex-1 bg-[#E8E2DA] mt-2" />}
      </div>

      {/* 컨텐츠 */}
      <div className={`pb-10 ${isLast ? "" : ""}`}>
        <p className="text-[10px] font-bold tracking-[0.16em] text-[#C8A882] uppercase mb-1">
          Step {number}
        </p>
        <h3 className="text-[18px] font-bold text-[#0F0F0F] mb-3">{title}</h3>
        <p className="text-[14px] text-[#4B4B4B] leading-relaxed mb-3">{description}</p>

        {formula && (
          <div className="bg-[#F8F7F5] border border-[#E8E2DA] rounded-lg px-4 py-3 font-mono text-[12px] text-[#0F0F0F] mb-3 whitespace-pre">
            {formula}
          </div>
        )}

        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#1A3A5C] bg-[#1A3A5C]/8 px-3 py-1.5 rounded-full border border-[#1A3A5C]/15">
          {badge}
        </span>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MarketIntelligencePage() {
  const supabase = createSupabaseBrowserClient()
  const [top2, setTop2] = useState<IngredientCard[]>(FALLBACK_TOP2)

  useEffect(() => {
    async function fetchData() {
      try {
        const { data, error } = await supabase
          .from("beauty_trade_analytics")
          .select("ingredient_name, ingredient_name_ko, hallyu_velocity_score, market_insight")
          .order("hallyu_velocity_score", { ascending: false })
          .limit(2)

        if (!error && data && data.length > 0) {
          setTop2(
            data.map((row, i) => ({
              rank: i + 1,
              name: row.ingredient_name ?? FALLBACK_TOP2[i]?.name,
              nameKo: row.ingredient_name_ko ?? FALLBACK_TOP2[i]?.nameKo,
              velocityScore: `+${row.hallyu_velocity_score}%`,
              velocityRaw: row.hallyu_velocity_score ?? FALLBACK_TOP2[i]?.velocityRaw,
              insight: row.market_insight ?? FALLBACK_TOP2[i]?.insight,
            }))
          )
        }
      } catch {
        // 테이블 미수집 시 fallback 유지
      }
    }
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-[#F8F7F5] font-sans">
      <BeautyNavbar activeLink="market-intelligence" />

      <main>
        {/* ── Section 1: Sourcing Sniper Weekly Top 3 ─────────────────────── */}
        <section className="bg-white py-20 px-6">
          <div className="max-w-[1120px] mx-auto">
            {/* 헤더 */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-[#C8A882]/10 border border-[#C8A882]/30 rounded-full px-4 py-1.5 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C8A882] animate-pulse" />
                <span className="text-[11px] font-bold tracking-[0.14em] text-[#8B6F47] uppercase">
                  LIVE · Updated Weekly
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-[#0F0F0F] mb-3">
                K-Beauty Sourcing Sniper
              </h1>
              <p className="text-[15px] text-[#6B6B6B] max-w-[560px] mx-auto leading-relaxed">
                Weekly rising ingredients ranked by Hallyu Velocity Score — powered by real-time fan
                vote data and global trade shipping statistics.
              </p>
            </div>

            {/* 카드 그리드 */}
            <div className="grid md:grid-cols-3 gap-6 items-stretch">
              {top2.map((card) => (
                <IngredientCardActive key={card.rank} card={card} />
              ))}
              <LockedSection />
            </div>
          </div>
        </section>

        {/* ── Section 2: Ad Banner ─────────────────────────────────────────── */}
        <section className="bg-[#F8F7F5] py-10 px-6">
          <div className="max-w-[1120px] mx-auto">
            <AdBanner slotId="sourcing_sniper" />
          </div>
        </section>

        {/* ── Section 3: Platform Sourcing Process ────────────────────────── */}
        <section className="bg-white py-20 px-6">
          <div className="max-w-[760px] mx-auto">
            {/* 헤더 */}
            <div className="text-center mb-14">
              <h2 className="text-2xl md:text-[28px] font-bold text-[#0F0F0F] mb-3">
                How UnfoldK Connects Trends to Trade
              </h2>
              <p className="text-[14px] text-[#6B6B6B] leading-relaxed">
                A fully automated pipeline from fan signals to verified supplier matches.
              </p>
            </div>

            {/* 타임라인 */}
            <div>
              <ProcessStep
                number="01"
                icon={Zap}
                title="Real-Time Fan Vote Logging"
                description="When B2C users vote on trending ingredients via Trend Radar, each vote is logged in real-time to the beauty_fan_votes table. Limited to once per day per user to ensure data integrity."
                badge="beauty_fan_votes · 1 vote/user/day"
              />
              <ProcessStep
                number="02"
                icon={TrendingUp}
                title="Weekly Velocity Score Engine"
                description="Every Monday, a scheduled cron job analyzes the past 7 days of vote trends and calculates the Hallyu Velocity Score for each ingredient — measuring week-over-week acceleration."
                formula={`Velocity Score = (This Week − Last Week) / Last Week × 100\nZero-division safe: if Last Week = 0 → Score = This Week × 100`}
                badge="hallyu_velocity_score · Weekly Cron"
              />
              <ProcessStep
                number="03"
                icon={Crosshair}
                title="Verified Supplier Pipeline Activation"
                description="Top-ranked ingredients are matched against registered Korean suppliers carrying those active ingredients. Verified supplier links are activated directly in buyer and seller dashboards."
                badge="beauty_suppliers · beauty_products · Direct Match"
                isLast
              />
            </div>

            {/* 하단 CTA */}
            <div className="mt-12 bg-[#F8F7F5] rounded-2xl border border-[#E8E2DA] p-8 text-center">
              <h3 className="text-[20px] font-bold text-[#0F0F0F] mb-6">
                Ready to Source the Next Rising Ingredient?
              </h3>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/kbeauty/sourcing-sniper"
                  className="bg-[#C8A882] text-[#0F0F0F] font-semibold px-6 py-3 rounded-[8px] hover:bg-[#b8956e] transition-colors text-sm flex items-center gap-2"
                >
                  Explore Sourcing Sniper &#8594;
                </Link>
                <Link
                  href="/kbeauty/supplier"
                  className="border-[1.5px] border-[#1A3A5C] text-[#1A3A5C] font-semibold px-6 py-3 rounded-[8px] hover:bg-[#1A3A5C]/5 transition-colors text-sm"
                >
                  Join as a Supplier &#8594;
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <FooterSection />
      <ScrollTopButton />
    </div>
  )
}
