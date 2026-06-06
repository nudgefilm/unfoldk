"use client"

import { type ReactNode, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  Handshake,
  Settings,
  ChevronRight,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  Paperclip,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { ExchangeRateBadge } from "@/components/kbeauty/ExchangeRateBadge"

// ─── 타입 ──────────────────────────────────────────────────────────────────

interface Supplier {
  id: string
  company_name_ko: string
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
}

interface Match {
  id: string
  buyer_id: string
  status: string
  requested_at: string
  beauty_buyers?: { company_name: string }
}

// ─── 상수 ──────────────────────────────────────────────────────────────────

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// ─── 사이드바 ──────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "대시보드", icon: LayoutDashboard, href: "/kbeauty/dashboard/supplier" },
  { label: "제품 관리", icon: Package, href: "/kbeauty/dashboard/supplier/products/new" },
  { label: "매칭 관리", icon: Handshake, href: "/kbeauty/dashboard/supplier/matches" },
  { label: "계정 설정", icon: Settings, href: "/kbeauty/dashboard/supplier/settings" },
]

function Sidebar({
  companyName,
  licenseVerified,
}: {
  companyName: string
  licenseVerified: boolean
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

// ─── 메인 페이지 ───────────────────────────────────────────────────────────

export default function SupplierDashboardPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [productCount, setProductCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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

      // 공급사 정보
      const { data: supplierData } = await supabase
        .from("beauty_suppliers")
        .select(
          "id, company_name_ko, cosmetic_license_verified, cosmetic_license_url, buyer_db_access, status, fda_status, fda_registration_number, iso_22716, iso_22716_url, vegan_certified, vegan_cert_org, vegan_cert_url, cruelty_free_certified, cruelty_free_cert_org, cruelty_free_cert_url, export_experience, export_countries"
        )
        .eq("user_id", user.id)
        .single()

      if (!supplierData) {
        router.push("/kbeauty/supplier")
        return
      }

      setSupplier(supplierData)

      // 폼 초기값 로드
      setFdaRegNumber(supplierData.fda_registration_number ?? "")
      setExportCountries(supplierData.export_countries ?? "")
      setVeganCertOrg(supplierData.vegan_cert_org ?? "")
      setCrueltyFreeCertOrg(supplierData.cruelty_free_cert_org ?? "")

      // 매칭 요청 (최신 5건)
      const { data: matchData } = await supabase
        .from("beauty_matches")
        .select("id, buyer_id, status, requested_at, beauty_buyers(company_name)")
        .eq("supplier_id", supplierData.id)
        .order("requested_at", { ascending: false })
        .limit(5)

      setMatches((matchData as Match[]) ?? [])

      // 제품 수
      const { count } = await supabase
        .from("beauty_products")
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", supplierData.id)

      setProductCount(count ?? 0)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F7F5] flex items-center justify-center">
        <p className="text-sm text-[#6B6B6B]">불러오는 중...</p>
      </div>
    )
  }

  const approvedCount = matches.filter((m) => m.status === "approved").length
  const totalMatchCount = matches.length

  return (
    <div className="min-h-screen bg-[#F8F7F5]" style={{ fontFamily: '"Pretendard Variable", Pretendard, sans-serif' }}>
      <Toaster position="top-right" richColors />

      {/* 사이드바 */}
      <Sidebar
        companyName={supplier?.company_name_ko ?? ""}
        licenseVerified={supplier?.cosmetic_license_verified ?? false}
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
            <ExchangeRateBadge />
          </div>

          {/* 요약 카드 + 제품 등록 버튼 */}
          <div className="flex gap-4 mb-8 items-stretch">
            <SummaryCard label="받은 매칭 요청" value={totalMatchCount} />
            <SummaryCard label="승인한 매칭" value={approvedCount} />
            <SummaryCard label="등록 제품" value={productCount} />
            <SummaryCard label="조회수" value={0} />
            <Link
              href="/kbeauty/dashboard/supplier/products/new"
              className="flex flex-col items-center justify-center gap-1 min-w-[120px] px-5 py-4 border-[1.5px] border-dashed border-[#1A3A5C]/30 rounded-xl text-[#1A3A5C] hover:bg-[#1A3A5C]/[0.04] hover:border-[#1A3A5C]/60 transition-colors"
            >
              <Package className="w-5 h-5" />
              <span className="text-xs font-medium whitespace-nowrap">제품 등록</span>
            </Link>
          </div>

          {/* Pro 플랜 업그레이드 배너 */}
          <div
            className="flex items-center justify-between px-6 py-4 mb-8"
            style={{ background: "#1A3A5C", borderRadius: 12 }}
          >
            <p className="text-white text-sm font-medium">
              매칭을 승인하려면 Pro 플랜이 필요합니다.
            </p>
            <button
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
                    <StatusBadge status={match.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}
