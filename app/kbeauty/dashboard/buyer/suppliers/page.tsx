"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Search,
  Handshake,
  Settings,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  FlaskConical,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { ExchangeRateBadge } from "@/components/kbeauty/ExchangeRateBadge"
import { cn } from "@/lib/utils"

// ─── 타입 ──────────────────────────────────────────────────────────────────

interface Buyer {
  id: string
  company_name: string
  stage1_approved: boolean
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
  lead_time_days: number | null
  consumer_price_krw: number | null
  status: string
  beauty_suppliers: { company_name_en: string; company_name_ko: string } | null
}

// ─── 상수 ──────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/kbeauty/dashboard/buyer" },
  { label: "Discover", icon: Search, href: "/kbeauty/dashboard/buyer/suppliers" },
  { label: "My Matches", icon: Handshake, href: "/kbeauty/dashboard/buyer#matches" },
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

const CERT_OPTIONS = ["CPNP", "FDA", "ISO22716", "KFDA"]

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
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
              item.href === "/kbeauty/dashboard/buyer/suppliers"
                ? "bg-[#C8A882]/10 text-[#8B6F47] font-medium"
                : "text-[#6B6B6B] hover:bg-[#F8F7F5] hover:text-[#0F0F0F]"
            )}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {item.label}
          </Link>
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

// ─── 메인 페이지 ───────────────────────────────────────────────────────────

