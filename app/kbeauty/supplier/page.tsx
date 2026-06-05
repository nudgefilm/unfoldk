"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Menu, Check, Shield, Instagram, Linkedin } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

// Navbar Component
function BeautyNavbar() {
  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-[#E8E2DA] h-16">
      <div className="max-w-[1280px] mx-auto h-full px-6 flex items-center justify-between">
        <Link href="/kbeauty" className="flex items-center gap-1">
          <span className="font-bold text-[#0F0F0F]">UnfoldK Beauty</span>
          <span className="text-[#C8A882]">&#9670;</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <a href="/kbeauty#suppliers" className="text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors">
            For Suppliers
          </a>
          <a href="/kbeauty#buyers" className="text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors">
            For Buyers
          </a>
          <a href="/kbeauty#how-it-works" className="text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors">
            How It Works
          </a>
          <a href="/kbeauty#data-sources" className="text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors">
            Data Sources
          </a>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button className="text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors px-4 py-2">
            Log in
          </button>
          <button className="bg-[#1A3A5C] text-white text-sm font-medium px-5 py-2.5 rounded-md hover:bg-[#153249] transition-colors">
            Get Started
          </button>
        </div>

        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <button className="p-2 text-[#0F0F0F]">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="bg-white border-t border-[#E8E2DA]">
            <nav className="flex flex-col gap-4 mt-6">
              <a href="/kbeauty#suppliers" className="text-[#6B6B6B] hover:text-[#0F0F0F] py-2">
                For Suppliers
              </a>
              <a href="/kbeauty#buyers" className="text-[#6B6B6B] hover:text-[#0F0F0F] py-2">
                For Buyers
              </a>
              <a href="/kbeauty#how-it-works" className="text-[#6B6B6B] hover:text-[#0F0F0F] py-2">
                How It Works
              </a>
              <a href="/kbeauty#data-sources" className="text-[#6B6B6B] hover:text-[#0F0F0F] py-2">
                Data Sources
              </a>
              <div className="border-t border-[#E8E2DA] my-2" />
              <button className="text-[#6B6B6B] hover:text-[#0F0F0F] py-2 text-left">
                Log in
              </button>
              <button className="bg-[#1A3A5C] text-white font-medium px-5 py-3 rounded-md w-full mt-2">
                Get Started
              </button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}

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
  const [categories, setCategories] = useState<string[]>([])
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const categoryOptions = [
    "스킨케어",
    "메이크업",
    "헤어·바디",
    "선케어",
    "더마·기능성",
  ]

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

    setIsSubmitting(true)
    setSubmitError("")
    setShowLoginLink(false)

    try {
      const supabase = createSupabaseBrowserClient()

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { email_confirm: false } },
      })
      if (authError) {
        const msg = authError.message || ""
        if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already exists")) {
          setSubmitError("이미 가입된 이메일입니다. 로그인해주세요.")
          setShowLoginLink(true)
        } else if (msg.toLowerCase().includes("password") || msg.includes("6 characters")) {
          setSubmitError("비밀번호는 6자리 이상이어야 합니다.")
        } else if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
          setSubmitError("네트워크 연결을 확인해주세요.")
        } else {
          setSubmitError(`오류가 발생했습니다. (오류코드: ${(authError as { status?: number }).status ?? msg}) 고객센터에 문의해주세요.`)
        }
        return
      }

      // signUp 직후 세션이 없는 경우(이메일 확인 대기) 강제 로그인으로 세션 확보
      // 미들웨어가 beauty_suppliers 레코드 조회 전에 user=null로 보고 /kbeauty로 튕기는 것을 방지
      if (!authData.session) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signInErr) {
          setSubmitError("계정 생성 후 로그인에 실패했습니다. 로그인 페이지에서 다시 시도해주세요.")
          setShowLoginLink(true)
          return
        }
      }

      const { error } = await supabase.from("beauty_suppliers").insert({
        user_id: authData.user?.id ?? null,
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

        {/* FDA Status */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-[#0F0F0F] mb-3">
            FDA 등록 여부
          </label>
          <div className="flex flex-wrap gap-6">
            {["등록 완료", "진행 중", "미등록"].map((option) => (
              <label
                key={option}
                className="flex items-center gap-2.5 cursor-pointer"
              >
                <div
                  onClick={() => setFdaStatus(option)}
                  className={cn(
                    "w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-colors cursor-pointer",
                    fdaStatus === option
                      ? "border-[#1A3A5C]"
                      : "border-[#E8E2DA]"
                  )}
                >
                  {fdaStatus === option && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#1A3A5C]" />
                  )}
                </div>
                <span className="text-sm text-[#0F0F0F]">{option}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Submit Error */}
        {submitError && (
          <div className="mb-4">
            <p className="text-[13px] text-red-500">{submitError}</p>
            {showLoginLink && (
              <Link href="/kbeauty/login" className="mt-1.5 inline-block text-sm font-medium text-[#1A3A5C] hover:underline">
                로그인하기 →
              </Link>
            )}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={cn(
            "w-full bg-[#1A3A5C] text-white font-semibold py-3.5 rounded-lg text-[15px] transition-colors inline-flex items-center justify-center gap-2",
            isSubmitting ? "opacity-60 cursor-not-allowed" : "hover:bg-[#153249]"
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
    </div>
  )
}
