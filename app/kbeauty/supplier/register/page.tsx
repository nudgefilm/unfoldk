"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Shield, Instagram, Linkedin, Upload, X, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { BeautyNavbar } from "@/components/kbeauty/BeautyNavbar"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

const GOOGLE_SVG = (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

// Hero Header Section
function HeroHeader() {
  return (
    <section className="bg-white pt-16 pb-10 px-6">
      <div className="max-w-[600px] mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-[#1A3A5C]/[0.08] rounded-[20px] px-4 py-2 mb-6">
          <Shield className="w-4 h-4 text-[#1A3A5C]" />
          <span className="text-xs text-[#6B6B6B]">국세청 API 자동 인증</span>
        </div>

        <h1 className="font-serif text-4xl md:text-[48px] text-[#0F0F0F] mb-4">
          공급사 파트너 신청
        </h1>

        <p className="text-base text-[#6B6B6B] leading-[1.7]">
          사업자번호 인증 후 즉시 대시보드에 접근하세요.
          <br />
          검증된 북미 바이어 2,000개사가 기다리고 있습니다.
        </p>
      </div>
    </section>
  )
}

// Step Indicator Component
function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { number: 1, label: "사업자 인증" },
    { number: 2, label: "정보 입력" },
    { number: 3, label: "완료" },
  ]

  return (
    <div className="flex items-center justify-center mb-10">
      {steps.map((step, index) => (
        <div key={step.number} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                currentStep > step.number
                  ? "bg-[#1A3A5C] text-white"
                  : currentStep === step.number
                  ? "bg-[#1A3A5C] text-white"
                  : "bg-white border-[1.5px] border-[#E8E2DA] text-[#6B6B6B]"
              )}
            >
              {currentStep > step.number ? (
                <Check className="w-4 h-4" />
              ) : (
                step.number
              )}
            </div>
            <span
              className={cn(
                "text-xs mt-2 whitespace-nowrap",
                currentStep >= step.number
                  ? "text-[#0F0F0F] font-semibold"
                  : "text-[#6B6B6B]"
              )}
            >
              {step.label}
            </span>
          </div>

          {index < steps.length - 1 && (
            <div className="w-16 h-px bg-[#E8E2DA] mx-3 -mt-5" />
          )}
        </div>
      ))}
    </div>
  )
}

