"use client"

import { type ReactNode, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Search,
  Settings,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
  Loader2,
  FlaskConical,
  AlertCircle,
  Calculator,
  BarChart2,
  RefreshCcw,
  X,
  Crosshair,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { ExchangeRateBadge } from "@/components/kbeauty/ExchangeRateBadge"
import { NotificationBell } from "@/components/kbeauty/NotificationBell"
import { RatingModal } from "@/components/kbeauty/RatingModal"
import { cn } from "@/lib/utils"

// ─── 타입 ──────────────────────────────────────────────────────────────────

interface PlatformUrls {
  amazon?: string
  shopify?: string
  tiktok?: string
  other_name?: string
  other_url?: string
}

interface Seller {
  id: string
  company_name: string
  country: string | null
  categories: string[] | null
  annual_sales_volume: string | null
  platform_urls: PlatformUrls | null
  target_countries: string[] | null
  contact_verified: boolean
  status: string
}

interface SupplierInfo {
  company_name_en: string | null
  company_name_ko: string | null
  iso_22716: boolean | null
  vegan_certified: boolean | null
  cruelty_free_certified: boolean | null
  fda_status: string | null
}

interface Product {
  id: string
  supplier_id: string
  product_name_en: string
  product_name_ko: string
  brand_name: string
  category: string
  certifications: string[] | null
  moq: number | null
  price_range_min: number | null
  price_range_max: number | null
  lead_time_days: number | null
  consumer_price_krw: number | null
  status: string
  beauty_suppliers: SupplierInfo | null
}

interface SourcingRequest {
  id: string
  supplier_id: string
  product_id: string | null
  status: string
  created_at: string
  beauty_suppliers: { company_name_en: string | null; company_name_ko: string | null } | null
}

// ─── 상수 ──────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/kbeauty/dashboard/seller" },
  { label: "Discover", icon: Search, href: "#discover" },
  { label: "Calculator", icon: Calculator, href: "#calculator" },
  { label: "Sourcing Sniper", icon: Crosshair, href: "/kbeauty/sourcing-sniper", highlight: true },
  { label: "Settings", icon: Settings, href: "/kbeauty/dashboard/seller/settings" },
]

const CATEGORY_FILTERS = [
  { label: "All", value: "" },
  { label: "Skincare", value: "skincare" },
  { label: "Cleansing", value: "cleansing" },
  { label: "Suncare", value: "suncare" },
  { label: "Makeup", value: "makeup" },
  { label: "Haircare", value: "haircare" },
  { label: "Body", value: "body" },
  { label: "Derma", value: "derma" },
]

const CERT_FILTERS = [
  { label: "All", value: "" },
  { label: "FDA Registered", value: "fda" },
  { label: "ISO 22716", value: "iso22716" },
  { label: "Vegan", value: "vegan" },
  { label: "Cruelty-Free", value: "cruelty_free" },
]

const VOLUME_OPTIONS = [
  "Under $100K / year",
  "$100K – $500K / year",
  "$500K – $1M / year",
  "Over $1M / year",
]

const SOURCING_STATUS_MAP: Record<string, { label: string; icon: ReactNode; className: string }> = {
  requested: {
    label: "Pending",
    icon: <Clock className="w-3 h-3" />,
    className: "text-amber-700 bg-amber-50 border-amber-200",
  },
  approved: {
    label: "Approved",
    icon: <CheckCircle2 className="w-3 h-3" />,
    className: "text-green-700 bg-green-50 border-green-200",
  },
  rejected: {
    label: "Rejected",
    icon: <XCircle className="w-3 h-3" />,
    className: "text-red-600 bg-red-50 border-red-200",
  },
  completed: {
    label: "Completed",
    icon: <RefreshCcw className="w-3 h-3" />,
    className: "text-[#6B6B6B] bg-[#F8F7F5] border-[#E8E2DA]",
  },
}

// Gold accent for seller theme
const GOLD = "#8B6F47"
const GOLD_LIGHT = "#C8A882"

// ─── 사이드바 ──────────────────────────────────────────────────────────────