export default function BuyerSuppliersPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [buyer, setBuyer] = useState<Buyer | null>(null)
  const [loading, setLoading] = useState(true)

  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  const [categoryFilter, setCategoryFilter] = useState("")
  const [keyword, setKeyword] = useState("")
  const [selectedCerts, setSelectedCerts] = useState<string[]>([])

  const [requestedSupplierIds, setRequestedSupplierIds] = useState<Set<string>>(new Set())
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  // 샘플 요청
  const [userId, setUserId] = useState<string>("")
  const [userEmail, setUserEmail] = useState<string>("")
  const [requestedSampleProductIds, setRequestedSampleProductIds] = useState<Set<string>>(new Set())
  const [sampleModalProduct, setSampleModalProduct] = useState<Product | null>(null)
  const [sampleQty, setSampleQty] = useState(1)
  const [sampleMsg, setSampleMsg] = useState("")
  const [submittingSample, setSubmittingSample] = useState(false)

  // ─── 인증 및 바이어 정보 로드 ───────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/kbeauty/buyer/login"); return }

      setUserId(user.id)
      setUserEmail(user.email ?? "")

      const { data: buyerData } = await supabase
        .from("beauty_buyers")
        .select("id, company_name, stage1_approved")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!buyerData) { router.push("/kbeauty/buyer/register"); return }
      setBuyer(buyerData)

      // 이미 요청한 공급사 ID 셋
      const { data: matchData } = await supabase
        .from("beauty_matches")
        .select("supplier_id")
        .eq("buyer_id", buyerData.id)

      setRequestedSupplierIds(new Set((matchData ?? []).map((m: { supplier_id: string }) => m.supplier_id)))

      // 이미 샘플 요청한 제품 ID 셋 (buyer_id = auth.users.id)
      const { data: sampleData } = await supabase
        .from("beauty_post_matching_services")
        .select("product_id")
        .eq("buyer_id", user.id)
        .eq("service_type", "sample")

      setRequestedSampleProductIds(
        new Set(
          (sampleData ?? [])
            .filter((s: { product_id: string | null }) => s.product_id)
            .map((s: { product_id: string | null }) => s.product_id as string)
        )
      )

      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── 제품 목록 (카테고리 변경 시 서버 재조회) ───────────────────────────

  useEffect(() => {
    if (!buyer) return
    setLoadingProducts(true)

    let query = supabase
      .from("beauty_products")
      .select(
        "id, supplier_id, product_name_ko, product_name_en, brand_name, category, certifications, moq, price_range_min, price_range_max, lead_time_days, consumer_price_krw, status, beauty_suppliers(company_name_en, company_name_ko)"
      )
      .in("status", ["active", "pending"])
      .order("created_at", { ascending: false })
      .limit(200)

    if (categoryFilter) {
      query = query.eq("category", categoryFilter)
    }

    query.then(({ data }) => {
      setProducts((data as Product[]) ?? [])
      setLoadingProducts(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyer, categoryFilter])

  // ─── 클라이언트 필터 (키워드 + 인증) ────────────────────────────────────

  const filteredProducts = useMemo(() => {
    let list = products
    if (keyword.trim()) {
      const kw = keyword.toLowerCase()
      list = list.filter(
        (p) =>
          p.brand_name.toLowerCase().includes(kw) ||
          p.product_name_en.toLowerCase().includes(kw)
      )
    }
    if (selectedCerts.length > 0) {
      list = list.filter(
        (p) => p.certifications && selectedCerts.some((c) => p.certifications!.includes(c))
      )
    }
    return list
  }, [products, keyword, selectedCerts])

  // ─── 인증 토글 ──────────────────────────────────────────────────────────

  const toggleCert = (cert: string) => {
    setSelectedCerts((prev) =>
      prev.includes(cert) ? prev.filter((c) => c !== cert) : [...prev, cert]
    )
  }

  // ─── 매칭 요청 ─────────────────────────────────────────────────────────

  const handleRequestMatch = async (product: Product) => {
    if (!buyer) return
    if (!buyer.stage1_approved) {
      toast.error("Your account is pending approval. Matching requests unlock after approval.")
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
      toast.success("Matching request sent successfully")
    }
    setSubmittingId(null)
  }

  // ─── 샘플 요청 제출 ─────────────────────────────────────────────────────

  const handleRequestSample = async () => {
    if (!sampleModalProduct || !userId || !buyer) return
    if (!buyer.stage1_approved) {
      toast.error("Your account is pending approval. Sample requests unlock after approval.")
      return
    }
    setSubmittingSample(true)
    const { error } = await supabase.from("beauty_post_matching_services").insert({
      buyer_id: userId,
      product_id: sampleModalProduct.id,
      supplier_id: sampleModalProduct.supplier_id,
      service_type: "sample",
      status: "pending",
      quantity: sampleQty,
      message: sampleMsg.trim() || null,
      buyer_email: userEmail,
    })
    if (error) {
      toast.error("Something went wrong. Please try again.")
    } else {
      setRequestedSampleProductIds((prev) => new Set([...prev, sampleModalProduct.id]))
      setSampleModalProduct(null)
      setSampleQty(1)
      setSampleMsg("")
      toast.success("Sample request sent successfully")
    }
    setSubmittingSample(false)
  }

  const closeSampleModal = () => {
    if (submittingSample) return
    setSampleModalProduct(null)
    setSampleQty(1)
    setSampleMsg("")
  }

  // ─── 헬퍼 ──────────────────────────────────────────────────────────────

  const formatPrice = (min: number | null, max: number | null) => {
    if (!min && !max) return null
    if (min && max) return `$${min}–$${max}`
    if (min) return `From $${min}`
    return `Up to $${max}`
  }

  // ─── 로딩 ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F7F5] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#1A3A5C]" />
      </div>
    )
  }

  const isNotApproved = !buyer?.stage1_approved

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
            <div className="flex items-start gap-3">
              <Link
                href="/kbeauty/dashboard/buyer"
                className="mt-0.5 p-2 rounded-lg hover:bg-[#E8E2DA] transition-colors text-[#6B6B6B] hover:text-[#0F0F0F]"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-[#0F0F0F]">Find Korean Beauty Suppliers</h1>
                <p className="text-sm text-[#6B6B6B] mt-0.5">
                  Browse verified K-beauty suppliers and request a match
                </p>
              </div>
            </div>
            <ExchangeRateBadge />
          </div>

          {/* 미승인 배너 */}
          {isNotApproved && (
            <div className="flex items-center gap-3 px-5 py-4 mb-6 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
              <p className="text-sm text-amber-700">
                Your account is pending approval. You&apos;ll be able to browse suppliers once approved.
              </p>
            </div>
          )}

          {/* ② 필터 바 */}
          <div className="bg-white border border-[#E8E2DA] rounded-xl p-5 mb-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] space-y-4">

            {/* 카테고리 칩 */}
            <div className="flex flex-wrap gap-2">
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

            {/* 키워드 검색 */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Search by brand name or product name..."
                className="w-full pl-10 pr-10 py-2.5 border border-[#E8E2DA] rounded-lg text-sm text-[#0F0F0F] placeholder:text-[#6B6B6B]/50 hover:border-[#1A3A5C]/30 focus:border-[#1A3A5C] focus:outline-none transition-colors"
              />
              {keyword && (
                <button
                  onClick={() => setKeyword("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* 인증 필터 */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-medium text-[#6B6B6B] flex-shrink-0">Certifications:</span>
              {CERT_OPTIONS.map((cert) => (
                <button
                  key={cert}
                  onClick={() => toggleCert(cert)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                    selectedCerts.includes(cert)
                      ? "bg-[#1A3A5C]/[0.08] border-[#1A3A5C]/40 text-[#1A3A5C]"
                      : "bg-white border-[#E8E2DA] text-[#6B6B6B] hover:border-[#1A3A5C]/30"
                  )}
                >
                  {cert}
                  {selectedCerts.includes(cert) && (
                    <span className="ml-1 text-[#1A3A5C]">✓</span>
                  )}
                </button>
              ))}
              {selectedCerts.length > 0 && (
                <button
                  onClick={() => setSelectedCerts([])}
                  className="text-xs text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* ③ 제품 카드 리스트 */}
          {loadingProducts ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-5 h-5 animate-spin text-[#1A3A5C]" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-sm text-[#6B6B6B]">
                {isNotApproved
                  ? "Your account is pending approval. You'll be able to browse suppliers once approved."
                  : "No suppliers found. Try adjusting your filters."}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-[#6B6B6B] mb-3">
                {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} found
              </p>
              <div className="space-y-3 pb-10">
                {filteredProducts.map((product) => {
                  const alreadyRequested = requestedSupplierIds.has(product.supplier_id)
                  const isSubmitting = submittingId === product.supplier_id
                  const supplierName =
                    product.beauty_suppliers?.company_name_en || product.brand_name
                  const priceRange = formatPrice(product.price_range_min, product.price_range_max)

                  const alreadySampleRequested = requestedSampleProductIds.has(product.id)

                  return (
                    <div
                      key={product.id}
                      className="bg-white border border-[#E8E2DA] rounded-xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.05)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* 제품 정보 */}
                        <div className="min-w-0 flex-1">
                          {/* 브랜드 + 인증 배지 */}
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-bold text-[#0F0F0F]">{product.brand_name}</span>
                            {product.beauty_suppliers && (
                              <>
                                <span className="text-xs text-[#6B6B6B]">·</span>
                                <span className="text-xs text-[#6B6B6B] truncate">{supplierName}</span>
                              </>
                            )}
                            {product.certifications && product.certifications.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {product.certifications.map((cert) => (
                                  <span
                                    key={cert}
                                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#1A3A5C]/[0.08] text-[#1A3A5C]"
                                  >
                                    {cert}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 제품명 */}
                          <p className="text-[15px] font-semibold text-[#0F0F0F] mb-0.5">{product.product_name_en}</p>
                          <p className="text-xs text-[#6B6B6B] mb-3">{product.product_name_ko}</p>

                          {/* 카테고리 칩 */}
                          <span
                            className="inline-block text-[10px] font-medium px-2.5 py-1 rounded-full capitalize mb-3"
                            style={{ background: "#F0EDE8", color: "#6B6B6B" }}
                          >
                            {product.category}
                          </span>

                          {/* 스펙 행 */}
                          <div className="flex items-center gap-4 flex-wrap text-xs">
                            {priceRange && (
                              <div>
                                <span className="text-[#A09080]">Export Price </span>
                                <span className="font-semibold text-[#1A3A5C]">{priceRange}</span>
                              </div>
                            )}
                            {product.consumer_price_krw && (
                              <div>
                                <span className="text-[#A09080]">Consumer Price </span>
                                <span className="font-medium text-[#6B6B6B]">
                                  ₩{product.consumer_price_krw.toLocaleString("ko-KR")}
                                </span>
                              </div>
                            )}
                            {product.moq && (
                              <div>
                                <span className="text-[#A09080]">MOQ </span>
                                <span className="font-medium text-[#0F0F0F]">{product.moq.toLocaleString()}</span>
                              </div>
                            )}
                            {product.lead_time_days && (
                              <div>
                                <span className="text-[#A09080]">Lead Time </span>
                                <span className="font-medium text-[#0F0F0F]">{product.lead_time_days}d</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* CTA 버튼 그룹 */}
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          {/* Request Match */}
                          <button
                            onClick={() => handleRequestMatch(product)}
                            disabled={alreadyRequested || isSubmitting}
                            className={cn(
                              "text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap",
                              alreadyRequested
                                ? "bg-[#F8F7F5] text-[#6B6B6B] border border-[#E8E2DA] cursor-default"
                                : isSubmitting
                                ? "bg-[#1A3A5C]/70 text-white cursor-not-allowed"
                                : "bg-[#1A3A5C] text-white hover:bg-[#153249]"
                            )}
                          >
                            {isSubmitting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : alreadyRequested ? (
                              "Requested"
                            ) : (
                              <>
                                Request Match
                                <ChevronRight className="w-3.5 h-3.5" />
                              </>
                            )}
                          </button>

                          {/* Request Sample */}
                          <button
                            onClick={() => {
                              setSampleModalProduct(product)
                              setSampleQty(1)
                              setSampleMsg("")
                            }}
                            disabled={alreadySampleRequested}
                            className={cn(
                              "text-xs font-medium px-4 py-2.5 rounded-lg border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap",
                              alreadySampleRequested
                                ? "bg-[#F8F7F5] text-[#6B6B6B] border-[#E8E2DA] cursor-default"
                                : "bg-white border-[#C8A882] text-[#8B6F47] hover:bg-[#C8A882]/[0.08]"
                            )}
                          >
                            <FlaskConical className="w-3.5 h-3.5" />
                            {alreadySampleRequested ? "Sample Requested" : "Request Sample"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </main>

      {/* 샘플 요청 모달 */}
      {sampleModalProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onClick={closeSampleModal}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-[#0F0F0F]">Request a Sample</h3>
                <p className="text-sm text-[#6B6B6B] mt-0.5">
                  {sampleModalProduct.brand_name} · {sampleModalProduct.product_name_en}
                </p>
              </div>
              <button
                onClick={closeSampleModal}
                className="text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 수량 */}
              <div>
                <label className="block text-xs font-semibold text-[#0F0F0F] mb-1.5">
                  Quantity <span className="text-[#6B6B6B] font-normal">(units)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={sampleQty}
                  onChange={(e) => setSampleQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full border border-[#E8E2DA] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1A3A5C] transition-colors"
                />
              </div>

              {/* 메시지 */}
              <div>
                <label className="block text-xs font-semibold text-[#0F0F0F] mb-1.5">
                  Message <span className="text-[#6B6B6B] font-normal">(optional)</span>
                </label>
                <textarea
                  value={sampleMsg}
                  onChange={(e) => setSampleMsg(e.target.value)}
                  rows={3}
                  placeholder="Specify your intended use, target market, or any requirements..."
                  className="w-full border border-[#E8E2DA] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#1A3A5C] transition-colors placeholder:text-[#6B6B6B]/50"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={closeSampleModal}
                disabled={submittingSample}
                className="flex-1 text-sm font-medium px-4 py-2.5 rounded-lg border border-[#E8E2DA] text-[#6B6B6B] hover:bg-[#F8F7F5] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestSample}
                disabled={submittingSample}
                className="flex-1 text-sm font-semibold px-4 py-2.5 rounded-lg text-white transition-opacity hover:opacity-80 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                style={{ background: "#1A3A5C" }}
              >
                {submittingSample ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Submit Request"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
