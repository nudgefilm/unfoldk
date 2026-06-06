"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Settings,
  CheckCircle2,
  Clock,
  Crosshair,
  Loader2,
  ChevronRight,
  RefreshCcw,
  Sparkles,
  TrendingUp,
  History,
} from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { usePaddle } from "@/components/PaddleProvider"
import { PADDLE_PRICE_IDS } from "@/lib/paddle/constants"
import { cn } from "@/lib/utils"

// ─── 상수 ──────────────────────────────────────────────────────────────────

const GOLD = "#8B6F47"
const GOLD_LIGHT = "#C8A882"

const CATEGORY_CHIPS = [
  { label: "All", value: "" },
  { label: "Skincare", value: "skincare" },
  { label: "Cleansing", value: "cleansing" },
  { label: "Suncare", value: "suncare" },
  { label: "Makeup", value: "makeup" },
  { label: "Haircare", value: "haircare" },
  { label: "Body", value: "body" },
  { label: "Derma", value: "derma" },
]

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/kbeauty/dashboard/seller" },
  { label: "Sourcing Sniper", icon: Crosshair, href: "/kbeauty/sourcing-sniper", active: true },
  { label: "Settings", icon: Settings, href: "/kbeauty/dashboard/seller/settings" },
]

// ─── 타입 ──────────────────────────────────────────────────────────────────

interface SupplierCard {
  id: string
  company_name_en: string
  company_name_ko: string
  categories: string[] | null
  product_categories: string[]
  certifications: string[]
  moq: number | null
  price_range_min: number | null
  price_range_max: number | null
  export_countries: string | null
  fda_status: string | null
  product_count: number
}

interface ProductRow {
  id: string
  category: string
  moq: number | null
  price_range_min: number | null
  price_range_max: number | null
  beauty_suppliers: {
    id: string
    company_name_en: string
    company_name_ko: string
    categories: string[] | null
    moq: number | null
    price_range_min: number | null
    price_range_max: number | null
    export_countries: string | null
    fda_status: string | null
    iso_22716: boolean | null
    vegan_certified: boolean | null
    cruelty_free_certified: boolean | null
  } | null
}

interface AnalysisResult {
  opportunity: string
  risk: string
  margin_insight: string
  recommended_categories: string[]
}

interface HistoryEntry {
  supplierId: string
  supplierName: string
  result: AnalysisResult
}

interface TrendStats {
  avgExportPrice: number
  moqMin: number
  moqMax: number
  certRatio: number
  supplierCount: number
}

// ─── 사이드바 ──────────────────────────────────────────────────────────────

function Sidebar({ companyName }: { companyName: string }) {
  return (
    <aside
      className="fixed top-0 left-0 h-screen bg-white border-r border-[#E8E2DA] flex flex-col"
      style={{ width: 240 }}
    >
      <div className="px-6 py-5 border-b border-[#E8E2DA]">
        <Link href="/kbeauty" className="flex items-center gap-1">
          <span className="font-bold text-[#0F0F0F] text-sm">UnfoldK Beauty</span>
          <span style={{ color: GOLD_LIGHT }} className="text-xs">&#9670;</span>
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
              item.active
                ? "font-semibold"
                : "text-[#6B6B6B] hover:bg-[#F8F7F5] hover:text-[#0F0F0F]"
            )}
            style={item.active ? { background: `${GOLD_LIGHT}18`, color: GOLD } : {}}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-[#E8E2DA]">
        <p className="text-xs font-medium text-[#0F0F0F] truncate">{companyName || "—"}</p>
      </div>
    </aside>
  )
}

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────

function formatPrice(min: number | null, max: number | null): string {
  if (!min && !max) return "—"
  if (min && max) return `$${min}–$${max}`
  return min ? `From $${min}` : `Up to $${max}`
}