function Sidebar({ companyName, verified }: { companyName: string; verified: boolean }) {
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
          <a
            key={item.label}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
              item.highlight
                ? "font-semibold"
                : "text-[#6B6B6B] hover:bg-[#F8F7F5] hover:text-[#0F0F0F]"
            )}
            style={item.highlight ? { color: GOLD, background: `${GOLD_LIGHT}18` } : {}}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {item.label}
            {item.highlight && (
              <ChevronRight className="w-3 h-3 ml-auto" style={{ color: GOLD_LIGHT }} />
            )}
          </a>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-[#E8E2DA]">
        <p className="text-xs font-medium text-[#0F0F0F] truncate">{companyName || "—"}</p>
        <div className="mt-1">
          {verified ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-[#6B6B6B] bg-[#F8F7F5] px-2 py-0.5 rounded-full border border-[#E8E2DA]">
              <Clock className="w-3 h-3" />
              Pending
            </span>
          )}
        </div>
      </div>
    </aside>
  )
}

// ─── 요약 카드 ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex-1 min-w-0 bg-[#F8F7F5] border border-[#E8E2DA] px-5 py-4 rounded-xl">
      <p className="text-xs text-[#6B6B6B] mb-1">{label}</p>
      <p className="text-2xl font-semibold text-[#0F0F0F]">{value}</p>
    </div>
  )
}

// ─── 메인 페이지 ───────────────────────────────────────────────────────────

