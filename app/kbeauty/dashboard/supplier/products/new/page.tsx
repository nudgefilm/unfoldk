"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  Handshake,
  Settings,
  ChevronLeft,
  ImagePlus,
  X,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react"
import imageCompression from "browser-image-compression"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { cn } from "@/lib/utils"

// ─── 상수 ──────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "대시보드", icon: LayoutDashboard, href: "/kbeauty/dashboard/supplier" },
  { label: "제품 관리", icon: Package, href: "/kbeauty/dashboard/supplier/products/new" },
  { label: "매칭 관리", icon: Handshake, href: "/kbeauty/dashboard/supplier/matches" },
  { label: "계정 설정", icon: Settings, href: "/kbeauty/dashboard/supplier/settings" },
]

const CATEGORIES: { ko: string; value: string }[] = [
  { ko: "스킨케어", value: "skincare" },
  { ko: "클렌징", value: "cleansing" },
  { ko: "선케어", value: "suncare" },
  { ko: "메이크업", value: "makeup" },
  { ko: "헤어", value: "haircare" },
  { ko: "바디", value: "body" },
]

const CERT_OPTIONS = ["CPNP", "FDA", "ISO22716", "KFDA", "기타"]

const MAX_IMAGES = 5
const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5MB

// ─── 사이드바 ──────────────────────────────────────────────────────────────

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
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
              item.href === "/kbeauty/dashboard/supplier/products/new"
                ? "bg-[#1A3A5C]/[0.08] text-[#1A3A5C] font-medium"
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

// ─── 메인 페이지 ───────────────────────────────────────────────────────────

