"use client"

import { type ReactNode, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Search,
  Handshake,
  Settings,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ChevronRight,
  Loader2,
  RefreshCcw,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { ExchangeRateBadge } from "@/components/kbeauty/ExchangeRateBadge"
import { cn } from "@/lib/utils"

// ─── 타입 ──────────────────────────────────────────────────────────────────

interface Buyer {
  id: string
  company_name: string
  country: string
  stage1_approved: boolean
  stage2_approved: boolean
  status: string
  categories: string[] | null
  annual_import_volume: string | null
  handling_korean_products: boolean | null
  known_suppliers: string | null
  state: string | null
}

interface Product {
  id: string
  supplier_id: string
  product_name_ko: string
  product_name_en: string
  brand_name: string
  category: string
  certifications: string[] | null
  moq: number | null
  price_range_min: number | null
  price_range_max: number | null
  status: string
  beauty_suppliers: { company_name_en: string; company_name_ko: string } | null
}

interface Match {
  id: string
  supplier_id: string
  product_id: string | null
  status: string
  requested_at: string
  beauty_suppliers: { company_name_en: string; company_name_ko: string; contact_email: string | null } | null
}

interface PostService {
  id: string
  match_id: string
  service_type: string
  status: string
  created_at: string
  beauty_matches: {
    beauty_suppliers: { company_name_en: string } | null
    beauty_products: { product_name_en: string } | null
  } | null
}

// ─── 상수 ──────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/kbeauty/dashboard/buyer" },
  { label: "Discover", icon: Search, href: "#discover" },
  { label: "My Matches", icon: Handshake, href: "#matches" },
  { label: "Settings", icon: Settings, href: "/kbeauty/dashboard/buyer/settings" },
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

const MATCH_STATUS_MAP: Record<string, { label: string; icon: ReactNode; className: string }> = {
  requested: {
    label: "Pending",
    icon: <Clock className="w-3 h-3" />,
    className: "text-amber-700 bg-amber-50 border-amber-200",
  },
  stage2_pending: {
    label: "Under Review",
    icon: <RefreshCcw className="w-3 h-3" />,
    className: "text-blue-700 bg-blue-50 border-blue-200",
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
    icon: <CheckCircle2 className="w-3 h-3" />,
    className: "text-[#6B6B6B] bg-[#F8F7F5] border-[#E8E2DA]",
  },
}

// ─── 사이드바 ──────────────────────────────────────────────────────────────

function Sidebar({ companyName, approved }: { companyName: string; approved: boolean }) {
  return (
    <aside
      className="fixed top-0 left-0 h-screen bg-white border-r border-[#E8E2DA] flex flex-col"
      style={{ width: 240 }}
    >
      <div className="px-6 py-5 border-b border-[#E8E2DA]">
        <Link href="/kbeauty" className="flex items-center gap-1">
          <span className="font-bold text-[#0F0F0F] text-sm">UnfoldK Beauty</span>
          <span className="text-[#C8A882] text-xs">&#9670;</span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#6B6B6B] hover:bg-[#F8F7F5] hover:text-[#0F0F0F] transition-colors"
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {item.label}
          </a>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-[#E8E2DA]">
        <p className="text-xs font-medium text-[#0F0F0F] truncate">{companyName || "—"}</p>
        <div className="mt-1">
          {approved ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              Approved
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-[#6B6B6B] bg-[#F8F7F5] px-2 py-0.5 rounded-full border border-[#E8E2DA]">
              <Clock className="w-3 h-3" />
              Pending Approval
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

// ─── 상태 배지 ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config = MATCH_STATUS_MAP[status] ?? MATCH_STATUS_MAP["requested"]
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${config.className}`}
    >
      {config.icon}
      {config.label}
    </span>
  )
}

// ─── 메인 페이지 ───────────────────────────────────────────────────────────

export default function BuyerDashboardPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [buyer, setBuyer] = useState<Buyer | null>(null)
  const [loading, setLoading] = useState(true)

  // 요약 카운트
  const [pendingCount, setPendingCount] = useState(0)
  const [approvedCount, setApprovedCount] = useState(0)
  const [serviceCount, setServiceCount] = useState(0)
  const [sampleRequestCount, setSampleRequestCount] = useState(0)

  // 제품 목록
  const [products, setProducts] = useState<Product[]>([])
  const [categoryFilter, setCategoryFilter] = useState("")
  const [loadingProducts, setLoadingProducts] = useState(false)

  // 요청 중 공급사 ID 목록 (중복 방지)
  const [requestedSupplierIds, setRequestedSupplierIds] = useState<Set<string>>(new Set())
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  // 매칭 목록
  const [matches, setMatches] = useState<Match[]>([])
  const [matchTab, setMatchTab] = useState<"all" | "pending" | "approved" | "rejected">("all")

  // Post-Matching 서비스
  const [services, setServices] = useState<PostService[]>([])

  // ─── 데이터 로드 ─────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/kbeauty/buyer/login"); return }

      const { data: buyerData } = await supabase
        .from("beauty_buyers")
        .select("id, company_name, country, stage1_approved, stage2_approved, status, categories, annual_import_volume, handling_korean_products, known_suppliers, state")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!buyerData) { router.push("/kbeauty/buyer/register"); return }
      setBuyer(buyerData)

      const buyerId = buyerData.id

      // 매칭 목록
      const { data: matchData } = await supabase
        .from("beauty_matches")
        .select("id, supplier_id, product_id, status, requested_at, beauty_suppliers(company_name_en, company_name_ko, contact_email)")
        .eq("buyer_id", buyerId)
        .order("requested_at", { ascending: false })

      const safeMatches = (matchData as Match[]) ?? []
      setMatches(safeMatches)

      // 요약 카운트
      setPendingCount(safeMatches.filter((m) => m.status === "requested" || m.status === "stage2_pending").length)
      setApprovedCount(safeMatches.filter((m) => m.status === "approved").length)

      // 요청한 공급사 ID 셋
      setRequestedSupplierIds(new Set(safeMatches.map((m) => m.supplier_id)))

      // Post-Matching 서비스 (match_id 목록으로 조회)
      const matchIds = safeMatches.map((m) => m.id)
      if (matchIds.length > 0) {
        const { data: svcData } = await supabase
          .from("beauty_post_matching_services")
          .select("id, match_id, service_type, status, created_at, beauty_matches(beauty_suppliers(company_name_en), beauty_products(product_name_en))")
          .in("match_id", matchIds)
          .order("created_at", { ascending: false })

        const safeServices = (svcData as PostService[]) ?? []
        setServices(safeServices)
        setServiceCount(safeServices.length)
      }

      // 샘플 요청 수
      const { count: sampleCount } = await supabase
        .from("beauty_post_matching_services")
        .select("id", { count: "exact", head: true })
        .eq("buyer_id", buyerId)
        .eq("service_type", "sample")
      setSampleRequestCount(sampleCount ?? 0)

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── 제품 목록 (카테고리 필터) ────────────────────────────────────────────

  useEffect(() => {
    if (!buyer) return
    setLoadingProducts(true)

    const query = supabase
      .from("beauty_products")
      .select("id, supplier_id, product_name_ko, product_name_en, brand_name, category, certifications, moq, price_range_min, price_range_max, status, beauty_suppliers(company_name_en, company_name_ko)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(30)

    const filtered = categoryFilter
      ? query.eq("category", categoryFilter)
      : query

    filtered.then(({ data }) => {
      setProducts((data as Product[]) ?? [])
      setLoadingProducts(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyer, categoryFilter])

  // ─── 매칭 요청 ────────────────────────────────────────────────────────────

  const handleRequestMatch = async (product: Product) => {
    if (!buyer) return
    if (!buyer.stage1_approved) {
      toast.error("Your account is pending approval. You can request matches once approved.")
      return
    }

    setSubmittingId(product.supplier_id)
    const { error } = await supabase.from("beauty_matches").insert({
      buyer_id: buyer.id,
      supplier_id: product.supplier_id,
      product_id: product.id,
      status: "requested",
    })

    if (error) {
      toast.error("Something went wrong. Please try again.")
    } else {
      setRequestedSupplierIds((prev) => new Set([...prev, product.supplier_id]))
      setMatches((prev) => [
        {
          id: crypto.randomUUID(),
          supplier_id: product.supplier_id,
          product_id: product.id,
          status: "requested",
          requested_at: new Date().toISOString(),
          beauty_suppliers: product.beauty_suppliers,
        },
        ...prev,
      ])
      setPendingCount((c) => c + 1)
      toast.success("Matching request sent successfully")
    }
    setSubmittingId(null)
  }

  // ─── 필터된 매칭 목록 ─────────────────────────────────────────────────────

  const filteredMatches = matches.filter((m) => {
    if (matchTab === "all") return true
    if (matchTab === "pending") return m.status === "requested" || m.status === "stage2_pending"
    if (matchTab === "approved") return m.status === "approved"
    if (matchTab === "rejected") return m.status === "rejected"
    return true
  })

  // ─── 가격 표시 헬퍼 ───────────────────────────────────────────────────────

  const formatPrice = (min: number | null, max: number | null) => {
    if (!min && !max) return "—"
    if (min && max) return `$${min}–$${max}`
    if (min) return `From $${min}`
    return `Up to $${max}`
  }

  // ─── 날짜 헬퍼 ───────────────────────────────────────────────────────────

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  const formatServiceType = (type: string) => {
    const map: Record<string, string> = {
      contract_template_download: "Contract Template",
      logistics_referral: "Logistics Referral",
      insight_report: "Insight Report",
    }
    return map[type] ?? type
  }

  // ─── 로딩 ─────────────────────────────────────────────────────────────────

  const profileIncomplete = buyer !== null && (
    !buyer.categories?.length ||
    !buyer.annual_import_volume ||
    buyer.handling_korean_products === null ||
    !buyer.known_suppliers ||
    !buyer.state
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F7F5] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#1A3A5C]" />
      </div>
    )
  }

  const inputBase =
    "text-sm border border-[#E8E2DA] rounded-lg px-4 py-2.5 bg-white focus:outline-none focus:border-[#C8A882] transition-colors"

  return (
    <div
      className="min-h-screen bg-[#F8F7F5]"
      style={{ fontFamily: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
    >
      <Toaster position="top-right" richColors />
      <Sidebar companyName={buyer?.company_name ?? ""} approved={buyer?.stage1_approved ?? false} />

      <main className="min-h-screen" style={{ marginLeft: 240 }}>
        <div className="max-w-4xl mx-auto px-8 py-10">

          {/* ① 헤더 */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1
                className="text-[#0F0F0F]"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: 28, fontWeight: 600, lineHeight: 1.2 }}
              >
                Welcome, {buyer?.company_name}
              </h1>
              {!buyer?.stage1_approved && (
                <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Your account is under review. Supplier access will unlock after approval.
                </p>
              )}
            </div>
            <ExchangeRateBadge />
          </div>

          {/* 프로필 미완성 배너 */}
          {profileIncomplete && (
            <div
              className="flex items-center justify-between px-5 py-3 mb-6 rounded-xl cursor-pointer"
              style={{ background: "#FEF3C7", border: "1px solid #F59E0B" }}
              onClick={() => router.push("/kbeauty/dashboard/buyer/profile")}
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                <p className="text-sm text-amber-800 font-medium">
                  Complete your profile to get better supplier matches →
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-700 flex-shrink-0" />
            </div>
          )}

          {/* ② 요약 카드 */}
          <div className="flex gap-4 mb-8">
            <SummaryCard label="Total Matches" value={matches.length} />
            <SummaryCard label="Approved Matches" value={approvedCount} />
            <SummaryCard label="Sample Requests" value={sampleRequestCount} />
            <SummaryCard label="Approval Rate" value={matches.length > 0 ? `${(approvedCount / matches.length * 100).toFixed(1)}%` : "—"} />
          </div>

          {/* 미승인 배너 */}
          {!buyer?.stage1_approved && (
            <div
              className="flex items-center justify-between px-6 py-4 mb-8 rounded-xl"
              style={{ background: "#1A3A5C" }}
            >
              <p className="text-white text-sm font-medium">
                Account approval is required to access verified supplier database.
              </p>
              <span className="text-sm font-semibold px-4 py-2 rounded-md text-[#0F0F0F]" style={{ background: "#C8A882" }}>
                Under Review
              </span>
            </div>
          )}

          {/* ③ Discover Suppliers */}
          <section id="discover" className="bg-white border border-[#E8E2DA] rounded-xl p-6 mb-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <h2 className="text-base font-bold text-[#0F0F0F] mb-4">Discover Suppliers</h2>

            {/* 카테고리 필터 */}
            <div className="flex flex-wrap gap-2 mb-5">
              {CATEGORY_FILTERS.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategoryFilter(cat.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    categoryFilter === cat.value
                      ? "bg-[#1A3A5C] border-[#1A3A5C] text-white"
                      : "bg-white border-[#E8E2DA] text-[#6B6B6B] hover:border-[#1A3A5C]/40"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {loadingProducts ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-[#1A3A5C]" />
              </div>
            ) : products.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-[#6B6B6B]">
                  {buyer?.stage1_approved
                    ? "No products found in this category."
                    : "Supplier database access unlocks after account approval."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {products.map((product) => {
                  const alreadyRequested = requestedSupplierIds.has(product.supplier_id)
                  const isSubmitting = submittingId === product.supplier_id
                  const supplierName =
                    product.beauty_suppliers?.company_name_en || product.brand_name

                  return (
                    <div
                      key={product.id}
                      className="flex items-center justify-between gap-4 px-4 py-3.5 border border-[#E8E2DA] rounded-xl bg-[#FAFAF9] hover:bg-white transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-sm font-semibold text-[#0F0F0F] truncate">
                            {product.brand_name}
                          </span>
                          <span className="text-xs text-[#6B6B6B]">·</span>
                          <span className="text-xs text-[#6B6B6B] truncate">{supplierName}</span>
                          <span
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full capitalize"
                            style={{ background: "#F0EDE8", color: "#6B6B6B" }}
                          >
                            {product.category}
                          </span>
                        </div>
                        <p className="text-sm text-[#0F0F0F] truncate">{product.product_name_en}</p>
                        <p className="text-xs text-[#6B6B6B] truncate">{product.product_name_ko}</p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {(product.price_range_min || product.price_range_max) && (
                            <span className="text-xs text-[#1A3A5C] font-medium">
                              {formatPrice(product.price_range_min, product.price_range_max)}
                            </span>
                          )}
                          {product.moq && (
                            <span className="text-xs text-[#6B6B6B]">MOQ: {product.moq.toLocaleString()}</span>
                          )}
                          {product.certifications && product.certifications.length > 0 && (
                            <div className="flex gap-1">
                              {product.certifications.slice(0, 3).map((cert) => (
                                <span
                                  key={cert}
                                  className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#1A3A5C]/[0.08] text-[#1A3A5C]"
                                >
                                  {cert}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRequestMatch(product)}
                        disabled={alreadyRequested || isSubmitting}
                        className={cn(
                          "flex-shrink-0 text-xs font-semibold px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-1.5",
                          alreadyRequested
                            ? "bg-[#F8F7F5] text-[#6B6B6B] border border-[#E8E2DA] cursor-default"
                            : "bg-[#1A3A5C] text-white hover:bg-[#153249]"
                        )}
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : alreadyRequested ? (
                          "Requested"
                        ) : (
                          <>Request Match <ChevronRight className="w-3 h-3" /></>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* View All 링크 */}
            <div className="mt-4 pt-4 border-t border-[#E8E2DA] flex justify-end">
              <Link
                href="/kbeauty/dashboard/buyer/suppliers"
                className="text-xs font-medium text-[#1A3A5C] hover:underline inline-flex items-center gap-1"
              >
                View All Suppliers
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>

          {/* ④ Matching Status */}
          <section id="matches" className="bg-white border border-[#E8E2DA] rounded-xl p-6 mb-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <h2 className="text-base font-bold text-[#0F0F0F] mb-4">Matching Status</h2>

            {/* 탭 */}
            <div className="flex gap-6 border-b border-[#E8E2DA] mb-4">
              {(["all", "pending", "approved", "rejected"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setMatchTab(tab)}
                  className={cn(
                    "text-sm font-medium pb-3 capitalize transition-colors border-b-2",
                    matchTab === tab
                      ? "text-[#1A3A5C] border-[#1A3A5C]"
                      : "text-[#6B6B6B] border-transparent hover:text-[#0F0F0F]"
                  )}
                >
                  {tab === "all" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {filteredMatches.length === 0 ? (
              <p className="text-sm text-[#6B6B6B] py-6 text-center">No matching requests yet.</p>
            ) : (
              <div className="space-y-2">
                {filteredMatches.map((match) => {
                  const supplierName =
                    match.beauty_suppliers?.company_name_en ||
                    match.beauty_suppliers?.company_name_ko ||
                    "Unknown Supplier"
                  return (
                    <div
                      key={match.id}
                      className="flex items-center justify-between gap-4 px-4 py-3 border border-[#E8E2DA] rounded-xl"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#0F0F0F] truncate">{supplierName}</p>
                        <p className="text-xs text-[#6B6B6B] mt-0.5">{formatDate(match.requested_at)}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <StatusBadge status={match.status} />
                        {match.status === "approved" && match.beauty_suppliers?.contact_email && (
                          <a
                            href={`mailto:${match.beauty_suppliers.contact_email}`}
                            className="text-xs font-medium text-[#1A3A5C] bg-[#1A3A5C]/[0.08] px-3 py-1.5 rounded-lg hover:bg-[#1A3A5C]/[0.15] transition-colors"
                          >
                            View Contact
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* ⑤ Post-Matching Services */}
          <section className="bg-white border border-[#E8E2DA] rounded-xl p-6 mb-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <h2 className="text-base font-bold text-[#0F0F0F] mb-4">Post-Matching Services</h2>

            {services.length === 0 ? (
              <p className="text-sm text-[#6B6B6B] py-4 text-center">
                No services available yet. Services unlock after your first approved match.
              </p>
            ) : (
              <div className="space-y-2">
                {services.map((svc) => {
                  const supplierName = svc.beauty_matches?.beauty_suppliers?.company_name_en ?? "—"
                  const productName = svc.beauty_matches?.beauty_products?.product_name_en ?? "—"
                  return (
                    <div
                      key={svc.id}
                      className="flex items-center justify-between gap-4 px-4 py-3 border border-[#E8E2DA] rounded-xl"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#0F0F0F]">{formatServiceType(svc.service_type)}</p>
                        <p className="text-xs text-[#6B6B6B] mt-0.5 truncate">
                          {supplierName} · {productName}
                        </p>
                        <p className="text-xs text-[#6B6B6B] mt-0.5">{formatDate(svc.created_at)}</p>
                      </div>
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full border",
                          svc.status === "completed"
                            ? "text-green-700 bg-green-50 border-green-200"
                            : svc.status === "pending"
                            ? "text-amber-700 bg-amber-50 border-amber-200"
                            : "text-red-600 bg-red-50 border-red-200"
                        )}
                      >
                        {svc.status.charAt(0).toUpperCase() + svc.status.slice(1)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* ⑥ Saved Suppliers */}
          <section className="bg-white border border-[#E8E2DA] rounded-xl p-6 mb-10 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <h2 className="text-base font-bold text-[#0F0F0F] mb-2">Saved Suppliers</h2>
            <div className="py-8 text-center">
              <p className="text-sm text-[#6B6B6B]">Coming Soon</p>
              <p className="text-xs text-[#A09080] mt-1">
                Bookmark suppliers and track them here.
              </p>
            </div>
          </section>

        </div>
      </main>
    </div>
  )
}
