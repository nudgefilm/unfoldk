"use client"

import { type ReactNode, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  Handshake,
  Settings,
  UserCircle,
  ChevronRight,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  Paperclip,
  Lock,
  Megaphone,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { ExchangeRateBadge } from "@/components/kbeauty/ExchangeRateBadge"
import { NotificationBell } from "@/components/kbeauty/NotificationBell"
import { AdRequestForm } from "@/components/kbeauty/AdRequestForm"
import { usePaddle } from "@/components/PaddleProvider"
import { PADDLE_PRICE_IDS } from "@/lib/paddle/constants"

// ─── 타입 ──────────────────────────────────────────────────────────────────

interface Supplier {
  id: string
  company_name_ko: string
  categories: string[] | null
  cosmetic_license_verified: boolean
  cosmetic_license_url: string | null
  buyer_db_access: boolean
  status: string
  fda_status: string | null
  fda_registration_number: string | null
  iso_22716: boolean
  iso_22716_url: string | null
  vegan_certified: boolean
  vegan_cert_org: string | null
  vegan_cert_url: string | null
  cruelty_free_certified: boolean
  cruelty_free_cert_org: string | null
  cruelty_free_cert_url: string | null
  export_experience: string | null
  export_countries: string | null
  pro_active: boolean
}

interface Match {
  id: string
  buyer_id: string
  status: string
  requested_at: string
  beauty_buyers?: { company_name: string; user_id: string | null }
}

interface SampleRequest {
  id: string
  product_id: string | null
  buyer_id: string | null
  buyer_email: string | null
  quantity: number
  message: string | null
  status: string
  created_at: string
  beauty_products: { product_name_en: string; brand_name: string } | null
}

interface RecommendedBuyer {
  id: string
  company_name: string
  country: string
  categories: string[] | null
  annual_import_volume: string | null
  business_type: string | null
}

interface RecommendedSeller {
  id: string
  company_name: string
  country: string | null
  categories: string[] | null
  annual_sales_volume: string | null
  platform_urls: {
    amazon?: string
    shopify?: string
    tiktok?: string
  } | null
}

// ─── 상수 ──────────────────────────────────────────────────────────────────

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// ─── 사이드바 ──────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "대시보드", icon: LayoutDashboard, href: "/kbeauty/dashboard/supplier" },
  { label: "제품 관리", icon: Package, href: "/kbeauty/dashboard/supplier/products/new" },
  { label: "매칭 관리", icon: Handshake, href: "/kbeauty/dashboard/supplier/matches" },
  { label: "프로필 관리", icon: UserCircle, href: "/kbeauty/dashboard/supplier/profile" },
  { label: "계정 설정", icon: Settings, href: "/kbeauty/dashboard/supplier/settings" },
]

function Sidebar({
  companyName,
  licenseVerified,
  onAdvertiseClick,
}: {
  companyName: string
  licenseVerified: boolean
  onAdvertiseClick: () => void
}) {
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
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#6B6B6B] hover:bg-[#F8F7F5] hover:text-[#0F0F0F] transition-colors"
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-[#E8E2DA]">
        <button
          onClick={onAdvertiseClick}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-white py-2 rounded-lg hover:opacity-90 transition-opacity"
          style={{ background: "#C8A882" }}
        >
          <Megaphone className="w-3.5 h-3.5" />
          광고 신청
        </button>
      </div>
      <div className="px-4 py-4 border-t border-[#E8E2DA]">
        <p className="text-xs font-medium text-[#0F0F0F] truncate">{companyName || "—"}</p>
        <div className="mt-1">
          {licenseVerified ? (
            <span className="inline-flex items-center gap-1 text-xs text-[#1A3A5C] bg-blue-50 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              인증 완료
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-[#6B6B6B] bg-[#F8F7F5] px-2 py-0.5 rounded-full border border-[#E8E2DA]">
              <Clock className="w-3 h-3" />
              인증 대기
            </span>
          )}
        </div>
      </div>
    </aside>
  )
}

// ─── 요약 카드 ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="flex-1 min-w-0 bg-[#F8F7F5] border border-[#E8E2DA] px-5 py-4"
      style={{ borderRadius: 12 }}
    >
      <p className="text-xs text-[#6B6B6B] mb-1">{label}</p>
      <p className="text-2xl font-semibold text-[#0F0F0F]">{value}</p>
    </div>
  )
}