export default function ProductNewPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 공급사 정보
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState("")
  const [licenseVerified, setLicenseVerified] = useState(false)
  const [isLoadingSupplier, setIsLoadingSupplier] = useState(true)

  // 이미지
  const [imagePreviews, setImagePreviews] = useState<{ file: File; preview: string }[]>([])
  const [imageError, setImageError] = useState("")

  // 기본 정보
  const [productNameKo, setProductNameKo] = useState("")
  const [productNameEn, setProductNameEn] = useState("")
  const [brandName, setBrandName] = useState("")
  const [category, setCategory] = useState("")

  // 가격
  const [consumerPriceKrw, setConsumerPriceKrw] = useState("")
  const [priceRangeMin, setPriceRangeMin] = useState("")
  const [priceRangeMax, setPriceRangeMax] = useState("")

  // 생산
  const [moq, setMoq] = useState("")
  const [leadTimeDays, setLeadTimeDays] = useState("")

  // 인증
  const [certifications, setCertifications] = useState<string[]>([])
  const [fdaRegNumber, setFdaRegNumber] = useState("")

  // 수출 희망국 (태그)
  const [exportCountryInput, setExportCountryInput] = useState("")
  const [exportCountries, setExportCountries] = useState<string[]>([])

  // 상세 설명
  const [descriptionKo, setDescriptionKo] = useState("")
  const [descriptionEn, setDescriptionEn] = useState("")

  // 제출
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  // ─── 공급사 정보 로드 ───────────────────────────────────────────────────

  useEffect(() => {
    const loadSupplier = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/kbeauty/login"); return }

      const { data: supplier } = await supabase
        .from("beauty_suppliers")
        .select("id, company_name_ko, cosmetic_license_verified")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!supplier) { router.push("/kbeauty/dashboard/supplier"); return }

      setSupplierId(supplier.id)
      setCompanyName(supplier.company_name_ko)
      setLicenseVerified(supplier.cosmetic_license_verified)
      setIsLoadingSupplier(false)
    }
    loadSupplier()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── 이미지 선택 ────────────────────────────────────────────────────────

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError("")
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const remaining = MAX_IMAGES - imagePreviews.length
    if (remaining <= 0) {
      setImageError(`이미지는 최대 ${MAX_IMAGES}장까지 업로드할 수 있습니다.`)
      return
    }

    const toAdd = files.slice(0, remaining)
    const oversize = toAdd.find((f) => f.size > MAX_FILE_BYTES)
    if (oversize) {
      setImageError(`파일당 최대 5MB까지 업로드할 수 있습니다. (${oversize.name})`)
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    const newPreviews = toAdd.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setImagePreviews((prev) => [...prev, ...newPreviews])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const removeImage = (index: number) => {
    setImagePreviews((prev) => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  // ─── 수출 희망국 태그 ──────────────────────────────────────────────────

  const addExportCountry = () => {
    const value = exportCountryInput.trim()
    if (value && !exportCountries.includes(value)) {
      setExportCountries((prev) => [...prev, value])
    }
    setExportCountryInput("")
  }

  const handleExportCountryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addExportCountry()
    }
  }

  const removeExportCountry = (country: string) => {
    setExportCountries((prev) => prev.filter((c) => c !== country))
  }

  // ─── 인증 토글 ──────────────────────────────────────────────────────────

  const toggleCert = (cert: string) => {
    setCertifications((prev) =>
      prev.includes(cert) ? prev.filter((c) => c !== cert) : [...prev, cert]
    )
  }

  // ─── 제출 ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supplierId) return

    // 필수값 검증
    if (!productNameKo || !productNameEn || !brandName || !category) {
      setSubmitError("기본 정보(제품명·브랜드명·카테고리)를 모두 입력해주세요.")
      return
    }
    if (!consumerPriceKrw) {
      setSubmitError("국내 소비자가를 입력해주세요.")
      return
    }
    if (!descriptionKo || !descriptionEn) {
      setSubmitError("상세 설명(한국어·영어)을 모두 입력해주세요.")
      return
    }

    setIsSubmitting(true)
    setSubmitError("")

    try {
      // 이미지 압축 + 업로드
      const uploadedUrls: string[] = []
      for (const { file } of imagePreviews) {
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.8,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        })
        const safeName = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`
        const path = `${supplierId}/${safeName}`
        const { error: upErr } = await supabase.storage
          .from("kbeauty-products")
          .upload(path, compressed, { upsert: true })
        if (!upErr) {
          const { data } = supabase.storage.from("kbeauty-products").getPublicUrl(path)
          uploadedUrls.push(data.publicUrl)
        }
      }

      // DB insert
      const { error } = await supabase.from("beauty_products").insert({
        supplier_id: supplierId,
        product_name_ko: productNameKo,
        product_name_en: productNameEn,
        brand_name: brandName,
        category,
        consumer_price_krw: consumerPriceKrw ? Number(consumerPriceKrw) : null,
        price_range_min: priceRangeMin ? Number(priceRangeMin) : null,
        price_range_max: priceRangeMax ? Number(priceRangeMax) : null,
        moq: moq ? Number(moq) : null,
        lead_time_days: leadTimeDays ? Number(leadTimeDays) : null,
        certifications: certifications.length > 0 ? certifications : null,
        fda_registration_number:
          certifications.includes("FDA") ? fdaRegNumber || null : null,
        export_countries: exportCountries.length > 0 ? exportCountries : null,
        description_ko: descriptionKo,
        description_en: descriptionEn,
        images: uploadedUrls.length > 0
          ? uploadedUrls.map((url) => ({ url, alt: productNameEn }))
          : null,
        status: "pending",
      })

      if (error) {
        setSubmitError(
          `저장 중 오류가 발생했습니다. (오류코드: ${error.code ?? "unknown"}) 고객센터에 문의해주세요.`
        )
        return
      }

      router.push("/kbeauty/dashboard/supplier")
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
        setSubmitError("네트워크 연결을 확인해주세요.")
      } else {
        setSubmitError("서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── 스타일 상수 ────────────────────────────────────────────────────────

  const inputBase =
    "w-full px-4 py-3 border border-[#E8E2DA] rounded-lg text-sm text-[#0F0F0F] placeholder:text-[#6B6B6B]/50 hover:border-[#1A3A5C]/40 focus:border-[#1A3A5C] focus:outline-none transition-colors duration-200"

  const labelBase = "block text-sm font-medium text-[#0F0F0F] mb-2"

  const required = <span className="text-[#1A3A5C]"> *</span>

  // ─── 로딩 중 ────────────────────────────────────────────────────────────

  if (isLoadingSupplier) {
    return (
      <div className="min-h-screen bg-[#F8F7F5] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#1A3A5C]" />
      </div>
    )
  }

  // ─── 렌더 ───────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen bg-[#F8F7F5]"
      style={{
        fontFamily:
          '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      }}
    >
      <Sidebar companyName={companyName} licenseVerified={licenseVerified} />

      <main style={{ marginLeft: 240 }} className="min-h-screen">
        <div className="max-w-[760px] mx-auto px-8 py-10">

          {/* 헤더 */}
          <div className="flex items-center gap-3 mb-8">
            <Link
              href="/kbeauty/dashboard/supplier"
              className="p-2 rounded-lg hover:bg-[#E8E2DA] transition-colors text-[#6B6B6B] hover:text-[#0F0F0F]"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-[#0F0F0F]">제품 등록</h1>
              <p className="text-xs text-[#6B6B6B] mt-0.5">
                등록 후 관리자 승인(pending) 시 바이어에게 노출됩니다.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">

            {/* ── 이미지 업로드 ─────────────────────────────────────────── */}
            <section className="bg-white border border-[#E8E2DA] rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
              <h2 className="text-sm font-semibold text-[#0F0F0F] mb-1">제품 이미지</h2>
              <p className="text-xs text-[#6B6B6B] mb-4">
                최대 5장 · 파일당 5MB 이하 · JPG·PNG·WEBP
              </p>

              {/* 미리보기 그리드 */}
              <div className="flex flex-wrap gap-3 mb-3">
                {imagePreviews.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative w-24 h-24 rounded-lg overflow-hidden border border-[#E8E2DA] bg-[#F8F7F5]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.preview}
                      alt={`preview-${idx}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}

                {/* 추가 버튼 */}
                {imagePreviews.length < MAX_IMAGES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 h-24 rounded-lg border-[1.5px] border-dashed border-[#E8E2DA] flex flex-col items-center justify-center gap-1 hover:border-[#1A3A5C]/40 hover:bg-[#F8F7F5] transition-colors text-[#6B6B6B]"
                  >
                    <ImagePlus className="w-5 h-5" />
                    <span className="text-[11px]">{imagePreviews.length}/{MAX_IMAGES}</span>
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleImageSelect}
              />

              {imageError && (
                <p className="text-xs text-red-500 mt-1">{imageError}</p>
              )}
            </section>

            {/* ── 기본 정보 ────────────────────────────────────────────── */}
            <section className="bg-white border border-[#E8E2DA] rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
              <h2 className="text-sm font-semibold text-[#0F0F0F] mb-5">기본 정보</h2>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelBase}>제품명 (한국어){required}</label>
                  <input
                    type="text"
                    value={productNameKo}
                    onChange={(e) => setProductNameKo(e.target.value)}
                    placeholder="예: 수분 앰플 세럼"
                    className={inputBase}
                  />
                </div>
                <div>
                  <label className={labelBase}>제품명 (English){required}</label>
                  <input
                    type="text"
                    value={productNameEn}
                    onChange={(e) => setProductNameEn(e.target.value)}
                    placeholder="e.g. Hydrating Ampoule Serum"
                    className={inputBase}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className={labelBase}>브랜드명{required}</label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="예: COSLAB"
                    className={inputBase}
                  />
                </div>
                <div>
                  <label className={labelBase}>카테고리{required}</label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setCategory(cat.value)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                          category === cat.value
                            ? "bg-[#1A3A5C] border-[#1A3A5C] text-white"
                            : "bg-white border-[#E8E2DA] text-[#6B6B6B] hover:border-[#1A3A5C]/40"
                        )}
                      >
                        {cat.ko}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* ── 가격 정보 ────────────────────────────────────────────── */}
            <section className="bg-white border border-[#E8E2DA] rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
              <h2 className="text-sm font-semibold text-[#0F0F0F] mb-5">가격 정보</h2>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className={labelBase}>국내 소비자가{required}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B6B6B]">₩</span>
                    <input
                      type="number"
                      min="0"
                      value={consumerPriceKrw}
                      onChange={(e) => setConsumerPriceKrw(e.target.value)}
                      placeholder="15000"
                      className={cn(inputBase, "pl-7")}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelBase}>수출 희망가 (최소)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B6B6B]">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={priceRangeMin}
                      onChange={(e) => setPriceRangeMin(e.target.value)}
                      placeholder="5.00"
                      className={cn(inputBase, "pl-7")}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelBase}>수출 희망가 (최대)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B6B6B]">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={priceRangeMax}
                      onChange={(e) => setPriceRangeMax(e.target.value)}
                      placeholder="12.00"
                      className={cn(inputBase, "pl-7")}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* ── 생산 정보 ────────────────────────────────────────────── */}
            <section className="bg-white border border-[#E8E2DA] rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
              <h2 className="text-sm font-semibold text-[#0F0F0F] mb-5">생산 정보</h2>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className={labelBase}>MOQ (최소 주문 수량)</label>
                  <input
                    type="number"
                    min="0"
                    value={moq}
                    onChange={(e) => setMoq(e.target.value)}
                    placeholder="500"
                    className={inputBase}
                  />
                </div>
                <div>
                  <label className={labelBase}>리드타임 (일)</label>
                  <input
                    type="number"
                    min="0"
                    value={leadTimeDays}
                    onChange={(e) => setLeadTimeDays(e.target.value)}
                    placeholder="30"
                    className={inputBase}
                  />
                </div>
              </div>
            </section>

            {/* ── 인증 ─────────────────────────────────────────────────── */}
            <section className="bg-white border border-[#E8E2DA] rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
              <h2 className="text-sm font-semibold text-[#0F0F0F] mb-1">인증 보유</h2>
              <p className="text-xs text-[#6B6B6B] mb-4">복수 선택 가능</p>

              <div className="flex flex-wrap gap-3 mb-4">
                {CERT_OPTIONS.map((cert) => (
                  <label key={cert} className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => toggleCert(cert)}
                      className={cn(
                        "w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer",
                        certifications.includes(cert)
                          ? "bg-[#1A3A5C]"
                          : "bg-white border-[1.5px] border-[#E8E2DA]"
                      )}
                    >
                      {certifications.includes(cert) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className="text-sm text-[#0F0F0F]">{cert}</span>
                  </label>
                ))}
              </div>

              {/* FDA 등록번호 조건부 */}
              {certifications.includes("FDA") && (
                <div>
                  <label className={labelBase}>FDA 등록번호</label>
                  <input
                    type="text"
                    value={fdaRegNumber}
                    onChange={(e) => setFdaRegNumber(e.target.value)}
                    placeholder="FDA Registration Number"
                    className={inputBase}
                  />
                </div>
              )}
            </section>

            {/* ── 수출 희망국 ──────────────────────────────────────────── */}
            <section className="bg-white border border-[#E8E2DA] rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
              <h2 className="text-sm font-semibold text-[#0F0F0F] mb-1">수출 희망국</h2>
              <p className="text-xs text-[#6B6B6B] mb-4">
                국가명 입력 후 Enter 또는 쉼표(,) 키로 추가
              </p>

              {/* 태그 목록 */}
              {exportCountries.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {exportCountries.map((country) => (
                    <span
                      key={country}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1A3A5C]/[0.08] text-[#1A3A5C] text-xs font-medium rounded-full"
                    >
                      {country}
                      <button
                        type="button"
                        onClick={() => removeExportCountry(country)}
                        className="hover:text-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={exportCountryInput}
                onChange={(e) => setExportCountryInput(e.target.value)}
                onKeyDown={handleExportCountryKeyDown}
                onBlur={addExportCountry}
                placeholder="예: United States, Japan, Singapore"
                className={inputBase}
              />
            </section>

            {/* ── 상세 설명 ────────────────────────────────────────────── */}
            <section className="bg-white border border-[#E8E2DA] rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
              <h2 className="text-sm font-semibold text-[#0F0F0F] mb-5">상세 설명</h2>

              <div className="mb-4">
                <label className={labelBase}>상세 설명 (한국어){required}</label>
                <textarea
                  value={descriptionKo}
                  onChange={(e) => setDescriptionKo(e.target.value)}
                  placeholder="제품의 주요 성분, 효능, 사용 방법을 작성해주세요."
                  rows={4}
                  className={cn(inputBase, "resize-none")}
                />
              </div>

              <div>
                <label className={labelBase}>상세 설명 (English){required}</label>
                <textarea
                  value={descriptionEn}
                  onChange={(e) => setDescriptionEn(e.target.value)}
                  placeholder="Describe key ingredients, benefits, and how to use."
                  rows={4}
                  className={cn(inputBase, "resize-none")}
                />
              </div>
            </section>

            {/* ── 에러 + 제출 버튼 ────────────────────────────────────── */}
            {submitError && (
              <p className="text-sm text-red-500">{submitError}</p>
            )}

            <div className="flex gap-3 pb-10">
              <Link
                href="/kbeauty/dashboard/supplier"
                className="flex-1 text-center py-3.5 border border-[#E8E2DA] rounded-lg text-sm font-medium text-[#6B6B6B] hover:bg-[#F8F7F5] transition-colors"
              >
                취소
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  "flex-[2] bg-[#1A3A5C] text-white font-semibold py-3.5 rounded-lg text-[15px] transition-colors inline-flex items-center justify-center gap-2",
                  isSubmitting ? "opacity-60 cursor-not-allowed" : "hover:bg-[#153249]"
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  "제품 등록 →"
                )}
              </button>
            </div>

          </form>
        </div>
      </main>
    </div>
  )
}