function buildSupplierCards(products: ProductRow[]): SupplierCard[] {
  const map = new Map<string, SupplierCard>()

  for (const p of products) {
    const s = p.beauty_suppliers
    if (!s) continue

    if (!map.has(s.id)) {
      const certs: string[] = []
      if (s.fda_status === "등록 완료") certs.push("FDA Registered")
      if (s.iso_22716) certs.push("ISO 22716")
      if (s.vegan_certified) certs.push("Vegan")
      if (s.cruelty_free_certified) certs.push("Cruelty-Free")

      map.set(s.id, {
        id: s.id,
        company_name_en: s.company_name_en,
        company_name_ko: s.company_name_ko,
        categories: s.categories,
        product_categories: [],
        certifications: certs,
        moq: s.moq,
        price_range_min: s.price_range_min,
        price_range_max: s.price_range_max,
        export_countries: s.export_countries,
        fda_status: s.fda_status,
        product_count: 0,
      })
    }

    const card = map.get(s.id)!
    card.product_count++
    if (p.category && !card.product_categories.includes(p.category)) {
      card.product_categories.push(p.category)
    }
  }

  return Array.from(map.values())
}

function computeTrendStats(products: ProductRow[], category: string): TrendStats {
  const inCat = products.filter((p) => p.category === category)
  const supplierIds = new Set<string>()
  const certifiedIds = new Set<string>()
  let priceSum = 0, priceCount = 0, moqMin = Infinity, moqMax = 0

  for (const p of inCat) {
    const s = p.beauty_suppliers
    if (!s) continue
    supplierIds.add(s.id)

    const mid = p.price_range_min && p.price_range_max
      ? (p.price_range_min + p.price_range_max) / 2
      : p.price_range_min ?? p.price_range_max ?? null
    if (mid) { priceSum += mid; priceCount++ }

    if (p.moq) { moqMin = Math.min(moqMin, p.moq); moqMax = Math.max(moqMax, p.moq) }

    if (s.fda_status === "등록 완료" || s.iso_22716 || s.vegan_certified || s.cruelty_free_certified) {
      certifiedIds.add(s.id)
    }
  }

  return {
    avgExportPrice: priceCount > 0 ? priceSum / priceCount : 0,
    moqMin: moqMin === Infinity ? 0 : moqMin,
    moqMax,
    certRatio: supplierIds.size > 0 ? (certifiedIds.size / supplierIds.size) * 100 : 0,
    supplierCount: supplierIds.size,
  }
}

// ─── 메인 페이지 ───────────────────────────────────────────────────────────