export default function SellerDashboardPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [seller, setSeller] = useState<Seller | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // 요약 카운트
  const [sourcingCount, setSourcingCount] = useState(0)
  const [approvedCount, setApprovedCount] = useState(0)
  const [sampleCount, setSampleCount] = useState(0)

  // 제품 탐색
  const [products, setProducts] = useState<Product[]>([])
  const [categoryFilter, setCategoryFilter] = useState("")
  const [keyword, setKeyword] = useState("")
  const [certFilter, setCertFilter] = useState("")
  const [loadingProducts, setLoadingProducts] = useState(false)

  // 소싱/샘플 요청 상태
  const [requestedSourcingProductIds, setRequestedSourcingProductIds] = useState<Set<string>>(new Set())
  const [requestedSampleProductIds, setRequestedSampleProductIds] = useState<Set<string>>(new Set())
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  // 샘플 요청 모달
  const [sampleModalProduct, setSampleModalProduct] = useState<Product | null>(null)
  const [sampleQty, setSampleQty] = useState(1)
  const [sampleMsg, setSampleMsg] = useState("")
  const [submittingSample, setSubmittingSample] = useState(false)

  // 수익 계산기
  const [exchangeRate, setExchangeRate] = useState(1400)
  const [exportPrice, setExportPrice] = useState("")
  const [tariffRate, setTariffRate] = useState("")
  const [platformFee, setPlatformFee] = useState("")
  const [sellingPrice, setSellingPrice] = useState("")

  // 경쟁 제품 비교
  const [compCategory, setCompCategory] = useState("")
  const [compProducts, setCompProducts] = useState<Product[]>([])

  // 소싱 요청 목록 + 평점
  const [sourcingRequests, setSourcingRequests] = useState<SourcingRequest[]>([])
  const [ratedSourcingIds, setRatedSourcingIds] = useState<Set<string>>(new Set())
  const [ratingModalSourcing, setRatingModalSourcing] = useState<SourcingRequest | null>(null)
  const [supplierRatings, setSupplierRatings] = useState<Map<string, { avg: number; count: number }>>(new Map())

  // ─── 초기 데이터 로드 ─────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/kbeauty/seller/login"); return }
      setUserId(user.id)

      const { data: sellerData } = await supabase
        .from("beauty_sellers")
        .select("id, company_name, country, categories, annual_sales_volume, platform_urls, target_countries, contact_verified, status")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!sellerData) { router.push("/kbeauty/seller/register"); return }
      setSeller(sellerData as Seller)

      // 요약 카운트 (병렬)
      const [
        { count: sCount },
        { count: aCount },
        { count: sampCount },
      ] = await Promise.all([
        supabase.from("beauty_seller_sourcing").select("id", { count: "exact", head: true }).eq("seller_id", sellerData.id),
        supabase.from("beauty_seller_sourcing").select("id", { count: "exact", head: true }).eq("seller_id", sellerData.id).eq("status", "approved"),
        supabase.from("beauty_post_matching_services").select("id", { count: "exact", head: true }).eq("seller_id", sellerData.id).eq("service_type", "sample"),
      ])
      setSourcingCount(sCount ?? 0)
      setApprovedCount(aCount ?? 0)
      setSampleCount(sampCount ?? 0)

      // 이미 요청한 제품 ID 로드 (병렬)
      const [{ data: sourcingData }, { data: sampleData }] = await Promise.all([
        supabase.from("beauty_seller_sourcing").select("product_id").eq("seller_id", sellerData.id),
        supabase.from("beauty_post_matching_services").select("product_id").eq("seller_id", sellerData.id).eq("service_type", "sample"),
      ])
      setRequestedSourcingProductIds(new Set(
        (sourcingData ?? []).filter((r: { product_id: string | null }) => r.product_id).map((r: { product_id: string | null }) => r.product_id as string)
      ))
      setRequestedSampleProductIds(new Set(
        (sampleData ?? []).filter((r: { product_id: string | null }) => r.product_id).map((r: { product_id: string | null }) => r.product_id as string)
      ))

      // 소싱 요청 목록 (공급사 정보 포함, 최신 20건)
      const { data: srcList } = await supabase
        .from("beauty_seller_sourcing")
        .select("id, supplier_id, product_id, status, created_at, beauty_suppliers(company_name_en, company_name_ko)")
        .eq("seller_id", sellerData.id)
        .order("created_at", { ascending: false })
        .limit(20)
      setSourcingRequests((srcList as unknown as SourcingRequest[]) ?? [])

      // 이미 평점을 남긴 소싱 ID 셋
      const { data: ratedData } = await supabase
        .from("beauty_ratings")
        .select("reference_id")
        .eq("reviewer_id", user.id)
        .eq("reference_type", "sourcing")
      setRatedSourcingIds(new Set((ratedData ?? []).map((r: { reference_id: string }) => r.reference_id)))

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── 제품 목록 (필터 변경 시) ──────────────────────────────────────────────

  useEffect(() => {
    if (!seller) return
    setLoadingProducts(true)

    let q = supabase
      .from("beauty_products")
      .select("id, supplier_id, product_name_en, product_name_ko, brand_name, category, certifications, moq, price_range_min, price_range_max, lead_time_days, consumer_price_krw, status, beauty_suppliers(company_name_en, company_name_ko, iso_22716, vegan_certified, cruelty_free_certified, fda_status)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(30)

    if (categoryFilter) q = q.eq("category", categoryFilter)
    if (keyword.trim()) q = q.or(`product_name_en.ilike.%${keyword.trim()}%,brand_name.ilike.%${keyword.trim()}%`)

    q.then(({ data }) => {
      let list = (data as Product[]) ?? []
      if (certFilter === "fda") list = list.filter(p => (p.beauty_suppliers as SupplierInfo | null)?.fda_status === "등록 완료")
      else if (certFilter === "iso22716") list = list.filter(p => (p.beauty_suppliers as SupplierInfo | null)?.iso_22716)
      else if (certFilter === "vegan") list = list.filter(p => (p.beauty_suppliers as SupplierInfo | null)?.vegan_certified)
      else if (certFilter === "cruelty_free") list = list.filter(p => (p.beauty_suppliers as SupplierInfo | null)?.cruelty_free_certified)
      setProducts(list)
      setLoadingProducts(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seller, categoryFilter, keyword, certFilter])

  // ─── 공급사 평점 로드 (products 변경 시) ─────────────────────────────────

  useEffect(() => {
    const supplierIds = [...new Set(products.map((p) => p.supplier_id))]
    if (supplierIds.length === 0) { setSupplierRatings(new Map()); return }
    supabase
      .from("beauty_ratings")
      .select("supplier_id, overall_rating")
      .in("supplier_id", supplierIds)
      .then(({ data }) => {
        const bySupplier = new Map<string, number[]>()
        for (const r of (data ?? [])) {
          const arr = bySupplier.get(r.supplier_id) ?? []
          arr.push(Number(r.overall_rating ?? 0))
          bySupplier.set(r.supplier_id, arr)
        }
        const result = new Map<string, { avg: number; count: number }>()
        for (const [sid, ratings] of bySupplier) {
          const avg = ratings.reduce((s, v) => s + v, 0) / ratings.length
          result.set(sid, { avg: Math.round(avg * 10) / 10, count: ratings.length })
        }
        setSupplierRatings(result)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products])

  // ─── 경쟁 제품 비교 ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!compCategory || !seller) return
    supabase
      .from("beauty_products")
      .select("id, supplier_id, product_name_en, brand_name, category, certifications, moq, price_range_min, price_range_max, lead_time_days, consumer_price_krw, status, beauty_suppliers(company_name_en)")
      .eq("status", "active")
      .eq("category", compCategory)
      .limit(4)
      .then(({ data }) => setCompProducts((data as Product[]) ?? []))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compCategory, seller])

  // ─── 환율 로드 ────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/kbeauty/exchange-rate")
      .then((r) => r.json())
      .then(({ rate }: { rate: number }) => { if (rate) setExchangeRate(rate) })
      .catch(() => {})
  }, [])

  // ─── 소싱 요청 ───────────────────────────────────────────────────────────

  const handleRequestSourcing = async (product: Product) => {
    if (!seller) return
    setSubmittingId(product.id)
    const { error } = await supabase.from("beauty_seller_sourcing").insert({
      seller_id: seller.id,
      supplier_id: product.supplier_id,
      product_id: product.id,
      status: "requested",
      initiated_by: "seller",
    })
    if (error) {
      toast.error("Something went wrong. Please try again.")
    } else {
      setRequestedSourcingProductIds((prev) => new Set([...prev, product.id]))
      setSourcingCount((c) => c + 1)
      toast.success("Sourcing request sent.")

      // 공급사에게 알림 발송
      const { data: suppUser } = await supabase
        .from("beauty_suppliers")
        .select("user_id")
        .eq("id", product.supplier_id)
        .maybeSingle()
      if (suppUser?.user_id) {
        await supabase.from("beauty_notifications").insert({
          user_id: suppUser.user_id,
          type: "sourcing_request",
          title: "새로운 소싱 요청",
          message: `${seller.company_name}에서 소싱 요청을 보냈습니다.`,
          link: "/kbeauty/dashboard/supplier",
        })
      }
    }
    setSubmittingId(null)
  }

  // ─── 샘플 요청 ───────────────────────────────────────────────────────────

  const handleRequestSample = async () => {
    if (!seller || !sampleModalProduct) return
    setSubmittingSample(true)
    const { error } = await supabase.from("beauty_post_matching_services").insert({
      seller_id: seller.id,
      supplier_id: sampleModalProduct.supplier_id,
      product_id: sampleModalProduct.id,
      service_type: "sample",
      status: "pending",
      quantity: sampleQty,
      message: sampleMsg || null,
    })
    if (error) {
      toast.error("Something went wrong. Please try again.")
    } else {
      setRequestedSampleProductIds((prev) => new Set([...prev, sampleModalProduct.id]))
      setSampleCount((c) => c + 1)
      toast.success("Sample request sent.")
      setSampleModalProduct(null)
      setSampleQty(1)
      setSampleMsg("")
    }
    setSubmittingSample(false)
  }

  // ─── 수익 계산 ───────────────────────────────────────────────────────────

  const calcResult = (() => {
    const exp = parseFloat(exportPrice) || 0
    const tar = parseFloat(tariffRate) || 0
    const fee = parseFloat(platformFee) || 0
    const sell = parseFloat(sellingPrice) || 0
    if (!sell || !exp) return null
    const landedCost = exp * (1 + tar / 100)
    const platformCut = sell * (fee / 100)
    const netRevenue = sell - platformCut
    const margin = netRevenue - landedCost
    const marginRate = (margin / sell) * 100
    return { landedCost, platformCut, netRevenue, margin, marginRate }
  })()

  // ─── 헬퍼 ────────────────────────────────────────────────────────────────

  const formatUSD = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n)

  const formatKRW = (n: number) =>
    new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(n * exchangeRate)

  const formatPrice = (min: number | null, max: number | null) => {
    if (!min && !max) return "—"
    if (min && max) return `$${min}–$${max}`
    return min ? `From $${min}` : `Up to $${max}`
  }

  const platformLinksMissing =
    !seller?.platform_urls ||
    (!seller.platform_urls.amazon && !seller.platform_urls.shopify && !seller.platform_urls.tiktok)

  // ─── 로딩 ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F7F5] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: GOLD }} />
      </div>
    )
  }

  const inputBase =
    "text-sm border border-[#E8E2DA] rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#C8A882] transition-colors"

  return (
    <div
      className="min-h-screen bg-[#F8F7F5]"
      style={{ fontFamily: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
    >
      <Toaster position="top-right" richColors />
      <Sidebar companyName={seller?.company_name ?? ""} verified={seller?.contact_verified ?? false} />

      <main className="min-h-screen" style={{ marginLeft: 240 }}>
        <div className="max-w-4xl mx-auto px-8 py-10">

          {/* ① 헤더 */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1
                className="text-[#0F0F0F]"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: 28, fontWeight: 600, lineHeight: 1.2 }}
              >
                Welcome, {seller?.company_name}
              </h1>
              <p className="text-xs text-[#6B6B6B] mt-1">K-Beauty Seller Dashboard</p>
            </div>
            <div className="flex items-center gap-2">
              {userId && <NotificationBell userId={userId} theme="gold" />}
              <ExchangeRateBadge />
            </div>
          </div>

          {/* ⑥ 판매 채널 등록 유도 배너 */}
          {platformLinksMissing && (
            <div
              className="flex items-center justify-between px-5 py-3 mb-6 rounded-xl cursor-pointer"
              style={{ background: "#FEF3C7", border: "1px solid #F59E0B" }}
              onClick={() => router.push("/kbeauty/dashboard/seller/profile")}
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                <p className="text-sm text-amber-800 font-medium">
                  Add your store links to build supplier trust →
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-700 flex-shrink-0" />
            </div>
          )}

          {/* ② 요약 카드 */}
          <div className="flex gap-4 mb-8">
            <SummaryCard label="Sourcing Requests" value={sourcingCount} />
            <SummaryCard label="Approved" value={approvedCount} />
            <SummaryCard label="Sample Requests" value={sampleCount} />
            <SummaryCard
              label="Approval Rate"
              value={sourcingCount > 0 ? `${((approvedCount / sourcingCount) * 100).toFixed(1)}%` : "—"}
            />
          </div>

          {/* ③ My Sourcing Requests */}
          {sourcingRequests.length > 0 && (
            <section className="bg-white border border-[#E8E2DA] rounded-xl p-6 mb-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
              <h2 className="text-base font-bold text-[#0F0F0F] mb-4">My Sourcing Requests</h2>
              <div className="space-y-2">
                {sourcingRequests.map((req) => {
                  const supplierName =
                    req.beauty_suppliers?.company_name_en ||
                    req.beauty_suppliers?.company_name_ko ||
                    "Unknown Supplier"
                  const statusConfig = SOURCING_STATUS_MAP[req.status] ?? SOURCING_STATUS_MAP["requested"]
                  return (
                    <div
                      key={req.id}
                      className="flex items-center justify-between gap-4 px-4 py-3 border border-[#E8E2DA] rounded-xl"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#0F0F0F] truncate">{supplierName}</p>
                        <p className="text-xs text-[#6B6B6B] mt-0.5">
                          {new Date(req.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border", statusConfig.className)}>
                          {statusConfig.icon}
                          {statusConfig.label}
                        </span>
                        {(req.status === "approved" || req.status === "completed") && !ratedSourcingIds.has(req.id) && (
                          <button
                            onClick={() => setRatingModalSourcing(req)}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                            style={{ color: GOLD, background: `${GOLD_LIGHT}25` }}
                          >
                            Rate Supplier
                          </button>
                        )}
                        {(req.status === "approved" || req.status === "completed") && ratedSourcingIds.has(req.id) && (
                          <span className="text-xs text-[#9CA3AF] px-2">Rated ✓</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* ④ Discover Suppliers */}
          <section id="discover" className="bg-white border border-[#E8E2DA] rounded-xl p-6 mb-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <h2 className="text-base font-bold text-[#0F0F0F] mb-4">Discover Suppliers</h2>

            {/* 필터 바 */}
            <div className="space-y-3 mb-5">
              {/* 키워드 검색 */}
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Search by brand or product name..."
                className={inputBase + " w-full"}
              />

              {/* 카테고리 필터 */}
              <div className="flex flex-wrap gap-2">
                {CATEGORY_FILTERS.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setCategoryFilter(cat.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                      categoryFilter === cat.value
                        ? "text-white border-transparent"
                        : "bg-white border-[#E8E2DA] text-[#6B6B6B] hover:border-[#C8A882]/60"
                    )}
                    style={categoryFilter === cat.value ? { background: GOLD, borderColor: GOLD } : {}}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* 인증 필터 */}
              <div className="flex flex-wrap gap-2">
                {CERT_FILTERS.map((cert) => (
                  <button
                    key={cert.value}
                    onClick={() => setCertFilter(cert.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                      certFilter === cert.value
                        ? "text-white border-transparent"
                        : "bg-white border-[#E8E2DA] text-[#6B6B6B] hover:border-[#C8A882]/60"
                    )}
                    style={certFilter === cert.value ? { background: GOLD_LIGHT, borderColor: GOLD_LIGHT } : {}}
                  >
                    {cert.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 제품 목록 */}
            {loadingProducts ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: GOLD }} />
              </div>
            ) : products.length === 0 ? (
              <p className="text-sm text-[#6B6B6B] py-8 text-center">No products found.</p>
            ) : (
              <div className="space-y-3">
                {products.map((product) => {
                  const alreadySourcing = requestedSourcingProductIds.has(product.id)
                  const alreadySample = requestedSampleProductIds.has(product.id)
                  const isSubmitting = submittingId === product.id
                  const supplierName =
                    (product.beauty_suppliers as SupplierInfo | null)?.company_name_en || product.brand_name
                  const certs = [
                    (product.beauty_suppliers as SupplierInfo | null)?.fda_status === "등록 완료" && "FDA",
                    (product.beauty_suppliers as SupplierInfo | null)?.iso_22716 && "ISO 22716",
                    (product.beauty_suppliers as SupplierInfo | null)?.vegan_certified && "Vegan",
                    (product.beauty_suppliers as SupplierInfo | null)?.cruelty_free_certified && "Cruelty-Free",
                  ].filter(Boolean) as string[]

                  return (
                    <div
                      key={product.id}
                      className="flex items-start justify-between gap-4 px-4 py-3.5 border border-[#E8E2DA] rounded-xl bg-[#FAFAF9] hover:bg-white transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-sm font-semibold text-[#0F0F0F] truncate">{product.brand_name}</span>
                          <span className="text-xs text-[#6B6B6B]">·</span>
                          <span className="text-xs text-[#6B6B6B] truncate">{supplierName}</span>
                          <span
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full capitalize"
                            style={{ background: "#F0EDE8", color: "#6B6B6B" }}
                          >
                            {product.category}
                          </span>
                          {supplierRatings.has(product.supplier_id) && (() => {
                            const r = supplierRatings.get(product.supplier_id)!
                            return (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: "#FEF9C3", color: "#854D0E" }}>
                                ★ {r.avg.toFixed(1)} ({r.count})
                              </span>
                            )
                          })()}
                        </div>
                        <p className="text-sm text-[#0F0F0F] truncate">{product.product_name_en}</p>
                        <p className="text-xs text-[#6B6B6B] truncate">{product.product_name_ko}</p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {(product.price_range_min || product.price_range_max) && (
                            <span className="text-xs font-medium" style={{ color: GOLD }}>
                              {formatPrice(product.price_range_min, product.price_range_max)}
                            </span>
                          )}
                          {product.moq && (
                            <span className="text-xs text-[#6B6B6B]">MOQ: {product.moq.toLocaleString()}</span>
                          )}
                          {certs.length > 0 && (
                            <div className="flex gap-1">
                              {certs.map((cert) => (
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

                      {/* 버튼 그룹 */}
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        {/* Request Sourcing */}
                        <button
                          onClick={() => handleRequestSourcing(product)}
                          disabled={alreadySourcing || isSubmitting}
                          className={cn(
                            "text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1",
                            alreadySourcing
                              ? "bg-[#F8F7F5] text-[#6B6B6B] border border-[#E8E2DA] cursor-default"
                              : "text-white"
                          )}
                          style={!alreadySourcing ? { background: GOLD } : {}}
                        >
                          {isSubmitting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : alreadySourcing ? (
                            "Requested"
                          ) : (
                            <>Request Sourcing <ChevronRight className="w-3 h-3" /></>
                          )}
                        </button>

                        {/* Request Sample */}
                        <button
                          onClick={() => { setSampleModalProduct(product); setSampleQty(1); setSampleMsg("") }}
                          disabled={alreadySample}
                          className={cn(
                            "text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1 border",
                            alreadySample
                              ? "bg-[#F8F7F5] text-[#6B6B6B] border-[#E8E2DA] cursor-default"
                              : "bg-white"
                          )}
                          style={!alreadySample ? { borderColor: GOLD_LIGHT, color: GOLD } : {}}
                        >
                          <FlaskConical className="w-3 h-3" />
                          {alreadySample ? "Sample Sent" : "Request Sample"}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* ④ 수익 계산기 */}
          <section id="calculator" className="bg-white border border-[#E8E2DA] rounded-xl p-6 mb-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-4 h-4" style={{ color: GOLD }} />
              <h2 className="text-base font-bold text-[#0F0F0F]">Profit Calculator</h2>
              <span className="text-xs text-[#6B6B6B] ml-1">1 USD ≈ ₩{exchangeRate.toLocaleString()}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-xs font-medium text-[#6B6B6B] mb-1.5">Export Price (USD)</label>
                <input type="number" min="0" step="0.01" value={exportPrice} onChange={(e) => setExportPrice(e.target.value)} placeholder="e.g. 8.50" className={inputBase + " w-full"} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6B6B6B] mb-1.5">Import Tariff (%)</label>
                <input type="number" min="0" max="100" step="0.1" value={tariffRate} onChange={(e) => setTariffRate(e.target.value)} placeholder="e.g. 6.5" className={inputBase + " w-full"} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6B6B6B] mb-1.5">Platform Fee (%) <span className="font-normal">Amazon ~15%, TikTok ~8%</span></label>
                <input type="number" min="0" max="100" step="0.1" value={platformFee} onChange={(e) => setPlatformFee(e.target.value)} placeholder="e.g. 15" className={inputBase + " w-full"} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6B6B6B] mb-1.5">Selling Price (USD)</label>
                <input type="number" min="0" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} placeholder="e.g. 24.99" className={inputBase + " w-full"} />
              </div>
            </div>

            {calcResult ? (
              <div className="rounded-xl border border-[#E8E2DA] overflow-hidden">
                <div className="px-5 py-3 border-b border-[#E8E2DA] bg-[#F8F7F5]">
                  <p className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wider">Estimate</p>
                </div>
                <div className="divide-y divide-[#E8E2DA]">
                  {[
                    { label: "Landed Cost", usd: calcResult.landedCost },
                    { label: "Platform Fee", usd: calcResult.platformCut },
                    { label: "Net Revenue", usd: calcResult.netRevenue },
                  ].map(({ label, usd }) => (
                    <div key={label} className="flex items-center justify-between px-5 py-2.5">
                      <span className="text-sm text-[#6B6B6B]">{label}</span>
                      <div className="text-right">
                        <span className="text-sm font-medium text-[#0F0F0F]">{formatUSD(usd)}</span>
                        <span className="text-xs text-[#6B6B6B] ml-2">{formatKRW(usd)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm font-semibold text-[#0F0F0F]">Gross Margin</span>
                    <div className="text-right">
                      <span
                        className="text-base font-bold"
                        style={{ color: calcResult.margin >= 0 ? "#16a34a" : "#dc2626" }}
                      >
                        {formatUSD(calcResult.margin)}
                        <span className="text-sm ml-1.5">({calcResult.marginRate.toFixed(1)}%)</span>
                      </span>
                      <p className="text-xs text-[#6B6B6B] mt-0.5">{formatKRW(calcResult.margin)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-[#E8E2DA] bg-[#F8F7F5] py-8 text-center">
                <p className="text-sm text-[#6B6B6B]">Enter export price and selling price to calculate margins.</p>
              </div>
            )}
          </section>

          {/* ⑤ 경쟁 제품 비교 */}
          <section className="bg-white border border-[#E8E2DA] rounded-xl p-6 mb-8 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-4 h-4" style={{ color: GOLD }} />
              <h2 className="text-base font-bold text-[#0F0F0F]">Product Comparison</h2>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              {CATEGORY_FILTERS.filter(c => c.value).map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCompCategory(cat.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    compCategory === cat.value
                      ? "text-white border-transparent"
                      : "bg-white border-[#E8E2DA] text-[#6B6B6B] hover:border-[#C8A882]/60"
                  )}
                  style={compCategory === cat.value ? { background: GOLD, borderColor: GOLD } : {}}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {!compCategory ? (
              <p className="text-sm text-[#6B6B6B] py-6 text-center">Select a category to compare products.</p>
            ) : compProducts.length === 0 ? (
              <p className="text-sm text-[#6B6B6B] py-6 text-center">No products in this category yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#E8E2DA]">
                      <th className="text-left text-xs font-semibold text-[#6B6B6B] py-2 pr-4 w-28">Field</th>
                      {compProducts.map((p) => (
                        <th key={p.id} className="text-left text-xs font-semibold text-[#0F0F0F] py-2 px-3 max-w-[140px]">
                          <div className="truncate">{p.brand_name}</div>
                          <div className="text-[10px] font-normal text-[#6B6B6B] truncate">{p.product_name_en}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E2DA]">
                    {[
                      {
                        label: "Export Price",
                        render: (p: Product) => formatPrice(p.price_range_min, p.price_range_max),
                      },
                      {
                        label: "MOQ",
                        render: (p: Product) => p.moq ? `${p.moq.toLocaleString()} units` : "—",
                      },
                      {
                        label: "Lead Time",
                        render: (p: Product) => p.lead_time_days ? `${p.lead_time_days} days` : "—",
                      },
                      {
                        label: "Certifications",
                        render: (p: Product) => {
                          const certs: string[] = []
                          if ((p.beauty_suppliers as SupplierInfo | null)?.fda_status === "등록 완료") certs.push("FDA")
                          if ((p.beauty_suppliers as SupplierInfo | null)?.iso_22716) certs.push("ISO")
                          if ((p.beauty_suppliers as SupplierInfo | null)?.vegan_certified) certs.push("Vegan")
                          if ((p.beauty_suppliers as SupplierInfo | null)?.cruelty_free_certified) certs.push("CF")
                          return certs.length ? certs.join(" · ") : "—"
                        },
                      },
                      {
                        label: "Consumer Price",
                        render: (p: Product) => p.consumer_price_krw ? `₩${p.consumer_price_krw.toLocaleString()}` : "—",
                      },
                    ].map(({ label, render }) => (
                      <tr key={label}>
                        <td className="text-xs text-[#6B6B6B] py-2.5 pr-4 font-medium">{label}</td>
                        {compProducts.map((p) => (
                          <td key={p.id} className="text-xs text-[#0F0F0F] py-2.5 px-3">{render(p)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>
      </main>

      {/* 샘플 요청 모달 */}
      {sampleModalProduct && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
          onClick={() => { if (!submittingSample) { setSampleModalProduct(null); setSampleQty(1); setSampleMsg("") } }}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#0F0F0F]">Request Sample</h3>
                <p className="text-xs text-[#6B6B6B] mt-0.5 truncate max-w-[280px]">
                  {sampleModalProduct.brand_name} · {sampleModalProduct.product_name_en}
                </p>
              </div>
              <button
                onClick={() => { setSampleModalProduct(null); setSampleQty(1); setSampleMsg("") }}
                disabled={submittingSample}
                className="text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#6B6B6B] mb-1.5">Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={sampleQty}
                  onChange={(e) => setSampleQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className={inputBase + " w-full"}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6B6B6B] mb-1.5">
                  Message <span className="font-normal">(optional)</span>
                </label>
                <textarea
                  value={sampleMsg}
                  onChange={(e) => setSampleMsg(e.target.value)}
                  placeholder="Tell the supplier what you need..."
                  rows={3}
                  className={inputBase + " w-full resize-none"}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setSampleModalProduct(null); setSampleQty(1); setSampleMsg("") }}
                disabled={submittingSample}
                className="flex-1 text-sm font-medium py-2.5 rounded-lg border border-[#E8E2DA] text-[#6B6B6B] hover:bg-[#F8F7F5] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestSample}
                disabled={submittingSample}
                className="flex-1 text-sm font-semibold py-2.5 rounded-lg text-white transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: GOLD }}
              >
                {submittingSample ? "Sending..." : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {ratingModalSourcing && (
        <RatingModal
          open={true}
          onClose={() => setRatingModalSourcing(null)}
          supplierId={ratingModalSourcing.supplier_id}
          supplierName={
            ratingModalSourcing.beauty_suppliers?.company_name_en ||
            ratingModalSourcing.beauty_suppliers?.company_name_ko ||
            "Supplier"
          }
          reviewerType="seller"
          referenceType="sourcing"
          referenceId={ratingModalSourcing.id}
          onSuccess={() => setRatedSourcingIds((prev) => new Set([...prev, ratingModalSourcing.id]))}
        />
      )}
    </div>
  )
}
