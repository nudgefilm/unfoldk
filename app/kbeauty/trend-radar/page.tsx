"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import { X, Menu, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
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
    <header className={`sticky top-0 z-50 w-full h-16 transition-all duration-200 ${scrolled ? "bg-[#0F0F0F] shadow-[0_1px_0_rgba(255,255,255,0.08)]" : "bg-[#0F0F0F]"}`}>
      <div className="max-w-[1280px] mx-auto h-full px-6 flex items-center justify-between">
        <Link href="/kbeauty" className="flex items-center gap-1">
          <span className="font-bold text-white">UnfoldK Beauty</span>
          <span className="text-[#C8A882]">&#9670;</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          <Link href="/kbeauty/supplier" className="text-sm text-white/60 hover:text-white transition-colors">
            For Suppliers
          </Link>
          <Link href="/kbeauty/buyer" className="text-sm text-white/60 hover:text-white transition-colors">
            For Buyers
          </Link>
          <Link href="/kbeauty/seller" className="text-sm text-white/60 hover:text-white transition-colors">
            For Sellers
          </Link>
          <Link href="/kbeauty/data-sources" className="text-sm text-white/60 hover:text-white transition-colors">
            Data Sources
          </Link>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/kbeauty/login" className="text-sm text-white/70 hover:text-white transition-colors px-4 py-2">
            Log in
          </Link>
          <Link
            href="/kbeauty/auth"
            className="bg-[#C8A882] text-[#0F0F0F] text-sm font-semibold px-5 py-2.5 rounded-[8px] hover:bg-[#b8956e] transition-colors"
          >
            Get Started
          </Link>
        </div>

        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <button className="p-2 text-white">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="bg-[#1A1A1A] border-t border-white/10">
            <nav className="flex flex-col gap-4 mt-6">
              <Link href="/kbeauty/supplier" className="text-white/70 py-2">For Suppliers</Link>
              <Link href="/kbeauty/buyer" className="text-white/70 py-2">For Buyers</Link>
              <Link href="/kbeauty/seller" className="text-white/70 py-2">For Sellers</Link>
              <Link href="/kbeauty/data-sources" className="text-white/70 py-2">Data Sources</Link>
              <div className="border-t border-white/10 my-2" />
              <Link href="/kbeauty/login" className="text-white/70 py-2">Log in</Link>
              <Link
                href="/kbeauty/auth"
                className="bg-[#C8A882] text-[#0F0F0F] font-semibold px-5 py-3 rounded-[8px] w-full mt-2 text-center block"
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
      style={{ background: "#C8A882" }}
      aria-label="Back to top"
    >
      <ChevronUp className="w-5 h-5 text-[#0F0F0F]" />
    </button>
  )
}

// ─── 상수 ────────────────────────────────────────────────────────────────────

const BROAD_CATEGORIES = [
  { key: "Skincare", emoji: "🧪" },
  { key: "Makeup", emoji: "💄" },
  { key: "Suncare", emoji: "☀️" },
  { key: "Haircare", emoji: "💇" },
] as const

type BroadCategory = (typeof BROAD_CATEGORIES)[number]["key"]

const ITEMS: Record<BroadCategory, string[]> = {
  Skincare: ["Rice Extract", "Snail Mucin", "Retinol Retinoate"],
  Makeup: ["Glazed Lip", "Cushion Foundation", "Jelly Blush"],
  Suncare: ["Sunscreen Serum", "UV Tone-up", "After-sun Gel"],
  Haircare: ["Scalp Serum", "Bond Repair", "Rice Water Treatment"],
}

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface VotedSet {
  [categoryName: string]: boolean
}

// ─── 앵커 배너 ───────────────────────────────────────────────────────────────

function AnchorBanner({ text, href }: { text: string; href: string }) {
  return (
    <div className="w-full bg-[#FF2D78]/10 border-b border-[#FF2D78]/20 py-2.5 px-4 text-center">
      <Link
        href={href}
        className="text-xs md:text-sm text-[#FF2D78] font-medium hover:underline transition-colors"
      >
        {text}
      </Link>
    </div>
  )
}

// ─── 로그인 모달 ─────────────────────────────────────────────────────────────

function SignInModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
    >
      <div className="relative w-full max-w-sm bg-[#1A1A1A] border border-white/10 rounded-2xl p-8 text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="text-3xl mb-4">🎯</div>
        <h2 className="text-white font-bold text-xl mb-2">Sign in to vote</h2>
        <p className="text-white/50 text-sm mb-6 leading-relaxed">
          Your vote helps global sellers decide what to stock next.
          <br />
          It&apos;s free — sign up in seconds.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="w-full py-3 rounded-lg bg-[#FF2D78] text-white font-semibold text-sm hover:bg-[#e0265f] transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="w-full py-3 rounded-lg border border-white/15 text-white/70 font-medium text-sm hover:border-white/30 hover:text-white transition-colors"
          >
            Create free account
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function TrendRadarPage() {
  const supabase = createSupabaseBrowserClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<BroadCategory>("Skincare")
  const [votedToday, setVotedToday] = useState<VotedSet>({})
  const [customInput, setCustomInput] = useState("")
  const [submitting, setSubmitting] = useState<string | null>(null) // category_name being submitted
  const [showSignInModal, setShowSignInModal] = useState(false)

  // ─ 인증 상태 로드
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
      setAuthLoaded(true)
    })
  }, [supabase])

  // ─ 오늘 이미 투표한 항목 조회
  useEffect(() => {
    if (!userId) return
    const today = new Date().toISOString().slice(0, 10)
    supabase
      .from("beauty_fan_votes")
      .select("category_name")
      .eq("user_id", userId)
      .eq("vote_date", today)
      .then(({ data }) => {
        if (!data) return
        const set: VotedSet = {}
        data.forEach((row) => { set[row.category_name] = true })
        setVotedToday(set)
      })
  }, [userId, supabase])

  // ─ 투표 INSERT
  async function castVote(categoryName: string, broadCategory: BroadCategory) {
    if (!userId) { setShowSignInModal(true); return }
    if (votedToday[categoryName]) return
    setSubmitting(categoryName)
    const { error } = await supabase.from("beauty_fan_votes").insert({
      user_id: userId,
      category_name: categoryName,
      broad_category: broadCategory,
    })
    setSubmitting(null)
    if (error) {
      // UNIQUE 위반이면 이미 투표한 것으로 처리
      if (error.code === "23505") {
        setVotedToday((prev) => ({ ...prev, [categoryName]: true }))
      } else {
        toast.error("Something went wrong. Please try again.")
      }
      return
    }
    setVotedToday((prev) => ({ ...prev, [categoryName]: true }))
    toast.success("Thank you! Your vote is sent to global sellers.")
  }

  // ─ 커스텀 인풋 INSERT
  async function submitCustom() {
    if (!userId) { setShowSignInModal(true); return }
    if (!customInput.trim()) return
    setSubmitting("custom")
    const { error } = await supabase.from("beauty_fan_votes").insert({
      user_id: userId,
      category_name: `custom:${customInput.trim().slice(0, 120)}`,
      broad_category: selectedCategory,
      custom_product_input: customInput.trim(),
    })
    setSubmitting(null)
    if (error && error.code !== "23505") {
      toast.error("Something went wrong. Please try again.")
      return
    }
    setCustomInput("")
    toast.success("Thank you! Your vote is sent to global sellers.")
  }

  const items = ITEMS[selectedCategory]

  return (
    <>
      <Toaster position="top-center" richColors />
      {showSignInModal && <SignInModal onClose={() => setShowSignInModal(false)} />}

      <div className="min-h-screen bg-[#0F0F0F] text-white font-sans">
        <Navbar />

        {/* ① 상단 앵커 배너 */}
        <AnchorBanner
          text="Are you an Amazon/Shopify Seller looking for suppliers? Inquire about B2B access →"
          href="/contact"
        />

        {/* ② 히어로 */}
        <section className="pt-16 pb-12 px-6 text-center max-w-[720px] mx-auto">
          <span className="inline-flex items-center gap-2 text-xs tracking-[0.14em] font-semibold text-[#FF2D78] uppercase mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF2D78] animate-pulse" />
            K-Beauty Sniper
          </span>
          <h1 className="text-4xl md:text-[52px] font-bold leading-[1.1] mb-5 text-balance">
            🎯 K-Beauty Sniper:{" "}
            <span className="text-[#FF2D78]">Global Fan Vote</span>
          </h1>
          <p className="text-base md:text-lg text-white/60 leading-relaxed max-w-lg mx-auto">
            What&apos;s your current holy grail? Vote &amp; Tell global sellers what to stock next!
          </p>
        </section>

        {/* ③ Step 1 — 카테고리 칩 */}
        <section className="px-6 mb-10">
          <div className="max-w-[720px] mx-auto">
            <p className="text-xs uppercase tracking-[0.14em] text-white/40 font-semibold mb-4">
              Step 1 — Pick a Category
            </p>
            <div className="flex flex-wrap gap-3">
              {BROAD_CATEGORIES.map(({ key, emoji }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedCategory(key)}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 rounded-full border text-sm font-semibold transition-all",
                    selectedCategory === key
                      ? "bg-[#FF2D78] border-[#FF2D78] text-white shadow-[0_0_16px_rgba(255,45,120,0.4)]"
                      : "bg-white/5 border-white/10 text-white/70 hover:border-white/25 hover:text-white"
                  )}
                >
                  <span>{emoji}</span>
                  {key}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ④ Step 2 — 투표 카드 */}
        <section className="px-6 mb-12">
          <div className="max-w-[720px] mx-auto">
            <p className="text-xs uppercase tracking-[0.14em] text-white/40 font-semibold mb-4">
              Step 2 — Vote for Your Holy Grail
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {items.map((item) => {
                const voted = !!votedToday[item]
                const loading = submitting === item
                return (
                  <div
                    key={item}
                    className={cn(
                      "rounded-2xl border p-6 flex flex-col gap-4 transition-all",
                      voted
                        ? "border-[#FF2D78]/40 bg-[#FF2D78]/8"
                        : "border-white/10 bg-white/4 hover:border-white/20"
                    )}
                  >
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1.5">
                        {selectedCategory}
                      </p>
                      <p className="text-base font-bold text-white leading-snug">{item}</p>
                    </div>
                    <button
                      type="button"
                      disabled={voted || loading || !authLoaded}
                      onClick={() => castVote(item, selectedCategory)}
                      className={cn(
                        "w-full py-2.5 rounded-xl text-sm font-semibold transition-all",
                        voted
                          ? "bg-[#FF2D78]/15 text-[#FF2D78] cursor-default"
                          : loading
                          ? "bg-white/10 text-white/40 cursor-wait"
                          : "bg-[#FF2D78] text-white hover:bg-[#e0265f] shadow-[0_0_12px_rgba(255,45,120,0.3)] hover:shadow-[0_0_20px_rgba(255,45,120,0.5)]"
                      )}
                    >
                      {voted ? "Voted today ✓" : loading ? "Voting…" : "Vote Now"}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ⑤ Step 3 — 커스텀 입력 */}
        <section className="px-6 mb-16">
          <div className="max-w-[720px] mx-auto">
            <p className="text-xs uppercase tracking-[0.14em] text-white/40 font-semibold mb-4">
              Step 3 — Optional
            </p>
            <div className="rounded-2xl border border-white/10 bg-white/4 p-6">
              <p className="text-sm font-semibold text-white mb-4">
                Any specific Korean brand you want right now?
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitCustom() }}
                  placeholder="e.g. Laneige, COSRX, Anua..."
                  maxLength={120}
                  className="flex-1 bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FF2D78]/50 transition-colors"
                />
                <button
                  type="button"
                  disabled={!customInput.trim() || submitting === "custom"}
                  onClick={submitCustom}
                  className={cn(
                    "px-6 py-3 rounded-xl text-sm font-semibold transition-all shrink-0",
                    !customInput.trim() || submitting === "custom"
                      ? "bg-white/8 text-white/30 cursor-not-allowed"
                      : "bg-[#FF2D78] text-white hover:bg-[#e0265f] shadow-[0_0_12px_rgba(255,45,120,0.3)]"
                  )}
                >
                  {submitting === "custom" ? "Sending…" : "Submit"}
                </button>
              </div>
              <p className="text-xs text-white/25 mt-3">
                Your input goes directly to K-beauty sellers as sourcing signals.
              </p>
            </div>
          </div>
        </section>

        {/* ⑧ 하단 앵커 배너 */}
        <AnchorBanner
          text="Interested in sourcing these trending ingredients? Contact us for B2B access →"
          href="/contact"
        />

      </div>
      <ScrollTopButton />
    </>
  )
}