export default function SourcingSniperPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const paddle = usePaddle()

  const [companyName, setCompanyName] = useState("")
  const [loading, setLoading] = useState(true)
  const [sniperActive, setSniperActive] = useState<boolean | null>(null)
  const [userEmail, setUserEmail] = useState<string | undefined>()
  const [userId, setUserId] = useState<string | undefined>()
  const [allProducts, setAllProducts] = useState<ProductRow[]>([])
  const [categoryFilter, setCategoryFilter] = useState("")

  // 공급사 분석
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierCard | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])

  // 카테고리 트렌드
  const [trendCategory, setTrendCategory] = useState("")
  const [trendStats, setTrendStats] = useState<TrendStats | null>(null)
  const [trendInsight, setTrendInsight] = useState("")
  const [loadingTrend, setLoadingTrend] = useState(false)

  // ─── 초기 로드 ────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/kbeauty/seller/login"); return }

      setUserEmail(user.email ?? undefined)
      setUserId(user.id)

      const { data: seller } = await supabase
        .from("beauty_sellers")
        .select("id, company_name, sourcing_sniper_active")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!seller) { router.push("/kbeauty/seller/login"); return }

      const s = seller as { id: string; company_name: string; sourcing_sniper_active: boolean }
      setCompanyName(s.company_name)
      setSniperActive(s.sourcing_sniper_active ?? false)

      const { data: products } = await supabase
        .from("beauty_products")
        .select(`
          id, category, moq, price_range_min, price_range_max,
          beauty_suppliers(
            id, company_name_en, company_name_ko, categories,
            moq, price_range_min, price_range_max, export_countries,
            fda_status, iso_22716, vegan_certified, cruelty_free_certified
          )
        `)
        .eq("status", "active")
        .limit(500)

      setAllProducts((products ?? []) as unknown as ProductRow[])
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── 공급사 목록 (필터 적용) ──────────────────────────────────────────────

  const filteredSuppliers = (() => {
    const cards = buildSupplierCards(allProducts)
    if (!categoryFilter) return cards
    return cards.filter(
      (c) =>
        c.product_categories.includes(categoryFilter) ||
        (c.categories ?? []).includes(categoryFilter)
    )
  })()

  // ─── 공급사 분석 호출 ─────────────────────────────────────────────────────

  const handleAnalyze = useCallback(async (supplier: SupplierCard) => {
    setSelectedSupplier(supplier)
    setAnalyzing(true)
    setAnalysisResult(null)

    const res = await fetch("/api/kbeauty/sourcing-sniper/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "supplier",
        supplier: {
          company_name_en: supplier.company_name_en,
          company_name_ko: supplier.company_name_ko,
          categories: [
            ...(supplier.categories ?? []),
            ...supplier.product_categories,
          ].filter((v, i, a) => a.indexOf(v) === i),
          certifications: supplier.certifications,
          moq: supplier.moq,
          price_range_min: supplier.price_range_min,
          price_range_max: supplier.price_range_max,
          export_countries: supplier.export_countries,
          fda_status: supplier.fda_status,
        },
      }),
    })

    const result = await res.json() as AnalysisResult
    setAnalysisResult(result)
    setAnalyzing(false)

    // 히스토리 추가 (최대 10건, 중복 제거)
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.supplierId !== supplier.id)
      return [
        { supplierId: supplier.id, supplierName: supplier.company_name_en, result },
        ...filtered,
      ].slice(0, 10)
    })
  }, [])

  // ─── 카테고리 트렌드 ─────────────────────────────────────────────────────

  const handleTrendSelect = useCallback(async (cat: string) => {
    setTrendCategory(cat)
    setTrendInsight("")
    if (!cat) { setTrendStats(null); return }

    const stats = computeTrendStats(allProducts, cat)
    setTrendStats(stats)

    if (stats.supplierCount === 0) return

    setLoadingTrend(true)
    const res = await fetch("/api/kbeauty/sourcing-sniper/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "trend", stats: { category: cat, ...stats } }),
    })
    const data = await res.json() as { insight: string }
    setTrendInsight(data.insight ?? "")
    setLoadingTrend(false)
  }, [allProducts])

  // ─── 로딩 ─────────────────────────────────────────────────────────────────

  function openSniperCheckout(priceId: string) {
    if (!paddle) return
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: userEmail ? { email: userEmail } : undefined,
      customData: userId ? { userId } : undefined,
      settings: { displayMode: "overlay", theme: "light" },
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F7F5] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: GOLD }} />
      </div>
    )
  }

  // ─── 결제 게이트 ───────────────────────────────────────────────────────────
  if (sniperActive === false) {
    return (
      <div
        className="min-h-screen bg-[#F8F7F5]"
        style={{ fontFamily: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
      >
        <Sidebar companyName={companyName} />
        <main className="min-h-screen flex items-center justify-center" style={{ marginLeft: 240 }}>
          <div className="max-w-md w-full mx-auto px-8">
            <div className="bg-white border border-[#E8E2DA] rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.08)] text-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: `${GOLD_LIGHT}22` }}
              >
                <Crosshair className="w-7 h-7" style={{ color: GOLD }} />
              </div>
              <h1
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: 26, fontWeight: 600, color: "#0F0F0F" }}
                className="mb-2"
              >
                Sourcing Sniper
              </h1>
              <p className="text-sm text-[#6B6B6B] mb-7 leading-relaxed">
                AI supplier intelligence for smarter sourcing decisions.<br />
                Unlock instant access with a subscription.
              </p>

              {/* 플랜 선택 */}
              <div className="space-y-3 mb-7">
                {/* Monthly */}
                <button
                  onClick={() => openSniperCheckout(PADDLE_PRICE_IDS.sourcing_sniper_monthly)}
                  disabled={!paddle}
                  className="w-full flex items-center justify-between px-5 py-4 border-2 rounded-xl transition-all disabled:opacity-50 hover:border-[#C8A882]"
                  style={{ borderColor: `${GOLD_LIGHT}88` }}
                >
                  <div className="text-left">
                    <p className="text-sm font-semibold text-[#0F0F0F]">Monthly Access</p>
                    <p className="text-xs text-[#6B6B6B] mt-0.5">Cancel anytime</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold" style={{ color: GOLD }}>$29</p>
                    <p className="text-xs text-[#6B6B6B]">/month</p>
                  </div>
                </button>

                {/* One-time */}
                <button
                  onClick={() => openSniperCheckout(PADDLE_PRICE_IDS.sourcing_sniper_onetime)}
                  disabled={!paddle}
                  className="w-full flex items-center justify-between px-5 py-4 border-2 rounded-xl transition-all disabled:opacity-50 text-white"
                  style={{ background: GOLD, borderColor: GOLD }}
                >
                  <div className="text-left">
                    <p className="text-sm font-semibold">Lifetime Access</p>
                    <p className="text-xs text-white/70 mt-0.5">One-time payment</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">$79</p>
                    <p className="text-xs text-white/70">one-time</p>
                  </div>
                </button>
              </div>

              <p className="text-xs text-[#9B9B9B]">
                Secure payment powered by Paddle. 7-day refund guarantee.
              </p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-[#F8F7F5]"
      style={{ fontFamily: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
    >
      <Sidebar companyName={companyName} />

      <main className="min-h-screen" style={{ marginLeft: 240 }}>
        <div className="max-w-4xl mx-auto px-8 py-10">

          {/* ① 헤더 */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Crosshair className="w-6 h-6" style={{ color: GOLD_LIGHT }} />
              <h1
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: 30, fontWeight: 600, color: "#0F0F0F" }}
              >
                Sourcing Sniper
              </h1>
              <span
                className="text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full"
                style={{ background: `${GOLD_LIGHT}22`, color: GOLD, border: `1px solid ${GOLD_LIGHT}55` }}
              >
                BETA · SELLER EXCLUSIVE
              </span>
            </div>
            <p className="text-sm text-[#6B6B6B]">
              AI-powered supplier intelligence for smarter sourcing decisions
            </p>
          </div>

          {/* ② 공급사 심층 분석 */}
          <section className="bg-white border border-[#E8E2DA] rounded-xl p-6 mb-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2 mb-5">
              <Sparkles className="w-4 h-4" style={{ color: GOLD }} />
              <h2 className="text-base font-bold text-[#0F0F0F]">Supplier Intelligence</h2>
            </div>

            {/* 카테고리 필터 칩 */}
            <div className="flex flex-wrap gap-2 mb-5">
              {CATEGORY_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  onClick={() => { setCategoryFilter(chip.value); setSelectedSupplier(null); setAnalysisResult(null) }}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    categoryFilter === chip.value
                      ? "text-white border-transparent"
                      : "bg-white border-[#E8E2DA] text-[#6B6B6B] hover:border-[#C8A882]/60"
                  )}
                  style={categoryFilter === chip.value ? { background: GOLD, borderColor: GOLD } : {}}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* 공급사 목록 */}
            {filteredSuppliers.length === 0 ? (
              <p className="text-sm text-[#6B6B6B] py-8 text-center">No suppliers found for this category.</p>
            ) : (
              <div className="space-y-3">
                {filteredSuppliers.map((supplier) => {
                  const isSelected = selectedSupplier?.id === supplier.id
                  return (
                    <div
                      key={supplier.id}
                      className={cn(
                        "px-4 py-4 border rounded-xl transition-all",
                        isSelected
                          ? "border-[#C8A882] bg-white"
                          : "border-[#E8E2DA] bg-[#FAFAF9] hover:bg-white hover:border-[#C8A882]/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* 공급사 정보 */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-semibold text-[#0F0F0F]">
                              {supplier.company_name_en}
                            </span>
                            <span className="text-xs text-[#6B6B6B]">{supplier.company_name_ko}</span>
                          </div>

                          <div className="flex items-center gap-3 flex-wrap mt-1">
                            <span className="text-xs text-[#6B6B6B]">
                              {supplier.product_count} product{supplier.product_count !== 1 ? "s" : ""}
                            </span>
                            {supplier.product_categories.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {supplier.product_categories.map((cat) => (
                                  <span
                                    key={cat}
                                    className="text-[10px] font-medium px-1.5 py-0.5 rounded capitalize"
                                    style={{ background: "#F0EDE8", color: "#6B6B6B" }}
                                  >
                                    {cat}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {(supplier.price_range_min || supplier.price_range_max) && (
                              <span className="text-xs font-medium" style={{ color: GOLD }}>
                                {formatPrice(supplier.price_range_min, supplier.price_range_max)}
                              </span>
                            )}
                            {supplier.moq && (
                              <span className="text-xs text-[#6B6B6B]">MOQ: {supplier.moq.toLocaleString()}</span>
                            )}
                            {supplier.certifications.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {supplier.certifications.map((cert) => (
                                  <span
                                    key={cert}
                                    className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                                    style={{ background: `${GOLD}18`, color: GOLD }}
                                  >
                                    {cert}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Analyze 버튼 */}
                        <button
                          onClick={() => handleAnalyze(supplier)}
                          disabled={analyzing && isSelected}
                          className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-80 disabled:opacity-50"
                          style={{ background: GOLD }}
                        >
                          {analyzing && isSelected ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Crosshair className="w-3 h-3" />
                          )}
                          {analyzing && isSelected ? "Analyzing..." : "Analyze"}
                        </button>
                      </div>

                      {/* 분석 결과 (해당 카드 아래 인라인) */}
                      {isSelected && analysisResult && (
                        <div
                          className="mt-4 pt-4 border-t space-y-3"
                          style={{ borderColor: `${GOLD_LIGHT}44` }}
                        >
                          <AnalysisCard
                            emoji="🎯"
                            label="Opportunity"
                            text={analysisResult.opportunity}
                          />
                          <AnalysisCard
                            emoji="⚠️"
                            label="Risk"
                            text={analysisResult.risk}
                          />
                          <AnalysisCard
                            emoji="💰"
                            label="Margin Insight"
                            text={analysisResult.margin_insight}
                          />
                          {analysisResult.recommended_categories.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-[#6B6B6B] mb-1.5">
                                📦 Recommended Categories
                              </p>
                              <div className="flex gap-1.5 flex-wrap">
                                {analysisResult.recommended_categories.map((cat) => (
                                  <span
                                    key={cat}
                                    className="text-xs font-medium px-2.5 py-1 rounded-full capitalize"
                                    style={{ background: `${GOLD_LIGHT}22`, color: GOLD, border: `1px solid ${GOLD_LIGHT}55` }}
                                  >
                                    {cat}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* ③ 카테고리 트렌드 스나이핑 */}
          <section className="bg-white border border-[#E8E2DA] rounded-xl p-6 mb-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-4 h-4" style={{ color: GOLD }} />
              <h2 className="text-base font-bold text-[#0F0F0F]">Category Trend Sniping</h2>
            </div>

            {/* 카테고리 선택 (All 제외) */}
            <div className="flex flex-wrap gap-2 mb-5">
              {CATEGORY_CHIPS.filter((c) => c.value).map((chip) => (
                <button
                  key={chip.value}
                  onClick={() => handleTrendSelect(chip.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    trendCategory === chip.value
                      ? "text-white border-transparent"
                      : "bg-white border-[#E8E2DA] text-[#6B6B6B] hover:border-[#C8A882]/60"
                  )}
                  style={trendCategory === chip.value ? { background: GOLD, borderColor: GOLD } : {}}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {!trendCategory ? (
              <p className="text-sm text-[#6B6B6B] py-6 text-center">Select a category to view trend intelligence.</p>
            ) : trendStats && trendStats.supplierCount === 0 ? (
              <p className="text-sm text-[#6B6B6B] py-6 text-center">No supplier data available for this category yet.</p>
            ) : trendStats ? (
              <>
                {/* 집계 지표 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <TrendStatCard
                    label="Avg Export Price"
                    value={trendStats.avgExportPrice > 0 ? `$${trendStats.avgExportPrice.toFixed(2)}` : "—"}
                  />
                  <TrendStatCard
                    label="MOQ Range"
                    value={
                      trendStats.moqMax > 0
                        ? `${trendStats.moqMin.toLocaleString()}–${trendStats.moqMax.toLocaleString()}`
                        : "—"
                    }
                  />
                  <TrendStatCard
                    label="Certified Suppliers"
                    value={`${trendStats.certRatio.toFixed(0)}%`}
                  />
                  <TrendStatCard
                    label="Active Suppliers"
                    value={trendStats.supplierCount.toString()}
                  />
                </div>

                {/* AI 트렌드 인사이트 */}
                <div
                  className="flex items-start gap-3 px-4 py-3 rounded-xl"
                  style={{ background: `${GOLD_LIGHT}12`, border: `1px solid ${GOLD_LIGHT}44` }}
                >
                  {loadingTrend ? (
                    <Loader2 className="w-4 h-4 animate-spin mt-0.5 flex-shrink-0" style={{ color: GOLD }} />
                  ) : (
                    <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />
                  )}
                  <p className="text-sm text-[#0F0F0F] leading-relaxed">
                    {loadingTrend
                      ? "Generating trend insight..."
                      : trendInsight || "Analyzing category data..."}
                  </p>
                </div>
              </>
            ) : null}
          </section>

          {/* ④ 분석 히스토리 */}
          {history.length > 0 && (
            <section className="bg-white border border-[#E8E2DA] rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-2 mb-4">
                <History className="w-4 h-4" style={{ color: GOLD }} />
                <h2 className="text-base font-bold text-[#0F0F0F]">Analysis History</h2>
                <span className="text-xs text-[#6B6B6B]">This session · {history.length}/10</span>
              </div>

              <div className="space-y-2">
                {history.map((entry) => (
                  <div
                    key={entry.supplierId}
                    className="flex items-center justify-between px-4 py-3 border border-[#E8E2DA] rounded-xl bg-[#FAFAF9]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#0F0F0F] truncate">{entry.supplierName}</p>
                      <p className="text-xs text-[#6B6B6B] truncate mt-0.5">
                        {entry.result.recommended_categories.join(" · ")}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const s = filteredSuppliers.find((c) => c.id === entry.supplierId)
                          ?? buildSupplierCards(allProducts).find((c) => c.id === entry.supplierId)
                        if (s) handleAnalyze(s)
                      }}
                      className="flex-shrink-0 ml-3 flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors"
                      style={{ borderColor: GOLD_LIGHT, color: GOLD }}
                    >
                      <RefreshCcw className="w-3 h-3" />
                      Re-analyze
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="h-12" />
        </div>
      </main>
    </div>
  )
}

// ─── 서브 컴포넌트 ────────────────────────────────────────────────────────

function AnalysisCard({ emoji, label, text }: { emoji: string; label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[#6B6B6B] mb-1">
        {emoji} {label}
      </p>
      <p className="text-sm text-[#0F0F0F] leading-relaxed">{text}</p>
    </div>
  )
}

function TrendStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#F8F7F5] border border-[#E8E2DA] px-4 py-3 rounded-xl">
      <p className="text-[10px] font-medium text-[#6B6B6B] mb-1 uppercase tracking-wide">{label}</p>
      <p className="text-base font-semibold text-[#0F0F0F]">{value}</p>
    </div>
  )
}