// ─── 상태 배지 ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: ReactNode; className: string }> = {
    requested: {
      label: "대기중",
      icon: <Clock className="w-3 h-3" />,
      className: "text-amber-700 bg-amber-50 border-amber-200",
    },
    approved: {
      label: "승인",
      icon: <CheckCircle2 className="w-3 h-3" />,
      className: "text-green-700 bg-green-50 border-green-200",
    },
    rejected: {
      label: "거절",
      icon: <XCircle className="w-3 h-3" />,
      className: "text-red-600 bg-red-50 border-red-200",
    },
  }
  const config = map[status] ?? map["requested"]
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${config.className}`}
    >
      {config.icon}
      {config.label}
    </span>
  )
}

// ─── 파일 선택 버튼 ────────────────────────────────────────────────────────

function FilePickerButton({
  id,
  file,
  existingUrl,
  onChange,
}: {
  id: string
  file: File | null
  existingUrl: string | null
  onChange: (f: File | null) => void
}) {
  const existingName = existingUrl ? (existingUrl.split("/").pop() ?? "") : ""
  const displayName = file ? file.name : existingName

  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      <label
        htmlFor={id}
        className="cursor-pointer inline-flex items-center gap-1 text-xs font-medium text-white px-2.5 py-1 rounded-md hover:opacity-80 transition-opacity"
        style={{ background: "#1A3A5C" }}
      >
        <Paperclip className="w-3 h-3" />
        {existingUrl && !file ? "재업로드" : "파일 선택"}
      </label>
      <input
        id={id}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {displayName && (
        <span className="text-xs text-[#6B6B6B] truncate max-w-[180px]">{displayName}</span>
      )}
    </div>
  )
}

// ─── Pro 업그레이드 모달 ────────────────────────────────────────────────────

function ProUpgradeModal({
  onClose,
  userId,
  userEmail,
}: {
  onClose: () => void
  userId: string | null
  userEmail: string | null
}) {
  const paddle = usePaddle()

  function openCheckout(priceId: string) {
    if (!paddle) return
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: userEmail ? { email: userEmail } : undefined,
      customData: userId ? { userId } : undefined,
      settings: {
        displayMode: "overlay",
        theme: "light",
        successUrl: typeof window !== "undefined" ? window.location.href : undefined,
      },
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-[#0F0F0F]">Pro 플랜 업그레이드</h2>
          <button
            onClick={onClose}
            className="text-[#6B6B6B] hover:text-[#0F0F0F] text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <ul className="text-sm text-[#6B6B6B] space-y-2.5 mb-6">
          {[
            "매칭 요청 승인 · 거절",
            "샘플 요청 승인 · 거절",
            "추천 바이어 · 셀러 전체 열람",
            "컨택 정보 공개 및 요청",
          ].map((f) => (
            <li key={f} className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#1A3A5C] shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        <div className="space-y-2.5">
          <button
            onClick={() => openCheckout(PADDLE_PRICE_IDS.supplier_pro_monthly)}
            className="w-full py-3 rounded-xl font-semibold text-sm text-[#0F0F0F] transition-opacity hover:opacity-80"
            style={{ background: "#C8A882" }}
          >
            월 $49 — 월간 결제
          </button>
          <button
            onClick={() => openCheckout(PADDLE_PRICE_IDS.supplier_pro_annual)}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-80"
            style={{ background: "#1A3A5C" }}
          >
            연 $399 — 연간 결제{" "}
            <span className="font-normal text-xs opacity-75 ml-1">(33% 할인)</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 메인 페이지 ───────────────────────────────────────────────────────────

export default function SupplierDashboardPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [productCount, setProductCount] = useState(0)
  const [sampleRequests, setSampleRequests] = useState<SampleRequest[]>([])
  const [sampleUpdatingId, setSampleUpdatingId] = useState<string | null>(null)
  const [matchUpdatingId, setMatchUpdatingId] = useState<string | null>(null)
  const [totalMatchCountFull, setTotalMatchCountFull] = useState(0)
  const [approvedMatchCountFull, setApprovedMatchCountFull] = useState(0)
  const [sampleCountFull, setSampleCountFull] = useState(0)
  const [recommendedBuyers, setRecommendedBuyers] = useState<RecommendedBuyer[]>([])
  const [contactedBuyerIds, setContactedBuyerIds] = useState<Set<string>>(new Set())
  const [contactingId, setContactingId] = useState<string | null>(null)
  const [recommendedSellers, setRecommendedSellers] = useState<RecommendedSeller[]>([])
  const [contactedSellerIds, setContactedSellerIds] = useState<Set<string>>(new Set())
  const [contactingSellerSourcing, setContactingSellerSourcing] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [avgRating, setAvgRating] = useState<{ avg: number; count: number } | null>(null)
  const [proActive, setProActive] = useState(false)
  const [showProModal, setShowProModal] = useState(false)
  const [showAdForm, setShowAdForm] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // 가이드 편집 폼 상태
  const [fdaRegNumber, setFdaRegNumber] = useState("")
  const [exportCountries, setExportCountries] = useState("")
  const [veganCertOrg, setVeganCertOrg] = useState("")
  const [crueltyFreeCertOrg, setCrueltyFreeCertOrg] = useState("")

  // 파일 업로드 상태
  const [cosmeticLicenseFile, setCosmeticLicenseFile] = useState<File | null>(null)
  const [iso22716File, setIso22716File] = useState<File | null>(null)
  const [veganCertFile, setVeganCertFile] = useState<File | null>(null)
  const [crueltyFreeCertFile, setCrueltyFreeCertFile] = useState<File | null>(null)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/kbeauty")
        return
      }

      setUserId(user.id)
      setUserEmail(user.email ?? null)

      // 공급사 정보
      const { data: supplierData } = await supabase
        .from("beauty_suppliers")
        .select(
          "id, categories, company_name_ko, cosmetic_license_verified, cosmetic_license_url, buyer_db_access, status, fda_status, fda_registration_number, iso_22716, iso_22716_url, vegan_certified, vegan_cert_org, vegan_cert_url, cruelty_free_certified, cruelty_free_cert_org, cruelty_free_cert_url, export_experience, export_countries, pro_active"
        )
        .eq("user_id", user.id)
        .single()

      if (!supplierData) {
        router.push("/kbeauty/supplier")
        return
      }

      setSupplier(supplierData)
      setProActive(supplierData.pro_active)

      // 폼 초기값 로드
      setFdaRegNumber(supplierData.fda_registration_number ?? "")
      setExportCountries(supplierData.export_countries ?? "")
      setVeganCertOrg(supplierData.vegan_cert_org ?? "")
      setCrueltyFreeCertOrg(supplierData.cruelty_free_cert_org ?? "")

      // 매칭 요청 (최신 5건)
      const { data: matchData } = await supabase
        .from("beauty_matches")
        .select("id, buyer_id, status, requested_at, beauty_buyers(company_name, user_id)")
        .eq("supplier_id", supplierData.id)
        .order("requested_at", { ascending: false })
        .limit(5)

      setMatches((matchData as unknown as Match[]) ?? [])

      // 제품 수
      const { count } = await supabase
        .from("beauty_products")
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", supplierData.id)

      setProductCount(count ?? 0)

      // 샘플 요청 현황
      const { data: sampleData } = await supabase
        .from("beauty_post_matching_services")
        .select("id, product_id, buyer_id, buyer_email, quantity, message, status, created_at, beauty_products(product_name_en, brand_name)")
        .eq("supplier_id", supplierData.id)
        .eq("service_type", "sample")
        .order("created_at", { ascending: false })
        .limit(30)

      setSampleRequests((sampleData as unknown as SampleRequest[]) ?? [])

      // 전체 매칭 수 / 승인 수 / 샘플 수 (정확한 카운트)
      const { count: totalCount } = await supabase
        .from("beauty_matches")
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", supplierData.id)
      setTotalMatchCountFull(totalCount ?? 0)

      const { count: approvedCount } = await supabase
        .from("beauty_matches")
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", supplierData.id)
        .eq("status", "approved")
      setApprovedMatchCountFull(approvedCount ?? 0)

      const { count: sampleCountResult } = await supabase
        .from("beauty_post_matching_services")
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", supplierData.id)
        .eq("service_type", "sample")
      setSampleCountFull(sampleCountResult ?? 0)

      // 추천 바이어 (카테고리 교집합 + stage1_approved)
      const supplierCats: string[] = Array.isArray(supplierData.categories) ? supplierData.categories : []
      if (supplierCats.length > 0) {
        const { data: buyerData } = await supabase
          .from("beauty_buyers")
          .select("id, company_name, country, categories, annual_import_volume, business_type")
          .eq("stage1_approved", true)
          .overlaps("categories", supplierCats)
          .limit(10)
        setRecommendedBuyers((buyerData as RecommendedBuyer[]) ?? [])
      }

      // 이미 컨택한 바이어 ID
      const { data: contactedData } = await supabase
        .from("beauty_matches")
        .select("buyer_id")
        .eq("supplier_id", supplierData.id)
        .eq("initiated_by", "supplier")
      setContactedBuyerIds(new Set((contactedData ?? []).map((m: { buyer_id: string }) => m.buyer_id)))

      // 추천 셀러 (카테고리 교집합)
      if (supplierCats.length > 0) {
        const { data: sellerData } = await supabase
          .from("beauty_sellers")
          .select("id, company_name, country, categories, annual_sales_volume, platform_urls")
          .overlaps("categories", supplierCats)
          .limit(10)
        setRecommendedSellers((sellerData as RecommendedSeller[]) ?? [])
      }

      // 이미 컨택한 셀러 ID
      const { data: contactedSellerData } = await supabase
        .from("beauty_seller_sourcing")
        .select("seller_id")
        .eq("supplier_id", supplierData.id)
        .eq("initiated_by", "supplier")
      setContactedSellerIds(new Set((contactedSellerData ?? []).map((r: { seller_id: string }) => r.seller_id)))

      // 공급사 평균 평점 로드
      const { data: ratingRows } = await supabase
        .from("beauty_ratings")
        .select("overall_rating")
        .eq("supplier_id", supplierData.id)
      if (ratingRows && ratingRows.length > 0) {
        const sum = ratingRows.reduce((acc, r) => acc + Number(r.overall_rating ?? 0), 0)
        setAvgRating({ avg: Math.round((sum / ratingRows.length) * 10) / 10, count: ratingRows.length })
      }

      setLoading(false)
    }

    load()
  }, [router, supabase])

  // ─── 파일 유효성 검사 ────────────────────────────────────────────────────
  function validateFile(file: File): "size" | "type" | null {
    if (file.size > MAX_FILE_SIZE) return "size"
    if (!ALLOWED_MIME.includes(file.type)) return "type"
    return null
  }

  // ─── 스토리지 업로드 ─────────────────────────────────────────────────────
  async function uploadDoc(file: File, uid: string): Promise<string> {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const path = `suppliers/${uid}/${Date.now()}_${safeName}`
    const { error } = await supabase.storage
      .from("kbeauty-documents")
      .upload(path, file, { upsert: true })
    if (error) throw new Error("storage_error")
    return path
  }

  // ─── 저장 ────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!supplier || !userId) return
    setSaving(true)

    // 파일 유효성 검사
    const filesToCheck = [cosmeticLicenseFile, iso22716File, veganCertFile, crueltyFreeCertFile].filter(
      Boolean
    ) as File[]
    for (const file of filesToCheck) {
      const err = validateFile(file)
      if (err === "size") {
        toast.error("파일 용량이 너무 큽니다. 10MB 이하 파일을 업로드해주세요.")
        setSaving(false)
        return
      }
      if (err === "type") {
        toast.error("PDF, JPG, PNG 파일만 업로드 가능합니다.")
        setSaving(false)
        return
      }
    }

    const updates: Record<string, unknown> = {
      fda_registration_number: fdaRegNumber || null,
      export_countries: exportCountries || null,
      vegan_cert_org: veganCertOrg || null,
      cruelty_free_cert_org: crueltyFreeCertOrg || null,
    }

    // 파일 업로드
    try {
      if (cosmeticLicenseFile) {
        updates.cosmetic_license_url = await uploadDoc(cosmeticLicenseFile, userId)
      }
      if (iso22716File) {
        updates.iso_22716_url = await uploadDoc(iso22716File, userId)
        updates.iso_22716 = true
      }
      if (veganCertFile) {
        updates.vegan_cert_url = await uploadDoc(veganCertFile, userId)
        updates.vegan_certified = true
      }
      if (crueltyFreeCertFile) {
        updates.cruelty_free_cert_url = await uploadDoc(crueltyFreeCertFile, userId)
        updates.cruelty_free_certified = true
      }
    } catch {
      toast.error("파일 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.")
      setSaving(false)
      return
    }

    // DB 저장
    const { error } = await supabase.from("beauty_suppliers").update(updates).eq("id", supplier.id)

    if (error) {
      const msg = (error as { message?: string }).message ?? ""
      const code = (error as { code?: string }).code ?? ""

      if (
        !navigator.onLine ||
        msg.toLowerCase().includes("fetch") ||
        msg.toLowerCase().includes("network")
      ) {
        toast.error("네트워크 연결을 확인해주세요.")
      } else if (
        msg.toLowerCase().includes("jwt") ||
        msg.toLowerCase().includes("expired") ||
        code === "PGRST301"
      ) {
        toast.error("로그인이 만료됐습니다. 다시 로그인해주세요.", {
          action: {
            label: "로그인하기",
            onClick: () => router.push("/kbeauty/login"),
          },
        })
      } else {
        toast.error(
          `오류가 발생했습니다. (오류코드: ${code || "UNKNOWN"}) 고객센터에 문의해주세요.`
        )
      }
      setSaving(false)
      return
    }

    // 로컬 상태 반영 + 파일 입력 초기화
    setSupplier((prev) => (prev ? ({ ...prev, ...updates } as Supplier) : prev))
    setCosmeticLicenseFile(null)
    setIso22716File(null)
    setVeganCertFile(null)
    setCrueltyFreeCertFile(null)

    toast.success("저장됐습니다.")
    setSaving(false)
  }

  // ─── 매칭 요청 승인/거절 ─────────────────────────────────────────────────
  async function handleMatchStatus(id: string, newStatus: "approved" | "rejected", buyerUserId: string | null) {
    setMatchUpdatingId(id)
    const { error } = await supabase
      .from("beauty_matches")
      .update({ status: newStatus })
      .eq("id", id)
    if (error) {
      toast.error("오류가 발생했습니다.")
    } else {
      setMatches((prev) => prev.map((m) => (m.id === id ? { ...m, status: newStatus } : m)))
      if (newStatus === "approved") setApprovedMatchCountFull((c) => c + 1)
      toast.success(newStatus === "approved" ? "매칭을 승인했습니다." : "매칭을 거절했습니다.")

      // 바이어에게 알림 발송
      if (buyerUserId) {
        await supabase.from("beauty_notifications").insert({
          user_id: buyerUserId,
          type: newStatus === "approved" ? "match_approved" : "match_rejected",
          title: newStatus === "approved" ? "Match Request Approved" : "Match Request Rejected",
          message: newStatus === "approved"
            ? `${supplier?.company_name_ko ?? "The supplier"} has approved your matching request.`
            : `${supplier?.company_name_ko ?? "The supplier"} has declined your matching request.`,
          link: "/kbeauty/dashboard/buyer",
        })
        // 평점 요청 알림 (매칭 승인 시)
        if (newStatus === "approved") {
          await supabase.from("beauty_notifications").insert({
            user_id: buyerUserId,
            type: "match_approved",
            title: "Rate your experience",
            message: `How was your collaboration with ${supplier?.company_name_ko ?? "the supplier"}? Share your feedback.`,
            link: "/kbeauty/dashboard/buyer",
          })
        }
      }
    }
    setMatchUpdatingId(null)
  }

  // ─── 샘플 요청 승인/거절 ─────────────────────────────────────────────────
  async function handleSampleStatus(id: string, newStatus: "approved" | "rejected") {
    setSampleUpdatingId(id)
    const req = sampleRequests.find((r) => r.id === id)
    const { error } = await supabase
      .from("beauty_post_matching_services")
      .update({ status: newStatus })
      .eq("id", id)
    if (error) {
      toast.error("오류가 발생했습니다.")
    } else {
      setSampleRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      )
      toast.success(newStatus === "approved" ? "샘플 요청을 승인했습니다." : "샘플 요청을 거절했습니다.")

      // 바이어에게 알림 발송 (buyer_id = auth.users.id)
      if (req?.buyer_id) {
        const productName = req.beauty_products?.product_name_en ?? "the product"
        await supabase.from("beauty_notifications").insert({
          user_id: req.buyer_id,
          type: newStatus === "approved" ? "sample_approved" : "sample_rejected",
          title: newStatus === "approved" ? "Sample Request Approved" : "Sample Request Rejected",
          message: newStatus === "approved"
            ? `Your sample request for ${productName} has been approved.`
            : `Your sample request for ${productName} has been declined.`,
          link: "/kbeauty/dashboard/buyer",
        })
        // 평점 요청 알림 (샘플 승인 시)
        if (newStatus === "approved") {
          await supabase.from("beauty_notifications").insert({
            user_id: req.buyer_id,
            type: "sample_approved",
            title: "Rate your experience",
            message: `How was your sample experience with ${supplier?.company_name_ko ?? "the supplier"}? Share your feedback.`,
            link: "/kbeauty/dashboard/buyer",
          })
        }
      }
    }
    setSampleUpdatingId(null)
  }

  // ─── 공급사 → 바이어 컨택 요청 ────────────────────────────────────────────
  async function handleContact(buyerId: string) {
    if (!supplier) return
    setContactingId(buyerId)
    const { error } = await supabase.from("beauty_matches").insert({
      supplier_id: supplier.id,
      buyer_id: buyerId,
      status: "requested",
      initiated_by: "supplier",
    })
    if (error) {
      toast.error("오류가 발생했습니다. 다시 시도해주세요.")
    } else {
      setContactedBuyerIds((prev) => new Set([...prev, buyerId]))
      toast.success("컨택 요청을 보냈습니다.")
    }
    setContactingId(null)
  }

  // ─── 공급사 → 셀러 컨택 ──────────────────────────────────────────────────
  async function handleContactSeller(sellerId: string) {
    if (!supplier) return
    setContactingSellerSourcing(sellerId)
    const { error } = await supabase.from("beauty_seller_sourcing").insert({
      supplier_id: supplier.id,
      seller_id: sellerId,
      initiated_by: "supplier",
      status: "requested",
    })
    if (error) {
      toast.error("오류가 발생했습니다. 다시 시도해주세요.")
    } else {
      setContactedSellerIds((prev) => new Set([...prev, sellerId]))
      toast.success("셀러에게 컨택 요청을 보냈습니다.")
    }
    setContactingSellerSourcing(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F7F5] flex items-center justify-center">
        <p className="text-sm text-[#6B6B6B]">불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F7F5]" style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}>
      <Toaster position="top-right" richColors />

      {/* 광고 신청 모달 */}
      {showAdForm && (
        <AdRequestForm userType="supplier" onClose={() => setShowAdForm(false)} />
      )}

      {/* 사이드바 */}
      <Sidebar
        companyName={supplier?.company_name_ko ?? ""}
        licenseVerified={supplier?.cosmetic_license_verified ?? false}
        onAdvertiseClick={() => setShowAdForm(true)}
      />

      {/* 메인 콘텐츠 */}
      <main className="min-h-screen" style={{ marginLeft: 240 }}>
        <div className="max-w-4xl mx-auto px-8 py-10">

          {/* 헤더 — 환영 메시지 + 환율 배지 */}
          <div className="flex items-start justify-between mb-8">
            <h1
              className="text-[#0F0F0F]"
              style={{
                fontFamily: '"Cormorant Garamond", Georgia, serif',
                fontSize: 28,
                fontWeight: 600,
                lineHeight: 1.2,
              }}
            >
              안녕하세요, {supplier?.company_name_ko ?? ""}님
            </h1>
            <div className="flex items-center gap-2">
              {userId && <NotificationBell userId={userId} theme="navy" />}
              <ExchangeRateBadge />
            </div>
          </div>
          <div className="flex items-center gap-2 -mt-4 mb-8">
            {avgRating ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-[#6B6B6B]">
                <span className="text-amber-400 text-base leading-none">★</span>
                <span className="font-semibold text-[#0F0F0F]">{avgRating.avg.toFixed(1)}</span>
                <span>/ 5.0</span>
                <span className="text-[#9CA3AF]">({avgRating.count} review{avgRating.count !== 1 ? "s" : ""})</span>
              </span>
            ) : (
              <span className="text-xs text-[#9CA3AF]">No ratings yet</span>
            )}
          </div>

          {/* 요약 카드 + 제품 등록 버튼 */}
          <div className="flex gap-4 mb-8 items-stretch">
            <SummaryCard label="받은 매칭 요청" value={totalMatchCountFull} />
            <SummaryCard label="승인한 매칭" value={approvedMatchCountFull} />
            <SummaryCard label="샘플 요청" value={sampleCountFull} />
            <SummaryCard label="추천 바이어" value={recommendedBuyers.length} />
            <Link
              href="/kbeauty/dashboard/supplier/products/new"
              className="flex flex-col items-center justify-center gap-1 min-w-[120px] px-5 py-4 border-[1.5px] border-dashed border-[#1A3A5C]/30 rounded-xl text-[#1A3A5C] hover:bg-[#1A3A5C]/[0.04] hover:border-[#1A3A5C]/60 transition-colors"
            >
              <Package className="w-5 h-5" />
              <span className="text-xs font-medium whitespace-nowrap">제품 등록</span>
            </Link>
          </div>

          {/* Pro 플랜 업그레이드 배너 — Pro 활성화 시 숨김 */}
          {!proActive && (
            <div
              className="flex items-center justify-between px-6 py-4 mb-8"
              style={{ background: "#1A3A5C", borderRadius: 12 }}
            >
              <p className="text-white text-sm font-medium">
                매칭을 승인하려면 Pro 플랜이 필요합니다.
              </p>
              <button
                onClick={() => setShowProModal(true)}
                className="text-sm font-semibold px-4 py-2 transition-opacity hover:opacity-80"
                style={{
                  background: "#C8A882",
                  color: "#0F0F0F",
                  borderRadius: 8,
                  whiteSpace: "nowrap",
                }}
              >
                Pro 업그레이드
              </button>
            </div>
          )}

          {/* 북미 수출 준비 가이드 */}
          <div className="bg-white border border-[#E8E2DA] mb-6" style={{ borderRadius: 12, padding: 24 }}>
            <h2 className="text-[#0F0F0F] mb-5" style={{ fontSize: 16, fontWeight: 700 }}>
              📦 북미 수출 준비 가이드
            </h2>

            {/* 필수 서류 */}
            <p className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wider mb-3">필수 서류</p>
            <div className="space-y-3 mb-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#0F0F0F]">화장품 제조·책임판매업 등록필증</p>
                  <p className="text-xs text-[#6B6B6B] mt-0.5">식약처 발급 — 국내 합법 화장품 업체 증명</p>
                  <FilePickerButton
                    id="cosmetic-license-file"
                    file={cosmeticLicenseFile}
                    existingUrl={supplier?.cosmetic_license_url ?? null}
                    onChange={setCosmeticLicenseFile}
                  />
                </div>
                <span className="text-xs font-medium whitespace-nowrap flex-shrink-0 mt-0.5">
                  {supplier?.cosmetic_license_verified
                    ? "✅ 검증 완료"
                    : supplier?.cosmetic_license_url
                    ? "🔄 검토 중"
                    : "⚠️ 미등록"}
                </span>
              </div>
            </div>

            <div className="border-t border-[#E8E2DA] mb-4" />

            {/* 권장 서류 */}
            <p className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wider mb-3">권장 서류 (배지 부여)</p>
            <div className="space-y-5">

              {/* FDA MoCRA */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#0F0F0F]">FDA MoCRA 등록</p>
                  <p className="text-xs text-[#6B6B6B] mt-0.5">미국 수출 법적 의무 요건 (2023년 시행)</p>
                  <a
                    href="https://www.fda.gov/cosmetics/registration-listing-cosmetic-product-facilities-and-products"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#1A3A5C] hover:underline mt-0.5 inline-block"
                  >
                    등록 방법 안내 →
                  </a>
                  <input
                    type="text"
                    value={fdaRegNumber}
                    onChange={(e) => setFdaRegNumber(e.target.value)}
                    placeholder="FDA Registration Number"
                    className="mt-2 w-full text-xs border border-[#E8E2DA] rounded-md px-3 py-1.5 bg-[#F8F7F5] focus:outline-none focus:ring-1 focus:ring-[#1A3A5C] focus:bg-white transition-colors"
                  />
                </div>
                <span className="text-xs font-medium whitespace-nowrap flex-shrink-0 mt-0.5">
                  {supplier?.fda_status === "등록 완료"
                    ? "✅ 등록 완료"
                    : supplier?.fda_status === "진행 중"
                    ? "🔄 진행 중"
                    : "➖ 미등록"}
                </span>
              </div>

              {/* ISO 22716 */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#0F0F0F]">ISO 22716 인증</p>
                  <p className="text-xs text-[#6B6B6B] mt-0.5">화장품 GMP 국제표준 — 대형 바이어 필수 요구</p>
                  <a
                    href="https://www.knqa.go.kr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#1A3A5C] hover:underline mt-0.5 inline-block"
                  >
                    인증 기관 안내 →
                  </a>
                  <FilePickerButton
                    id="iso22716-file"
                    file={iso22716File}
                    existingUrl={supplier?.iso_22716_url ?? null}
                    onChange={setIso22716File}
                  />
                </div>
                <span className="text-xs font-medium whitespace-nowrap flex-shrink-0 mt-0.5">
                  {supplier?.iso_22716 ? "✅ 보유" : "➖ 미보유"}
                </span>
              </div>

              {/* 비건 인증 */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#0F0F0F]">비건 인증</p>
                  <p className="text-xs text-[#6B6B6B] mt-0.5">북미 MZ 세대 타깃 핵심 요건 — 매칭 우선순위 상승</p>
                  <a
                    href="https://www.vegankorea.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#1A3A5C] hover:underline mt-0.5 inline-block"
                  >
                    인증 기관 안내 →
                  </a>
                  <input
                    type="text"
                    value={veganCertOrg}
                    onChange={(e) => setVeganCertOrg(e.target.value)}
                    placeholder="인증 기관명 (예: 한국비건인증원)"
                    className="mt-2 w-full text-xs border border-[#E8E2DA] rounded-md px-3 py-1.5 bg-[#F8F7F5] focus:outline-none focus:ring-1 focus:ring-[#1A3A5C] focus:bg-white transition-colors"
                  />
                  <FilePickerButton
                    id="vegan-cert-file"
                    file={veganCertFile}
                    existingUrl={supplier?.vegan_cert_url ?? null}
                    onChange={setVeganCertFile}
                  />
                </div>
                <span className="text-xs font-medium whitespace-nowrap flex-shrink-0 mt-0.5">
                  {supplier?.vegan_certified ? "✅ 보유" : "➖ 미보유"}
                </span>
              </div>

              {/* 크루얼티프리 */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#0F0F0F]">크루얼티프리 인증</p>
                  <p className="text-xs text-[#6B6B6B] mt-0.5">동물실험 미실시 인증 — 북미 시장 차별화</p>
                  <a
                    href="https://www.leapingbunny.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#1A3A5C] hover:underline mt-0.5 inline-block"
                  >
                    인증 기관 안내 →
                  </a>
                  <input
                    type="text"
                    value={crueltyFreeCertOrg}
                    onChange={(e) => setCrueltyFreeCertOrg(e.target.value)}
                    placeholder="인증 기관명 (예: Leaping Bunny)"
                    className="mt-2 w-full text-xs border border-[#E8E2DA] rounded-md px-3 py-1.5 bg-[#F8F7F5] focus:outline-none focus:ring-1 focus:ring-[#1A3A5C] focus:bg-white transition-colors"
                  />
                  <FilePickerButton
                    id="cruelty-free-cert-file"
                    file={crueltyFreeCertFile}
                    existingUrl={supplier?.cruelty_free_cert_url ?? null}
                    onChange={setCrueltyFreeCertFile}
                  />
                </div>
                <span className="text-xs font-medium whitespace-nowrap flex-shrink-0 mt-0.5">
                  {supplier?.cruelty_free_certified ? "✅ 보유" : "➖ 미보유"}
                </span>
              </div>

              {/* 수출 경험 */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#0F0F0F]">수출 경험</p>
                  <input
                    type="text"
                    value={exportCountries}
                    onChange={(e) => setExportCountries(e.target.value)}
                    placeholder="예: 미국, 일본, 싱가포르"
                    className="mt-1.5 w-full text-xs border border-[#E8E2DA] rounded-md px-3 py-1.5 bg-[#F8F7F5] focus:outline-none focus:ring-1 focus:ring-[#1A3A5C] focus:bg-white transition-colors"
                  />
                </div>
                <span className="text-xs font-medium whitespace-nowrap flex-shrink-0 mt-0.5">
                  {supplier?.export_experience === "수출 경험 있음"
                    ? "✅ 수출 경험 있음"
                    : supplier?.export_experience === "수출 준비 중"
                    ? "🔄 수출 준비 중"
                    : "➖ 미입력"}
                </span>
              </div>

            </div>

            {/* 저장 버튼 */}
            <div className="flex justify-end mt-5 pt-4 border-t border-[#E8E2DA]">
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-sm font-semibold px-5 py-2 transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: "#1A3A5C", color: "white", borderRadius: 8 }}
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>

          {/* 화장품 등록필증 업로드 안내 */}
          {!supplier?.cosmetic_license_verified && (
            <div
              className="flex items-center justify-between px-6 py-4 mb-8 border border-[#E8E2DA] bg-white"
              style={{ borderRadius: 12 }}
            >
              <p className="text-sm text-[#0F0F0F]">
                바이어 DB 접근을 위해 화장품 등록필증을 업로드해주세요.
              </p>
              <button
                className="flex items-center gap-2 text-sm font-medium text-white px-4 py-2 transition-colors hover:bg-[#153249]"
                style={{ background: "#1A3A5C", borderRadius: 8, whiteSpace: "nowrap" }}
              >
                <Upload className="w-4 h-4" />
                업로드
              </button>
            </div>
          )}

          {/* 최근 매칭 요청 */}
          <div className="bg-white border border-[#E8E2DA]" style={{ borderRadius: 12 }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E2DA]">
              <h2 className="text-sm font-semibold text-[#0F0F0F]">최근 매칭 요청</h2>
              <Link
                href="/kbeauty/dashboard/supplier/matches"
                className="flex items-center gap-1 text-xs text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors"
              >
                전체보기
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {matches.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-[#6B6B6B]">아직 매칭 요청이 없습니다.</p>
              </div>
            ) : (
              <ul>
                {matches.map((match, idx) => (
                  <li
                    key={match.id}
                    className={`flex items-center justify-between px-6 py-4 ${
                      idx < matches.length - 1 ? "border-b border-[#E8E2DA]" : ""
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-[#0F0F0F]">
                        {match.beauty_buyers?.company_name ?? "바이어"}
                      </p>
                      <p className="text-xs text-[#6B6B6B] mt-0.5">
                        {new Date(match.requested_at).toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <StatusBadge status={match.status} />
                      {match.status === "requested" && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleMatchStatus(match.id, "rejected", match.beauty_buyers?.user_id ?? null)}
                            disabled={matchUpdatingId === match.id}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-[#E8E2DA] text-[#6B6B6B] hover:bg-[#F8F7F5] transition-colors disabled:opacity-50"
                          >
                            {matchUpdatingId === match.id ? "..." : "거절"}
                          </button>
                          <button
                            onClick={() =>
                              proActive
                                ? handleMatchStatus(match.id, "approved", match.beauty_buyers?.user_id ?? null)
                                : setShowProModal(true)
                            }
                            disabled={proActive && matchUpdatingId === match.id}
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white transition-opacity hover:opacity-80 disabled:opacity-50"
                            style={{ background: "#1A3A5C" }}
                          >
                            {proActive
                              ? (matchUpdatingId === match.id ? "..." : "승인")
                              : <span className="flex items-center gap-1"><Lock className="w-3 h-3" />Pro</span>}
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 추천 바이어 */}
          <div className="bg-white border border-[#E8E2DA] mt-6" style={{ borderRadius: 12 }}>
            <div className="px-6 py-4 border-b border-[#E8E2DA]">
              <h2 className="text-sm font-semibold text-[#0F0F0F] flex items-center gap-2">
                추천 바이어
                {!proActive && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#1A3A5C] text-white">PRO</span>
                )}
                {recommendedBuyers.length > 0 && (
                  <span className="text-xs font-normal text-[#6B6B6B]">({recommendedBuyers.length}개 매칭)</span>
                )}
              </h2>
              <p className="text-xs text-[#6B6B6B] mt-0.5">카테고리가 일치하는 승인된 바이어입니다.</p>
            </div>
            {recommendedBuyers.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-[#6B6B6B]">현재 카테고리에 맞는 추천 바이어가 없습니다.</p>
              </div>
            ) : (
              <ul>
                {recommendedBuyers.map((buyer, idx) => {
                  const alreadyContacted = contactedBuyerIds.has(buyer.id)
                  const isContacting = contactingId === buyer.id
                  const isLocked = !proActive && idx >= 3
                  return (
                    <li
                      key={buyer.id}
                      className={`flex items-start justify-between gap-4 px-6 py-4 ${
                        idx < recommendedBuyers.length - 1 ? "border-b border-[#E8E2DA]" : ""
                      } ${isLocked ? "blur-sm pointer-events-none select-none" : ""}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-[#0F0F0F]">{buyer.company_name}</p>
                          <span className="text-xs text-[#6B6B6B]">{buyer.country}</span>
                        </div>
                        {buyer.annual_import_volume && (
                          <p className="text-xs text-[#6B6B6B] mt-0.5">수입 규모: {buyer.annual_import_volume}</p>
                        )}
                        {buyer.categories && buyer.categories.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {buyer.categories.slice(0, 4).map((cat) => (
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
                      <button
                        onClick={() => proActive ? handleContact(buyer.id) : setShowProModal(true)}
                        disabled={proActive ? (alreadyContacted || isContacting) : false}
                        className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 flex items-center gap-1"
                        style={
                          proActive && alreadyContacted
                            ? { background: "#F8F7F5", color: "#6B6B6B", border: "1px solid #E8E2DA" }
                            : { background: "#1A3A5C", color: "white" }
                        }
                      >
                        {proActive
                          ? (isContacting ? "..." : alreadyContacted ? "요청 중" : "컨택 요청")
                          : <><Lock className="w-3 h-3" />Pro</>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {!proActive && recommendedBuyers.length > 3 && (
              <div className="px-6 py-3 border-t border-[#E8E2DA] text-center">
                <button
                  onClick={() => setShowProModal(true)}
                  className="text-xs font-medium text-[#1A3A5C] hover:underline"
                >
                  Pro에서 전체 {recommendedBuyers.length}개 바이어 열람 →
                </button>
              </div>
            )}
          </div>

          {/* 추천 셀러 */}
          <div className="bg-white border border-[#E8E2DA] mt-6" style={{ borderRadius: 12 }}>
            <div className="px-6 py-4 border-b border-[#E8E2DA]">
              <h2 className="text-sm font-semibold text-[#0F0F0F] flex items-center gap-2">
                추천 셀러
                {!proActive && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#1A3A5C] text-white">PRO</span>
                )}
                {recommendedSellers.length > 0 && (
                  <span className="text-xs font-normal text-[#6B6B6B]">({recommendedSellers.length}개 매칭)</span>
                )}
              </h2>
              <p className="text-xs text-[#6B6B6B] mt-0.5">카테고리가 일치하는 해외 셀러입니다.</p>
            </div>
            {recommendedSellers.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-[#6B6B6B]">현재 카테고리에 맞는 추천 셀러가 없습니다.</p>
              </div>
            ) : (
              <ul>
                {recommendedSellers.map((seller, idx) => {
                  const alreadyContacted = contactedSellerIds.has(seller.id)
                  const isContacting = contactingSellerSourcing === seller.id
                  const isLocked = !proActive && idx >= 3
                  const platforms = [
                    seller.platform_urls?.amazon && "Amazon",
                    seller.platform_urls?.shopify && "Shopify",
                    seller.platform_urls?.tiktok && "TikTok",
                  ].filter(Boolean) as string[]
                  return (
                    <li
                      key={seller.id}
                      className={`flex items-start justify-between gap-4 px-6 py-4 ${
                        idx < recommendedSellers.length - 1 ? "border-b border-[#E8E2DA]" : ""
                      } ${isLocked ? "blur-sm pointer-events-none select-none" : ""}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-[#0F0F0F]">{seller.company_name}</p>
                          {seller.country && <span className="text-xs text-[#6B6B6B]">{seller.country}</span>}
                        </div>
                        {seller.annual_sales_volume && (
                          <p className="text-xs text-[#6B6B6B] mt-0.5">판매 규모: {seller.annual_sales_volume}</p>
                        )}
                        {seller.categories && seller.categories.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {seller.categories.slice(0, 4).map((cat) => (
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
                        {platforms.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {platforms.map((p) => (
                              <span
                                key={p}
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                                style={{ background: "#C8A88218", color: "#8B6F47" }}
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => proActive ? handleContactSeller(seller.id) : setShowProModal(true)}
                        disabled={proActive ? (alreadyContacted || isContacting) : false}
                        className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 flex items-center gap-1"
                        style={
                          proActive && alreadyContacted
                            ? { background: "#F8F7F5", color: "#6B6B6B", border: "1px solid #E8E2DA" }
                            : { background: "#1A3A5C", color: "white" }
                        }
                      >
                        {proActive
                          ? (isContacting ? "..." : alreadyContacted ? "요청 중" : "컨택 요청")
                          : <><Lock className="w-3 h-3" />Pro</>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {!proActive && recommendedSellers.length > 3 && (
              <div className="px-6 py-3 border-t border-[#E8E2DA] text-center">
                <button
                  onClick={() => setShowProModal(true)}
                  className="text-xs font-medium text-[#1A3A5C] hover:underline"
                >
                  Pro에서 전체 {recommendedSellers.length}개 셀러 열람 →
                </button>
              </div>
            )}
          </div>

          {/* 샘플 요청 현황 */}
          <div className="bg-white border border-[#E8E2DA] mt-6" style={{ borderRadius: 12 }}>
            <div className="px-6 py-4 border-b border-[#E8E2DA]">
              <h2 className="text-sm font-semibold text-[#0F0F0F]">
                샘플 요청 현황
                {sampleRequests.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-[#6B6B6B]">({sampleRequests.length}건)</span>
                )}
              </h2>
            </div>

            {sampleRequests.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-[#6B6B6B]">아직 샘플 요청이 없습니다.</p>
              </div>
            ) : (
              <ul>
                {sampleRequests.map((req, idx) => (
                  <li
                    key={req.id}
                    className={`px-6 py-4 ${idx < sampleRequests.length - 1 ? "border-b border-[#E8E2DA]" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#0F0F0F]">
                          {req.beauty_products?.product_name_en ?? "—"}
                        </p>
                        <p className="text-xs text-[#6B6B6B] mb-2">
                          {req.beauty_products?.brand_name}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-[#6B6B6B] flex-wrap">
                          <span>바이어: {req.buyer_email ?? "—"}</span>
                          <span>수량: {req.quantity}개</span>
                          <span>
                            {new Date(req.created_at).toLocaleDateString("ko-KR", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        {req.message && (
                          <p className="mt-2 text-xs text-[#6B6B6B] bg-[#F8F7F5] rounded-lg px-3 py-2 border border-[#E8E2DA]">
                            {req.message}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <StatusBadge status={req.status} />
                        {req.status === "pending" && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleSampleStatus(req.id, "rejected")}
                              disabled={sampleUpdatingId === req.id}
                              className="text-xs font-medium px-2.5 py-1 rounded-lg border border-[#E8E2DA] text-[#6B6B6B] hover:bg-[#F8F7F5] transition-colors disabled:opacity-50"
                            >
                              {sampleUpdatingId === req.id ? "..." : "거절"}
                            </button>
                            <button
                              onClick={() =>
                                proActive
                                  ? handleSampleStatus(req.id, "approved")
                                  : setShowProModal(true)
                              }
                              disabled={proActive && sampleUpdatingId === req.id}
                              className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white transition-opacity hover:opacity-80 disabled:opacity-50 flex items-center gap-1"
                              style={{ background: "#1A3A5C" }}
                            >
                              {proActive
                                ? (sampleUpdatingId === req.id ? "..." : "승인")
                                : <><Lock className="w-3 h-3" />Pro</>}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </main>

      {showProModal && (
        <ProUpgradeModal
          onClose={() => setShowProModal(false)}
          userId={userId}
          userEmail={userEmail}
        />
      )}
    </div>
  )
}
