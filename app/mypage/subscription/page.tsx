"use client"

// /mypage/subscription — 구독 관리
//
// 분기:
//   - plan_type = 'free'             → "You're on the Free plan" + 업그레이드 버튼 2종
//   - plan_type = 'monthly'|'annual' → Active 플랜 + Billing History 패널 (v0 mock 유지)
//
// 사이드바 프로필도 기존 mock("Mia T.") → 실제 로그인 유저 데이터로 표시.
// className·style 은 v0 디자인 그대로 유지하되 데이터만 실 데이터로 교체.

import { useEffect, useState } from "react"
import Link from "next/link"
import { Header } from "@/components/header"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import {
  Home,
  Calendar,
  Music,
  Film,
  Languages,
  UtensilsCrossed,
  CreditCard,
  Settings,
  Download,
  Check,
  PartyPopper,
  Sparkles,
} from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

const sidebarLinks = [
  { icon: Home, label: "Dashboard", href: "/mypage" },
  { icon: Calendar, label: "My Calendar", href: "/mypage/calendar" },
  { icon: Music, label: "My Artists", href: "/mypage/artists" },
  { icon: Film, label: "My Dramas", href: "/mypage/dramas" },
  { icon: Languages, label: "Learning Progress", href: "/mypage/learning" },
  { icon: UtensilsCrossed, label: "Saved Recipes", href: "/mypage/recipes" },
  { icon: PartyPopper, label: "My Fan Events", href: "/mypage/fan-events" },
  { icon: CreditCard, label: "Subscription", href: "/mypage/subscription" },
  { icon: Settings, label: "Settings", href: "/mypage/settings" },
]

// ⚠️ Billing History 는 LMS API 동기화 미구현 — v0 mock 유지 (spec: "현재처럼 표시")
const billingHistory = [
  { date: "May 7, 2026", description: "Hallyu Pass", amount: "$15.00", status: "Paid" },
  { date: "Apr 7, 2026", description: "Hallyu Pass", amount: "$15.00", status: "Paid" },
  { date: "Mar 7, 2026", description: "Hallyu Pass", amount: "$15.00", status: "Paid" },
]

type PlanType = "free" | "monthly" | "annual"

