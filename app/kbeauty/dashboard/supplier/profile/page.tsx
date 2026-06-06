"use client"

import { useEffect, useState, type KeyboardEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
  LayoutDashboard,
  Package,
  Handshake,
  Settings,
  UserCircle,
  CheckCircle2,
  Clock,
  Save,
  X,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

// ─── 상수 ──────────────────────────────────────────────────────────────────

const CATEGORIES: { ko: string; value: string }[] = [
  { ko: "스킨케어", value: "skincare" },
  { ko: "클렌징", value: "cleansing" },
  { ko: "선케어", value: "suncare" },
  { ko: "메이크업", value: "makeup" },
  { ko: "헤어", value: "haircare" },
  { ko: "바디", value: "body" },
  { ko: "더마", value: "derma" },
]

const LICENSE_TYPE_LABELS: Record<string, string> = {
  manufacturer: "화장품 제조업체",
  responsible_seller: "화장품 책임판매업체",
}

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
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/kbeauty/dashboard/supplier/profile"
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
              style={
                isActive
                  ? { color: "#1A3A5C", fontWeight: 600, background: "#EEF2F7" }
                  : { color: "#6B6B6B" }
              }
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
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

// ─── 타입 ──────────────────────────────────────────────────────────────────

interface SupplierProfile {
  id: string
  company_name_ko: string
  company_name_en: string | null
  website: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  business_registration_number: string | null
  business_registration_verified: boolean
  cosmetic_license_type: string | null
  cosmetic_license_verified: boolean
  fda_status: string | null
  fda_registration_number: string | null
  categories: string[] | null
  iso_22716: boolean
  iso_22716_url: string | null
  vegan_certified: boolean
  vegan_cert_org: string | null
  vegan_cert_url: string | null
  cruelty_free_certified: boolean
  cruelty_free_cert_org: string | null
  cruelty_free_cert_url: string | null
  export_experience: string | null
  export_countries: unknown
}

// ─── 메인 페이지 ───────────────────────────────────────────────────────────

export default function SupplierProfilePage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [profile, setProfile] = useState<SupplierProfile | null>(null)
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // ② 기본 정보
  const [companyNameKo, setCompanyNameKo] = useState("")
  const [companyNameEn, setCompanyNameEn] = useState("")
  const [website, setWebsite] = useState("")
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")

  // ④ 카테고리
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  // ⑤ 인증 보유 현황
  const [iso22716, setIso22716] = useState(false)
  const [iso22716Url, setIso22716Url] = useState("")
  const [veganCertified, setVeganCertified] = useState(false)
  const [veganCertOrg, setVeganCertOrg] = useState("")
  const [veganCertUrl, setVeganCertUrl] = useState("")
  const [crueltyFreeCertified, setCrueltyFreeCertified] = useState(false)
  const [crueltyFreeCertOrg, setCrueltyFreeCertOrg] = useState("")
  const [crueltyFreeCertUrl, setCrueltyFreeCertUrl] = useState("")

  // ⑥ 수출 정보
  const [exportExperience, setExportExperience] = useState("")
  const [exportCountries, setExportCountries] = useState<string[]>([])
  const [countryInput, setCountryInput] = useState("")

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/kbeauty/supplier/login")
        return
      }

      const { data, error } = await supabase
        .from("beauty_suppliers")
        .select(
          "id, company_name_ko, company_name_en, website, contact_name, contact_email, contact_phone, business_registration_number, business_registration_verified, cosmetic_license_type, cosmetic_license_verified, fda_status, fda_registration_number, categories, iso_22716, iso_22716_url, vegan_certified, vegan_cert_org, vegan_cert_url, cruelty_free_certified, cruelty_free_cert_org, cruelty_free_cert_url, export_experience, export_countries"
        )
        .eq("user_id", user.id)
        .single()

      if (error || !data) {
        toast.error("공급사 정보를 불러오지 못했습니다.")
        setLoading(false)
        return
      }

      const p = data as SupplierProfile
      setProfile(p)
      setSupplierId(p.id)

      // 폼 초기화
      setCompanyNameKo(p.company_name_ko ?? "")
      setCompanyNameEn(p.company_name_en ?? "")
      setWebsite(p.website ?? "")
      setContactName(p.contact_name ?? "")
      setContactEmail(p.contact_email ?? "")
      setContactPhone(p.contact_phone ?? "")
      setSelectedCategories(Array.isArray(p.categories) ? p.categories : [])
      setIso22716(p.iso_22716 ?? false)
      setIso22716Url(p.iso_22716_url ?? "")
      setVeganCertified(p.vegan_certified ?? false)
      setVeganCertOrg(p.vegan_cert_org ?? "")
      setVeganCertUrl(p.vegan_cert_url ?? "")
      setCrueltyFreeCertified(p.cruelty_free_certified ?? false)
      setCrueltyFreeCertOrg(p.cruelty_free_cert_org ?? "")
      setCrueltyFreeCertUrl(p.cruelty_free_cert_url ?? "")
      setExportExperience(p.export_experience ?? "")

      // export_countries: TEXT[] 또는 TEXT 형태 모두 대응
      const raw = p.export_countries
      if (Array.isArray(raw)) {
        setExportCountries((raw as string[]).filter(Boolean))
      } else if (typeof raw === "string" && raw.trim()) {
        setExportCountries(
          raw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        )
      } else {
        setExportCountries([])
      }

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleCategory(value: string) {
    setSelectedCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    )
  }

  function handleCountryKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" && e.key !== ",") return
    e.preventDefault()
    const val = countryInput.trim()
    if (val && !exportCountries.includes(val)) {
      setExportCountries((prev) => [...prev, val])
    }
    setCountryInput("")
  }

  function removeCountry(country: string) {
    setExportCountries((prev) => prev.filter((c) => c !== country))
  }

  async function handleSave() {
    if (!supplierId) return
    if (!companyNameKo.trim()) {
      toast.error("회사명(한국어)을 입력해주세요.")
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from("beauty_suppliers")
        .update({
          company_name_ko: companyNameKo.trim(),
          company_name_en: companyNameEn.trim() || null,
          website: website.trim() || null,
          contact_name: contactName.trim() || null,
          contact_email: contactEmail.trim() || null,
          contact_phone: contactPhone.trim() || null,
          categories: selectedCategories.length > 0 ? selectedCategories : null,
          iso_22716: iso22716,
          iso_22716_url: iso22716 ? iso22716Url.trim() || null : null,
          vegan_certified: veganCertified,
          vegan_cert_org: veganCertified ? veganCertOrg.trim() || null : null,
          vegan_cert_url: veganCertified ? veganCertUrl.trim() || null : null,
          cruelty_free_certified: crueltyFreeCertified,
          cruelty_free_cert_org: crueltyFreeCertified ? crueltyFreeCertOrg.trim() || null : null,
          cruelty_free_cert_url: crueltyFreeCertified ? crueltyFreeCertUrl.trim() || null : null,
          export_experience: exportExperience.trim() || null,
          export_countries: exportCountries.length > 0 ? exportCountries : null,
        })
        .eq("id", supplierId)

      if (error) throw error
      toast.success("프로필이 저장되었습니다.")
    } catch (err) {
      console.error(err)
      toast.error("저장 중 오류가 발생했습니다.")
    } finally {
      setSaving(false)
    }
  }

  // ─── 스타일 헬퍼 ──────────────────────────────────────────────────────────

  const inputClass =
    "border border-[#E8E2DA] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1A3A5C] transition-colors bg-white w-full"
  const labelClass = "block text-xs font-medium text-[#6B6B6B] mb-1"
  const sectionClass = "bg-white border border-[#E8E2DA] mb-6"
  const sectionStyle = { borderRadius: 12, padding: 24 }

  // ─── 로딩 / 에러 ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        style={{
          fontFamily: '"Pretendard Variable", Pretendard, sans-serif',
          background: "#F8F7F5",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Toaster position="top-right" richColors />
        <p className="text-sm text-[#6B6B6B]">불러오는 중...</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div
        style={{
          fontFamily: '"Pretendard Variable", Pretendard, sans-serif',
          background: "#F8F7F5",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Toaster position="top-right" richColors />
        <p className="text-sm text-[#6B6B6B]">공급사 정보를 찾을 수 없습니다.</p>
      </div>
    )
  }

  // ─── 렌더 ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        fontFamily: '"Pretendard Variable", Pretendard, sans-serif',
        background: "#F8F7F5",
        minHeight: "100vh",
      }}
    >
      <Toaster position="top-right" richColors />
      <Sidebar
        companyName={profile.company_name_ko}
        licenseVerified={profile.cosmetic_license_verified}
      />

      <main style={{ marginLeft: 240, padding: "32px 36px", maxWidth: 840 }}>
        {/* ① 헤더 */}
        <div className="flex items-center gap-2 mb-6">
          <Link
            href="/kbeauty/dashboard/supplier"
            className="inline-flex items-center gap-1 text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            대시보드
          </Link>
          <span className="text-[#E8E2DA] text-sm">/</span>
          <span className="text-sm font-medium text-[#0F0F0F]">프로필 관리</span>
        </div>

        <h1 className="text-xl font-bold text-[#0F0F0F] mb-6">프로필 관리</h1>

        {/* ② 기본 정보 */}
        <div className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-semibold text-[#1A3A5C] mb-4">기본 정보</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelClass}>
                회사명 (한국어) <span className="text-red-500">*</span>
              </label>
              <input
                className={inputClass}
                value={companyNameKo}
                onChange={(e) => setCompanyNameKo(e.target.value)}
                placeholder="예: 한국뷰티주식회사"
              />
            </div>
            <div>
              <label className={labelClass}>회사명 (영어)</label>
              <input
                className={inputClass}
                value={companyNameEn}
                onChange={(e) => setCompanyNameEn(e.target.value)}
                placeholder="예: Korea Beauty Co., Ltd."
              />
            </div>
          </div>
          <div className="mb-4">
            <label className={labelClass}>웹사이트</label>
            <input
              className={inputClass}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://"
              type="url"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>담당자 이름</label>
              <input
                className={inputClass}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className={labelClass}>담당자 이메일</label>
              <input
                className={inputClass}
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="contact@company.com"
                type="email"
              />
            </div>
            <div>
              <label className={labelClass}>담당자 연락처</label>
              <input
                className={inputClass}
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="010-0000-0000"
              />
            </div>
          </div>
        </div>

        {/* ③ 인증 정보 (읽기 전용) */}
        <div className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-semibold text-[#1A3A5C] mb-1">인증 정보</h2>
          <p className="text-xs text-[#6B6B6B] mb-4">인증 정보는 관리자만 수정할 수 있습니다.</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className={labelClass}>사업자등록번호</p>
              <p className="text-sm text-[#0F0F0F] font-medium">
                {profile.business_registration_number || "—"}
              </p>
            </div>
            <div>
              <p className={labelClass}>사업자등록 인증</p>
              {profile.business_registration_verified ? (
                <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                  <CheckCircle2 className="w-3 h-3" /> 인증 완료
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  <Clock className="w-3 h-3" /> 인증 대기
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className={labelClass}>화장품 제조/판매업 유형</p>
              <p className="text-sm text-[#0F0F0F]">
                {profile.cosmetic_license_type
                  ? LICENSE_TYPE_LABELS[profile.cosmetic_license_type] ??
                    profile.cosmetic_license_type
                  : "—"}
              </p>
            </div>
            <div>
              <p className={labelClass}>화장품 허가 인증</p>
              {profile.cosmetic_license_verified ? (
                <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                  <CheckCircle2 className="w-3 h-3" /> 인증 완료
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  <Clock className="w-3 h-3" /> 인증 대기
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={labelClass}>FDA 상태</p>
              <p className="text-sm text-[#0F0F0F]">{profile.fda_status || "해당 없음"}</p>
            </div>
            <div>
              <p className={labelClass}>FDA 등록번호</p>
              <p className="text-sm text-[#0F0F0F]">{profile.fda_registration_number || "—"}</p>
            </div>
          </div>
        </div>

        {/* ④ 취급 카테고리 */}
        <div className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-semibold text-[#1A3A5C] mb-4">취급 카테고리</h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => {
              const active = selectedCategories.includes(cat.value)
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => toggleCategory(cat.value)}
                  className="px-3 py-1.5 text-sm rounded-full border transition-colors"
                  style={
                    active
                      ? { background: "#1A3A5C", color: "#fff", borderColor: "#1A3A5C" }
                      : { background: "#fff", color: "#6B6B6B", borderColor: "#E8E2DA" }
                  }
                >
                  {cat.ko}
                </button>
              )
            })}
          </div>
        </div>

        {/* ⑤ 인증 보유 현황 */}
        <div className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-semibold text-[#1A3A5C] mb-4">인증 보유 현황</h2>

          {/* ISO 22716 */}
          <div className="mb-5">
            <div className="flex items-center gap-3 mb-2">
              <button
                type="button"
                onClick={() => setIso22716(!iso22716)}
                className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
                style={{ background: iso22716 ? "#1A3A5C" : "#E8E2DA" }}
                aria-checked={iso22716}
                role="switch"
              >
                <span
                  className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                  style={{ transform: iso22716 ? "translateX(16px)" : "translateX(0)" }}
                />
              </button>
              <span className="text-sm font-medium text-[#0F0F0F]">ISO 22716 (GMP)</span>
            </div>
            {iso22716 && (
              <div className="pl-12">
                <label className={labelClass}>인증서 URL</label>
                <input
                  className={inputClass}
                  value={iso22716Url}
                  onChange={(e) => setIso22716Url(e.target.value)}
                  placeholder="https://"
                />
              </div>
            )}
          </div>

          {/* 비건 인증 */}
          <div className="mb-5">
            <div className="flex items-center gap-3 mb-2">
              <button
                type="button"
                onClick={() => setVeganCertified(!veganCertified)}
                className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
                style={{ background: veganCertified ? "#1A3A5C" : "#E8E2DA" }}
                aria-checked={veganCertified}
                role="switch"
              >
                <span
                  className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                  style={{ transform: veganCertified ? "translateX(16px)" : "translateX(0)" }}
                />
              </button>
              <span className="text-sm font-medium text-[#0F0F0F]">비건 인증</span>
            </div>
            {veganCertified && (
              <div className="pl-12 grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>인증 기관</label>
                  <input
                    className={inputClass}
                    value={veganCertOrg}
                    onChange={(e) => setVeganCertOrg(e.target.value)}
                    placeholder="예: The Vegan Society"
                  />
                </div>
                <div>
                  <label className={labelClass}>인증서 URL</label>
                  <input
                    className={inputClass}
                    value={veganCertUrl}
                    onChange={(e) => setVeganCertUrl(e.target.value)}
                    placeholder="https://"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 크루얼티 프리 */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button
                type="button"
                onClick={() => setCrueltyFreeCertified(!crueltyFreeCertified)}
                className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
                style={{ background: crueltyFreeCertified ? "#1A3A5C" : "#E8E2DA" }}
                aria-checked={crueltyFreeCertified}
                role="switch"
              >
                <span
                  className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                  style={{
                    transform: crueltyFreeCertified ? "translateX(16px)" : "translateX(0)",
                  }}
                />
              </button>
              <span className="text-sm font-medium text-[#0F0F0F]">크루얼티 프리</span>
            </div>
            {crueltyFreeCertified && (
              <div className="pl-12 grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>인증 기관</label>
                  <input
                    className={inputClass}
                    value={crueltyFreeCertOrg}
                    onChange={(e) => setCrueltyFreeCertOrg(e.target.value)}
                    placeholder="예: Leaping Bunny"
                  />
                </div>
                <div>
                  <label className={labelClass}>인증서 URL</label>
                  <input
                    className={inputClass}
                    value={crueltyFreeCertUrl}
                    onChange={(e) => setCrueltyFreeCertUrl(e.target.value)}
                    placeholder="https://"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ⑥ 수출 정보 */}
        <div className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-semibold text-[#1A3A5C] mb-4">수출 정보</h2>
          <div className="mb-4">
            <label className={labelClass}>수출 경험</label>
            <textarea
              className={inputClass}
              style={{ minHeight: 80, resize: "vertical" }}
              value={exportExperience}
              onChange={(e) => setExportExperience(e.target.value)}
              placeholder="수출 경험, 주요 수출 국가, 수출 이력 등을 자유롭게 기재해주세요."
            />
          </div>
          <div>
            <label className={labelClass}>수출 가능 국가 (Enter 또는 쉼표로 추가)</label>
            <div
              className="border border-[#E8E2DA] rounded-lg p-2 bg-white min-h-[44px] flex flex-wrap gap-1.5 items-center focus-within:border-[#1A3A5C] transition-colors cursor-text"
            >
              {exportCountries.map((country) => (
                <span
                  key={country}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                  style={{ background: "#EEF2F7", color: "#1A3A5C" }}
                >
                  {country}
                  <button
                    type="button"
                    onClick={() => removeCountry(country)}
                    className="hover:opacity-70"
                    aria-label={`${country} 제거`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={countryInput}
                onChange={(e) => setCountryInput(e.target.value)}
                onKeyDown={handleCountryKeyDown}
                className="flex-1 min-w-[120px] text-sm outline-none bg-transparent"
                placeholder={exportCountries.length === 0 ? "예: 미국, 일본, 베트남" : "국가 추가..."}
              />
            </div>
          </div>
        </div>

        {/* 저장 버튼 */}
        <div className="flex justify-end pb-10">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-opacity disabled:opacity-50"
            style={{ background: "#1A3A5C" }}
          >
            <Save className="w-4 h-4" />
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </main>
    </div>
  )
}