// Form Card Component
function SupplierForm() {
  const router = useRouter()
  const [businessNumber, setBusinessNumber] = useState("")
  const [isVerified, setIsVerified] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [showLoginLink, setShowLoginLink] = useState(false)
  const [representativeName, setRepresentativeName] = useState("")
  const [companyNameKo, setCompanyNameKo] = useState("")
  const [companyNameEn, setCompanyNameEn] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [website, setWebsite] = useState("")
  const [fdaStatus, setFdaStatus] = useState("")
  const [fdaRegNumber, setFdaRegNumber] = useState("")
  const [categories, setCategories] = useState<string[]>([])
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  // 인증 및 서류
  const [licenseNotReady, setLicenseNotReady] = useState(false)
  const [cosmeticLicenseType, setCosmeticLicenseType] = useState("")
  const [cosmeticLicenseFile, setCosmeticLicenseFile] = useState<File | null>(null)
  const [iso22716, setIso22716] = useState("")
  const [iso22716File, setIso22716File] = useState<File | null>(null)
  const [veganCertified, setVeganCertified] = useState("")
  const [veganCertOrg, setVeganCertOrg] = useState("")
  const [veganCertFile, setVeganCertFile] = useState<File | null>(null)
  const [crueltyFree, setCrueltyFree] = useState("")
  const [crueltyFreeCertOrg, setCrueltyFreeCertOrg] = useState("")
  const [crueltyFreeCertFile, setCrueltyFreeCertFile] = useState<File | null>(null)
  const [exportExperience, setExportExperience] = useState("")
  const [exportCountries, setExportCountries] = useState("")

  const categoryOptions = [
    "스킨케어",
    "메이크업",
    "헤어·바디",
    "선케어",
    "더마·기능성",
  ]

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)
    const supabase = createSupabaseBrowserClient()
    const origin =
      window.location.hostname === "localhost"
        ? window.location.origin
        : "https://www.unfoldk.com"
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/api/kbeauty/auth/callback` },
    })
    if (oauthError) setIsGoogleLoading(false)
  }

  const handleVerify = async () => {
    if (!businessNumber.trim()) return
    setIsVerifying(true)
    setVerifyError("")
    try {
      const res = await fetch("/api/kbeauty/verify-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessNumber }),
      })
      const data = await res.json()
      if (!res.ok) {
        setVerifyError(data.error ?? "인증에 실패했습니다.")
        return
      }
      setIsVerified(true)
    } catch {
      setVerifyError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도하세요.")
    } finally {
      setIsVerifying(false)
    }
  }

  const handleCategoryToggle = (category: string) => {
    setCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    )
  }

  const handleSubmit = async () => {
    if (!isVerified) {
      setSubmitError("사업자번호 인증을 먼저 완료해주세요.")
      return
    }
    if (!companyNameKo || !companyNameEn || !representativeName || !email || !phone) {
      setSubmitError("필수 항목을 모두 입력해주세요.")
      return
    }
    if (!password || password.length < 6) {
      setSubmitError("비밀번호는 6자리 이상이어야 합니다.")
      return
    }
    if (password !== confirmPassword) {
      setSubmitError("비밀번호가 일치하지 않습니다.")
      return
    }
    if (!licenseNotReady && !cosmeticLicenseType) {
      setSubmitError("화장품 등록필증 종류를 선택해주세요.")
      return
    }
    if (!licenseNotReady && !cosmeticLicenseFile) {
      setSubmitError("화장품 등록필증 파일을 업로드해주세요.")
      return
    }

    setIsSubmitting(true)
    setSubmitError("")
    setShowLoginLink(false)

    try {
      // 1. 서버사이드 API로 계정 생성 (확인 이메일 미발송)
      const signupRes = await fetch("/api/kbeauty/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const signupData = await signupRes.json()

      if (!signupRes.ok) {
        const msg = signupData.error || ""
        if (msg === "already_registered" || msg.toLowerCase().includes("already registered")) {
          setSubmitError("이미 가입된 이메일입니다. 로그인해주세요.")
          setShowLoginLink(true)
        } else if (msg.toLowerCase().includes("password") || msg.includes("6 characters")) {
          setSubmitError("비밀번호는 6자리 이상이어야 합니다.")
        } else if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
          setSubmitError("네트워크 연결을 확인해주세요.")
        } else {
          setSubmitError("오류가 발생했습니다. 고객센터에 문의해주세요.")
        }
        return
      }

      const supabase = createSupabaseBrowserClient()

      // 2. 계정 생성 직후 로그인으로 세션 확보 (미들웨어 통과)
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) {
        setSubmitError("계정 생성 후 로그인에 실패했습니다. 로그인 페이지에서 다시 시도해주세요.")
        setShowLoginLink(true)
        return
      }

      // 파일 업로드 헬퍼 (signIn 세션 확보 후 RLS 통과)
      const uploadDoc = async (file: File): Promise<string | null> => {
        const safeName = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`
        const path = `suppliers/${signupData.userId}/${safeName}`
        const { error: upErr } = await supabase.storage
          .from("kbeauty-documents")
          .upload(path, file, { upsert: true })
        return upErr ? null : path
      }

      const cosmeticLicenseUrl = cosmeticLicenseFile ? await uploadDoc(cosmeticLicenseFile) : null
      const iso22716Url = iso22716 === "보유" && iso22716File ? await uploadDoc(iso22716File) : null
      const veganCertUrl = veganCertified === "보유" && veganCertFile ? await uploadDoc(veganCertFile) : null
      const crueltyFreeCertUrl = crueltyFree === "보유" && crueltyFreeCertFile ? await uploadDoc(crueltyFreeCertFile) : null

      // 3. beauty_suppliers 레코드 삽입
      const { error } = await supabase.from("beauty_suppliers").insert({
        user_id: signupData.userId,
        business_registration_number: businessNumber.replace(/-/g, ""),
        business_registration_verified: true,
        company_name_ko: companyNameKo,
        company_name_en: companyNameEn,
        contact_name: representativeName,
        contact_email: email,
        contact_phone: phone,
        categories,
        website: website
          ? /^https?:\/\//i.test(website) ? website : `https://${website}`
          : null,
        fda_status: fdaStatus || null,
        cosmetic_license_type: licenseNotReady ? "준비중" : (cosmeticLicenseType || null),
        cosmetic_license_url: cosmeticLicenseUrl,
        fda_registration_number: fdaStatus === "등록 완료" ? fdaRegNumber || null : null,
        iso_22716: iso22716 === "보유",
        iso_22716_url: iso22716Url,
        vegan_certified: veganCertified === "보유",
        vegan_cert_org: veganCertified === "보유" ? veganCertOrg || null : null,
        vegan_cert_url: veganCertUrl,
        cruelty_free_certified: crueltyFree === "보유",
        cruelty_free_cert_org: crueltyFree === "보유" ? crueltyFreeCertOrg || null : null,
        cruelty_free_cert_url: crueltyFreeCertUrl,
        export_experience: exportExperience || null,
        export_countries: exportExperience === "수출 경험 있음" ? exportCountries || null : null,
        status: "active",
        source: "direct_signup",
      })

      if (error) {
        if (error.code === "23505") {
          setSubmitError("이미 등록된 사업자번호입니다. 로그인해주세요.")
          setShowLoginLink(true)
        } else {
          setSubmitError(`오류가 발생했습니다. (오류코드: ${error.code ?? "unknown"}) 고객센터에 문의해주세요.`)
        }
        return
      }

      router.push("/kbeauty/dashboard/supplier")
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
        setSubmitError("네트워크 연결을 확인해주세요.")
      } else {
        setSubmitError("서버 오류가 발생했습니다.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputBaseClass =
    "w-full px-4 py-3 border border-[#E8E2DA] rounded-lg text-sm text-[#0F0F0F] placeholder:text-[#6B6B6B]/50 hover:border-[#1A3A5C]/40 focus:border-[#1A3A5C] focus:outline-none transition-colors duration-200"

  return (
    <div className="max-w-[560px] mx-auto px-6 mb-6">
      <div className="bg-white border border-[#E8E2DA] rounded-xl p-8 md:p-10 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading}
          className="w-full flex items-center justify-center gap-2.5 border border-[#E8E2DA] bg-white py-3.5 rounded-lg text-[15px] font-medium text-[#0F0F0F] hover:bg-[#F8F7F5] transition-colors disabled:opacity-60 mb-6"
        >
          {GOOGLE_SVG}
          {isGoogleLoading ? "연결 중..." : "Google로 계속하기"}
        </button>

        {/* 구분선 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-[#E8E2DA]" />
          <span className="text-xs text-[#6B6B6B]">또는</span>
          <div className="flex-1 h-px bg-[#E8E2DA]" />
        </div>

        {/* Business Number Field */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
            사업자등록번호 <span className="text-[#1A3A5C]">*</span>
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={businessNumber}
              onChange={(e) => setBusinessNumber(e.target.value)}
              placeholder="000-00-00000"
              disabled={isVerified}
              className={cn(
                inputBaseClass,
                "flex-1",
                isVerified && "bg-[#F8F7F5] cursor-not-allowed"
              )}
            />
            <button
              onClick={handleVerify}
              disabled={!businessNumber.trim() || isVerified || isVerifying}
              className={cn(
                "px-5 py-3 rounded-lg font-semibold text-sm whitespace-nowrap transition-colors",
                isVerified
                  ? "bg-[#E8E2DA] text-[#6B6B6B] cursor-not-allowed"
                  : businessNumber.trim() && !isVerifying
                  ? "bg-[#1A3A5C] text-white hover:bg-[#153249]"
                  : "bg-[#1A3A5C]/50 text-white/70 cursor-not-allowed"
              )}
            >
              {isVerified ? "인증완료" : isVerifying ? "확인 중..." : "인증하기"}
            </button>
          </div>
          {isVerified && (
            <div className="flex items-center gap-1.5 mt-2">
              <Check className="w-4 h-4 text-[#1A3A5C]" />
              <span className="text-[13px] text-[#1A3A5C]">사업자번호 인증됨</span>
            </div>
          )}
          {verifyError && (
            <p className="text-[13px] text-red-500 mt-2">{verifyError}</p>
          )}
        </div>

        <div className="border-t border-[#E8E2DA] my-7" />

        {/* Representative Name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
            대표자명 <span className="text-[#1A3A5C]">*</span>
          </label>
          <input
            type="text"
            value={representativeName}
            onChange={(e) => setRepresentativeName(e.target.value)}
            placeholder="홍길동"
            className={inputBaseClass}
          />
        </div>

        {/* Company Names - 2 Column */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
              회사명 (국문) <span className="text-[#1A3A5C]">*</span>
            </label>
            <input
              type="text"
              value={companyNameKo}
              onChange={(e) => setCompanyNameKo(e.target.value)}
              placeholder="회사명을 입력해주세요"
              className={inputBaseClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
              회사명 (English) <span className="text-[#1A3A5C]">*</span>
            </label>
            <input
              type="text"
              value={companyNameEn}
              onChange={(e) => setCompanyNameEn(e.target.value)}
              placeholder="Unfold Lab Inc."
              className={inputBaseClass}
            />
          </div>
        </div>

        {/* Email */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
            담당자 이메일 <span className="text-[#1A3A5C]">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@company.com"
            className={inputBaseClass}
          />
        </div>

        {/* Phone */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
            담당자 연락처 <span className="text-[#1A3A5C]">*</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-0000-0000"
            className={inputBaseClass}
          />
        </div>

        <div className="border-t border-[#E8E2DA] my-7" />

        {/* Password */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
            비밀번호 <span className="text-[#1A3A5C]">*</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8자 이상 입력"
            className={inputBaseClass}
          />
        </div>

        {/* Confirm Password */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
            비밀번호 확인 <span className="text-[#1A3A5C]">*</span>
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="비밀번호를 다시 입력해주세요"
            className={inputBaseClass}
          />
        </div>

        <div className="border-t border-[#E8E2DA] my-7" />

        {/* Categories */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#0F0F0F] mb-1">
            주요 카테고리 <span className="text-[#1A3A5C]">*</span>
          </label>
          <span className="text-[13px] text-[#6B6B6B] block mb-3">
            복수 선택 가능
          </span>
          <div className="grid grid-cols-2 gap-3">
            {categoryOptions.map((category) => (
              <label
                key={category}
                className="flex items-center gap-3 cursor-pointer"
              >
                <div
                  onClick={() => handleCategoryToggle(category)}
                  className={cn(
                    "w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer",
                    categories.includes(category)
                      ? "bg-[#1A3A5C] border-[#1A3A5C]"
                      : "bg-white border-[1.5px] border-[#E8E2DA]"
                  )}
                >
                  {categories.includes(category) && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </div>
                <span className="text-sm text-[#0F0F0F]">{category}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Website */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
            웹사이트 <span className="text-xs text-[#6B6B6B] font-normal">(선택)</span>
          </label>
          <div className="flex items-center border border-[#E8E2DA] rounded-lg overflow-hidden hover:border-[#1A3A5C]/40 focus-within:border-[#1A3A5C] transition-colors duration-200">
            <span className="px-3 py-3 text-sm text-[#6B6B6B] bg-[#F8F7F5] border-r border-[#E8E2DA] whitespace-nowrap select-none">
              https://
            </span>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="yourcompany.com"
              className="flex-1 px-3 py-3 text-sm text-[#0F0F0F] placeholder:text-[#6B6B6B]/50 focus:outline-none bg-white"
            />
          </div>
        </div>

        {/* 인증 및 서류 */}
        <div className="border-t border-[#E8E2DA] my-7" />
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-[#0F0F0F] mb-5">인증 및 서류</h3>

          {/* 화장품 등록필증 (필수 → 준비중 체크 시 해제) */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
              화장품 등록필증 <span className="text-[#1A3A5C]">*</span>
            </label>
            {/* 준비중 체크박스 */}
            <label className="flex items-center gap-2.5 cursor-pointer mb-3">
              <div
                onClick={() => {
                  setLicenseNotReady(!licenseNotReady)
                  setCosmeticLicenseType("")
                  setCosmeticLicenseFile(null)
                }}
                className={cn(
                  "w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer",
                  licenseNotReady
                    ? "bg-[#1A3A5C] border-[#1A3A5C]"
                    : "bg-white border-[1.5px] border-[#E8E2DA]"
                )}
              >
                {licenseNotReady && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="text-sm text-[#6B6B6B]">준비 중 — 가입 후 대시보드에서 제출</span>
            </label>
            {!licenseNotReady && (
              <>
                <div className="flex flex-wrap gap-6 mb-3">
                  {["제조업 등록필증", "책임판매업 등록필증"].map((type) => (
                    <label key={type} className="flex items-center gap-2.5 cursor-pointer">
                      <div
                        onClick={() => setCosmeticLicenseType(type)}
                        className={cn(
                          "w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-colors cursor-pointer",
                          cosmeticLicenseType === type ? "border-[#1A3A5C]" : "border-[#E8E2DA]"
                        )}
                      >
                        {cosmeticLicenseType === type && <div className="w-2.5 h-2.5 rounded-full bg-[#1A3A5C]" />}
                      </div>
                      <span className="text-sm text-[#0F0F0F]">{type}</span>
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2.5 border border-[#1A3A5C] text-[#1A3A5C] text-sm font-medium rounded-lg cursor-pointer hover:bg-[#1A3A5C]/5 transition-colors">
                    <Upload className="w-4 h-4" />
                    파일 선택
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => setCosmeticLicenseFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {cosmeticLicenseFile ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#0F0F0F] truncate max-w-[200px]">{cosmeticLicenseFile.name}</span>
                      <button type="button" onClick={() => setCosmeticLicenseFile(null)} className="text-[#6B6B6B] hover:text-red-500 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm text-[#6B6B6B]/60">파일을 선택해주세요</span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* FDA MoCRA 등록 */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
              FDA MoCRA 등록 <span className="text-xs text-[#6B6B6B] font-normal">(선택 — 등록 시 배지 부여)</span>
            </label>
            <div className="flex flex-wrap gap-6 mb-2">
              {["등록 완료", "진행 중", "미등록"].map((option) => (
                <label key={option} className="flex items-center gap-2.5 cursor-pointer">
                  <div
                    onClick={() => setFdaStatus(option)}
                    className={cn(
                      "w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-colors cursor-pointer",
                      fdaStatus === option ? "border-[#1A3A5C]" : "border-[#E8E2DA]"
                    )}
                  >
                    {fdaStatus === option && <div className="w-2.5 h-2.5 rounded-full bg-[#1A3A5C]" />}
                  </div>
                  <span className="text-sm text-[#0F0F0F]">{option}</span>
                </label>
              ))}
            </div>
            {fdaStatus === "등록 완료" && (
              <input
                type="text"
                value={fdaRegNumber}
                onChange={(e) => setFdaRegNumber(e.target.value)}
                placeholder="FDA Registration Number"
                className={cn(inputBaseClass, "mt-2")}
              />
            )}
          </div>

          {/* ISO 22716 인증 */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
              ISO 22716 인증 <span className="text-xs text-[#6B6B6B] font-normal">(선택 — 보유 시 배지 부여)</span>
            </label>
            <div className="flex flex-wrap gap-6 mb-2">
              {["보유", "미보유"].map((option) => (
                <label key={option} className="flex items-center gap-2.5 cursor-pointer">
                  <div
                    onClick={() => setIso22716(option)}
                    className={cn(
                      "w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-colors cursor-pointer",
                      iso22716 === option ? "border-[#1A3A5C]" : "border-[#E8E2DA]"
                    )}
                  >
                    {iso22716 === option && <div className="w-2.5 h-2.5 rounded-full bg-[#1A3A5C]" />}
                  </div>
                  <span className="text-sm text-[#0F0F0F]">{option}</span>
                </label>
              ))}
            </div>
            {iso22716 === "보유" && (
              <div className="flex items-center gap-3 mt-2">
                <label className="flex items-center gap-2 px-4 py-2.5 border border-[#E8E2DA] text-[#0F0F0F] text-sm font-medium rounded-lg cursor-pointer hover:border-[#1A3A5C]/40 transition-colors">
                  <Upload className="w-4 h-4" />
                  인증서 업로드
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setIso22716File(e.target.files?.[0] ?? null)} />
                </label>
                {iso22716File ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#0F0F0F] truncate max-w-[200px]">{iso22716File.name}</span>
                    <button type="button" onClick={() => setIso22716File(null)} className="text-[#6B6B6B] hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <span className="text-sm text-[#6B6B6B]/60">파일을 선택해주세요</span>
                )}
              </div>
            )}
          </div>

          {/* 비건 인증 */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
              비건 인증 <span className="text-xs text-[#6B6B6B] font-normal">(선택 — 보유 시 배지 부여)</span>
            </label>
            <div className="flex flex-wrap gap-6 mb-2">
              {["보유", "미보유"].map((option) => (
                <label key={option} className="flex items-center gap-2.5 cursor-pointer">
                  <div
                    onClick={() => setVeganCertified(option)}
                    className={cn(
                      "w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-colors cursor-pointer",
                      veganCertified === option ? "border-[#1A3A5C]" : "border-[#E8E2DA]"
                    )}
                  >
                    {veganCertified === option && <div className="w-2.5 h-2.5 rounded-full bg-[#1A3A5C]" />}
                  </div>
                  <span className="text-sm text-[#0F0F0F]">{option}</span>
                </label>
              ))}
            </div>
            {veganCertified === "보유" && (
              <div className="mt-2 space-y-2">
                <input type="text" value={veganCertOrg} onChange={(e) => setVeganCertOrg(e.target.value)} placeholder="인증기관명" className={inputBaseClass} />
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2.5 border border-[#E8E2DA] text-[#0F0F0F] text-sm font-medium rounded-lg cursor-pointer hover:border-[#1A3A5C]/40 transition-colors">
                    <Upload className="w-4 h-4" />
                    인증서 업로드
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setVeganCertFile(e.target.files?.[0] ?? null)} />
                  </label>
                  {veganCertFile ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#0F0F0F] truncate max-w-[200px]">{veganCertFile.name}</span>
                      <button type="button" onClick={() => setVeganCertFile(null)} className="text-[#6B6B6B] hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <span className="text-sm text-[#6B6B6B]/60">파일을 선택해주세요</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 크루얼티프리 인증 */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
              크루얼티프리 인증 <span className="text-xs text-[#6B6B6B] font-normal">(선택 — 보유 시 배지 부여)</span>
            </label>
            <div className="flex flex-wrap gap-6 mb-2">
              {["보유", "미보유"].map((option) => (
                <label key={option} className="flex items-center gap-2.5 cursor-pointer">
                  <div
                    onClick={() => setCrueltyFree(option)}
                    className={cn(
                      "w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-colors cursor-pointer",
                      crueltyFree === option ? "border-[#1A3A5C]" : "border-[#E8E2DA]"
                    )}
                  >
                    {crueltyFree === option && <div className="w-2.5 h-2.5 rounded-full bg-[#1A3A5C]" />}
                  </div>
                  <span className="text-sm text-[#0F0F0F]">{option}</span>
                </label>
              ))}
            </div>
            {crueltyFree === "보유" && (
              <div className="mt-2 space-y-2">
                <input type="text" value={crueltyFreeCertOrg} onChange={(e) => setCrueltyFreeCertOrg(e.target.value)} placeholder="인증기관명" className={inputBaseClass} />
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2.5 border border-[#E8E2DA] text-[#0F0F0F] text-sm font-medium rounded-lg cursor-pointer hover:border-[#1A3A5C]/40 transition-colors">
                    <Upload className="w-4 h-4" />
                    인증서 업로드
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setCrueltyFreeCertFile(e.target.files?.[0] ?? null)} />
                  </label>
                  {crueltyFreeCertFile ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#0F0F0F] truncate max-w-[200px]">{crueltyFreeCertFile.name}</span>
                      <button type="button" onClick={() => setCrueltyFreeCertFile(null)} className="text-[#6B6B6B] hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <span className="text-sm text-[#6B6B6B]/60">파일을 선택해주세요</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 수출 경험 */}
          <div className="mb-2">
            <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
              수출 경험 <span className="text-xs text-[#6B6B6B] font-normal">(선택)</span>
            </label>
            <div className="flex flex-wrap gap-6 mb-2">
              {["수출 경험 있음", "수출 준비 중"].map((option) => (
                <label key={option} className="flex items-center gap-2.5 cursor-pointer">
                  <div
                    onClick={() => setExportExperience(option)}
                    className={cn(
                      "w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-colors cursor-pointer",
                      exportExperience === option ? "border-[#1A3A5C]" : "border-[#E8E2DA]"
                    )}
                  >
                    {exportExperience === option && <div className="w-2.5 h-2.5 rounded-full bg-[#1A3A5C]" />}
                  </div>
                  <span className="text-sm text-[#0F0F0F]">{option}</span>
                </label>
              ))}
            </div>
            {exportExperience === "수출 경험 있음" && (
              <input
                type="text"
                value={exportCountries}
                onChange={(e) => setExportCountries(e.target.value)}
                placeholder="예: 미국, 일본, 싱가포르"
                className={cn(inputBaseClass, "mt-2")}
              />
            )}
          </div>
        </div>

        {/* Submit Error */}
        {submitError && (
          <div className="mb-4">
            <p className="text-[13px] text-red-500">{submitError}</p>
            {showLoginLink && (
              <Link href="/kbeauty/supplier/login" className="mt-1.5 inline-block text-sm font-medium text-[#1A3A5C] hover:underline">
                로그인하기 →
              </Link>
            )}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || (!cosmeticLicenseFile && !licenseNotReady)}
          className={cn(
            "w-full bg-[#1A3A5C] text-white font-semibold py-3.5 rounded-lg text-[15px] transition-colors inline-flex items-center justify-center gap-2",
            isSubmitting || (!cosmeticLicenseFile && !licenseNotReady) ? "opacity-60 cursor-not-allowed" : "hover:bg-[#153249]"
          )}
        >
          {isSubmitting ? "저장 중..." : "대시보드 시작하기"}
          {!isSubmitting && <span className="text-lg">&#8594;</span>}
        </button>
      </div>

      {/* Trust Note */}
      <p className="text-xs text-[#6B6B6B] text-center mt-4">
        인증된 사업자만 검증된 바이어 DB에 접근할 수 있습니다.
      </p>
    </div>
  )
}

// Footer Section
function FooterSection() {
  return (
    <footer className="bg-[#0F0F0F] py-12 px-6">
      <div className="max-w-[1280px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-1 mb-2">
              <span className="font-bold text-white">UnfoldK Beauty</span>
              <span className="text-[#C8A882]">&#9670;</span>
            </div>
            <p className="text-[13px] text-white/40">
              Your gateway to verified K-Beauty trade.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-sm text-white/60 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-sm text-white/60 hover:text-white transition-colors">
              Terms of Service
            </Link>
            <a href="mailto:contact@unfoldk.com" className="text-sm text-white/60 hover:text-white transition-colors">
              Contact
            </a>
          </div>
        </div>

        <div className="border-t border-white/10 my-6" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-xs text-white/30">
            &copy; 2026 UnfoldK Beauty by Unfold Lab.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-white/40 hover:text-white transition-colors">
              <Instagram className="w-5 h-5" />
              <span className="sr-only">Instagram</span>
            </a>
            <a href="#" className="text-white/40 hover:text-white transition-colors">
              <Linkedin className="w-5 h-5" />
              <span className="sr-only">LinkedIn</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

// Main Page Component
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
      style={{ background: "#1A3A5C" }}
      aria-label="Back to top"
    >
      <ChevronUp className="w-5 h-5 text-white" />
    </button>
  )
}

export default function SupplierRegistrationPage() {
  const [currentStep] = useState(1)

  return (
    <div className="min-h-screen bg-white font-sans">
      <BeautyNavbar />
      <main>
        <HeroHeader />
        <div className="px-6">
          <StepIndicator currentStep={currentStep} />
        </div>
        <SupplierForm />
      </main>
      <FooterSection />
      <ScrollTopButton />
    </div>
  )
}