export default function SubscriptionPage() {
  const [isLoaded, setIsLoaded] = useState(false)
  const [planType, setPlanType] = useState<PlanType>("free")
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>("")
  const [userInitial, setUserInitial] = useState<string>("U")
  const [userAvatar, setUserAvatar] = useState<string | null>(null)

  // 인증 + 프로필 + plan_type 로드 — middleware 가 비로그인 가드 처리
  useEffect(() => {
    let cancelled = false
    const supabase = createSupabaseBrowserClient()

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return

      // 사이드바 프로필
      const meta = (user.user_metadata ?? {}) as { full_name?: string; avatar_url?: string }
      const fallbackName = user.email?.split("@")[0] ?? "User"
      const name = meta.full_name?.trim() || fallbackName
      setUserName(name)
      setUserInitial(name.charAt(0).toUpperCase() || "U")
      setUserAvatar(meta.avatar_url ?? null)

      // public.users 의 plan_type / plan_expires_at 조회
      const { data: profile } = await supabase
        .from("users")
        .select("plan_type, plan_expires_at")
        .eq("id", user.id)
        .single()

      if (cancelled) return

      const row = profile as { plan_type?: string; plan_expires_at?: string | null } | null
      const pt = row?.plan_type
      setPlanType(pt === "monthly" || pt === "annual" ? pt : "free")
      setPlanExpiresAt(row?.plan_expires_at ?? null)
      setIsLoaded(true)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  // 데이터 로드 전엔 본문 영역 비움 (사이드바 골격은 그대로 노출)
  const isPaid = planType === "monthly" || planType === "annual"
  const planLabel: string = isPaid ? "Hallyu Pass" : "Free"
  const monthlyPriceLabel = planType === "annual" ? "$10.00/month" : "$15.00/month"
  const annualNote = planType === "annual" ? "$120/year, billed annually" : ""
  const expiresLabel = planExpiresAt
    ? new Date(planExpiresAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0d0d0f" }}>
      <Header />

      <div className="flex-1 flex max-w-7xl mx-auto w-full px-4 md:px-6 py-8 gap-8">
        {/* Left Sidebar */}
        <aside className="hidden md:flex flex-col w-[240px] flex-shrink-0">
          {/* User Profile — 실 데이터 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt={userName}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
                  style={{ backgroundColor: "#FF4B6E" }}
                >
                  {userInitial}
                </div>
              )}
              <div>
                <p className="text-foreground font-medium">{userName || "—"}</p>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "rgba(255, 75, 110, 0.15)", color: "#FF4B6E" }}
                >
                  {planLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1">
            {sidebarLinks.map((link) => {
              const isActive = link.label === "Subscription"
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative ${
                    isActive
                      ? "bg-[#1a1a1a] text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a]/50"
                  }`}
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                      style={{ backgroundColor: "#FF4B6E" }}
                    />
                  )}
                  <link.icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{link.label}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground mb-8">Subscription</h1>

          {/* 데이터 로드 전엔 본문 영역만 비워두기 (전체 깜빡임 방지) */}
          {!isLoaded ? null : !isPaid ? (
            // ============================================
            // Free 유저 화면
            // ============================================
            <FreeUserView />
          ) : (
            // ============================================
            // 유료 유저 화면 (monthly / annual)
            // ============================================
            <>
              {/* Section 1: Current Plan */}
              <section className="mb-8">
                <h2 className="text-lg font-semibold text-foreground mb-4">Current Plan</h2>
                <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xl font-bold text-foreground">Hallyu Pass</span>
                        <span style={{ color: "#FF4B6E" }}>&#10022;</span>
                        <span
                          className="text-xs font-medium px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: "rgba(34, 197, 94, 0.15)", color: "#22c55e" }}
                        >
                          Active
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="text-muted-foreground">Plan: </span>
                          <span className="text-foreground font-medium">
                            {planType === "annual" ? "Annual" : "Monthly"} · {monthlyPriceLabel}
                          </span>
                          {annualNote && (
                            <span className="text-muted-foreground"> ({annualNote})</span>
                          )}
                        </p>
                        {expiresLabel && (
                          <p>
                            <span className="text-muted-foreground">Active until: </span>
                            <span className="text-foreground">{expiresLabel}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link href="/mypage/subscription/payment">
                      <Button
                        variant="outline"
                        className="rounded-full border-border/50 hover:bg-secondary/50"
                      >
                        Change payment method
                      </Button>
                    </Link>
                    <Link href="/mypage/subscription/cancel">
                      <Button
                        variant="outline"
                        className="rounded-full border-border/50 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50"
                      >
                        Cancel subscription
                      </Button>
                    </Link>
                  </div>
                </div>
              </section>

              {/* Section 2: Billing History (mock — LMS API 동기화 미구현) */}
              <section className="mb-8">
                <h2 className="text-lg font-semibold text-foreground mb-4">Billing History</h2>
                <div className="bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/30">
                          <th className="text-left text-muted-foreground text-sm font-medium px-6 py-4">Date</th>
                          <th className="text-left text-muted-foreground text-sm font-medium px-6 py-4">Description</th>
                          <th className="text-left text-muted-foreground text-sm font-medium px-6 py-4">Amount</th>
                          <th className="text-left text-muted-foreground text-sm font-medium px-6 py-4">Status</th>
                          <th className="text-left text-muted-foreground text-sm font-medium px-6 py-4">Receipt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billingHistory.map((item, index) => (
                          <tr
                            key={index}
                            className={index !== billingHistory.length - 1 ? "border-b border-border/30" : ""}
                          >
                            <td className="text-foreground text-sm px-6 py-4">{item.date}</td>
                            <td className="text-foreground text-sm px-6 py-4">{item.description}</td>
                            <td className="text-foreground text-sm px-6 py-4">{item.amount}</td>
                            <td className="px-6 py-4">
                              <span className="flex items-center gap-1 text-sm" style={{ color: "#22c55e" }}>
                                {item.status} <Check className="w-4 h-4" />
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <Link
                                href="/mypage/subscription/receipt"
                                className="flex items-center gap-1 text-sm hover:underline"
                                style={{ color: "#FF4B6E" }}
                              >
                                <Download className="w-4 h-4" /> Download
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* Section 3: Switch Plan */}
              <section className="mb-8">
                <h2 className="text-lg font-semibold text-foreground mb-4">Switch Plan</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Monthly Plan */}
                  <div
                    className="bg-[#1a1a1a] rounded-xl p-6 relative"
                    style={{
                      border:
                        planType === "monthly"
                          ? "2px solid #FF4B6E"
                          : "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    {planType === "monthly" && (
                      <span
                        className="absolute top-4 right-4 text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: "rgba(255, 75, 110, 0.15)", color: "#FF4B6E" }}
                      >
                        Current
                      </span>
                    )}
                    <h3 className="text-foreground font-semibold text-lg mb-2">Monthly</h3>
                    <div className="mb-1">
                      <span className="text-3xl font-bold text-foreground">$15</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    <p className="text-muted-foreground text-sm mb-4">Billed monthly. Cancel anytime.</p>
                    {planType !== "monthly" && (
                      <a href="/api/lemonsqueezy/checkout?plan=monthly">
                        <Button
                          className="w-full rounded-full font-medium text-white"
                          style={{ backgroundColor: "#FF4B6E" }}
                        >
                          Switch to Monthly
                        </Button>
                      </a>
                    )}
                  </div>

                  {/* Annual Plan */}
                  <div
                    className="bg-[#1a1a1a] rounded-xl p-6 relative"
                    style={{
                      border:
                        planType === "annual"
                          ? "2px solid #FF4B6E"
                          : "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <span
                      className="absolute top-4 right-4 text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "rgba(255, 75, 110, 0.15)", color: "#FF4B6E" }}
                    >
                      {planType === "annual" ? "Current" : "Save 33%"}
                    </span>
                    <h3 className="text-foreground font-semibold text-lg mb-2">Annual</h3>
                    <div className="mb-1">
                      <span className="text-3xl font-bold text-foreground">$10</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    <p className="text-muted-foreground text-sm mb-4">$120/year, billed annually</p>
                    {planType !== "annual" && (
                      <a href="/api/lemonsqueezy/checkout?plan=annual">
                        <Button
                          className="w-full rounded-full font-medium text-white"
                          style={{ backgroundColor: "#FF4B6E" }}
                        >
                          Switch to Annual
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </section>

              {/* Section 4: Cancel Note */}
              {expiresLabel && (
                <section className="mb-8">
                  <div className="bg-[#141416] border border-border/20 rounded-xl p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <p className="text-muted-foreground text-sm">
                        If you cancel, you&apos;ll keep access until{" "}
                        <span className="text-foreground">{expiresLabel}</span>.
                      </p>
                      <Link
                        href="/mypage/subscription/cancel"
                        className="text-sm font-medium hover:underline text-red-500"
                      >
                        Cancel subscription
                      </Link>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>

      <FooterSection />
    </div>
  )
}

// ============================================
// Free 유저 전용 화면 — Hallyu Pass 업그레이드 유도
// 페이드인 패턴은 부모와 동일, className·style 도 v0 톤 유지
// ============================================
function FreeUserView() {
  return (
    <>
      {/* Section 1: Current Plan — Free */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">Current Plan</h2>
        <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xl font-bold text-foreground">Free</span>
            <span
              className="text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ backgroundColor: "rgba(136, 136, 136, 0.15)", color: "#888888" }}
            >
              Limited
            </span>
          </div>
          <p className="text-muted-foreground text-sm mb-1">You&apos;re on the Free plan.</p>
          <p className="text-muted-foreground text-sm">
            Upgrade to <span className="text-foreground font-medium">Hallyu Pass</span> for full
            access to all 5 services.
          </p>
        </div>
      </section>

      {/* Section 2: Upgrade Plans */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">Upgrade to Hallyu Pass</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Monthly Upgrade */}
          <div className="bg-[#1a1a1a] rounded-xl p-6 relative border border-border/30">
            <h3 className="text-foreground font-semibold text-lg mb-2">Monthly</h3>
            <div className="mb-4">
              <span className="text-3xl font-bold text-foreground">$15</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <p className="text-muted-foreground text-sm mb-5">Billed monthly. Cancel anytime.</p>
            <a href="/api/lemonsqueezy/checkout?plan=monthly">
              <Button
                className="w-full rounded-full font-medium text-white"
                style={{ backgroundColor: "#FF4B6E" }}
              >
                Upgrade to Monthly — $15/mo
              </Button>
            </a>
          </div>

          {/* Annual Upgrade */}
          <div
            className="bg-[#1a1a1a] rounded-xl p-6 relative"
            style={{ border: "2px solid #FF4B6E" }}
          >
            <span
              className="absolute top-4 right-4 text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "rgba(255, 75, 110, 0.15)", color: "#FF4B6E" }}
            >
              Save 33%
            </span>
            <h3 className="text-foreground font-semibold text-lg mb-2">Annual</h3>
            <div className="mb-1">
              <span className="text-3xl font-bold text-foreground">$10</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <p className="text-muted-foreground text-sm mb-5">$120/year, billed annually</p>
            <a href="/api/lemonsqueezy/checkout?plan=annual">
              <Button
                className="w-full rounded-full font-medium text-white"
                style={{ backgroundColor: "#FF4B6E" }}
              >
                Upgrade to Annual — $10/mo
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Section 3: Got a coupon? — /redeem 안내 */}
      <section className="mb-8">
        <div className="bg-[#141416] border border-border/20 rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5" style={{ color: "#FF4B6E" }} />
              <p className="text-muted-foreground text-sm">
                Have a Hallyu Pass coupon code? Redeem it to activate your plan instantly.
              </p>
            </div>
            <Link
              href="/redeem"
              className="text-sm font-medium hover:underline whitespace-nowrap"
              style={{ color: "#FF4B6E" }}
            >
              Redeem code →
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
