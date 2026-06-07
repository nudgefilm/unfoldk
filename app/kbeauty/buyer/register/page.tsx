"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Check, ChevronDown, ChevronUp, Instagram, Linkedin } from "lucide-react"
import { cn } from "@/lib/utils"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { BeautyNavbar } from "@/components/kbeauty/BeautyNavbar"

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
      <div className="max-w-[640px] mx-auto text-center">
        <h1 className="font-serif text-4xl md:text-[48px] text-[#0F0F0F] mb-4">
          Request Buyer Access
        </h1>
        <p className="text-base text-[#6B6B6B] leading-[1.7]">
          Fill in your business details.
          <br />
          Fill in your business details to get started.
        </p>
      </div>
    </section>
  )
}

// Form Component
function BuyerRegistrationForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [showLoginLink, setShowLoginLink] = useState(false)
  const [companyName, setCompanyName] = useState("")
  const [email, setEmail] = useState("")
  const [website, setWebsite] = useState("")
  const [country, setCountry] = useState("")
  const [state, setState] = useState("")
  const [einVat, setEinVat] = useState("")
  const [businessType, setBusinessType] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [importVolume, setImportVolume] = useState("")
  const [handlingKorean, setHandlingKorean] = useState("")
  const [linkedinUrl, setLinkedinUrl] = useState("")
  const [knownSuppliers, setKnownSuppliers] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

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

  const countries = [
    "United States",
    "Canada",
    "United Kingdom",
    "Germany",
    "France",
    "Australia",
    "Japan",
    "Singapore",
    "Other",
  ]

  const usStates = [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
    "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
    "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
    "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
    "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
    "New Hampshire", "New Jersey", "New Mexico", "New York",
    "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
    "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
    "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
    "West Virginia", "Wisconsin", "Wyoming",
  ]

  const businessTypes = [
    "Importer",
    "Distributor",
    "Wholesaler",
    "Retailer",
    "E-commerce",
    "Other",
  ]

  const categoryOptions = [
    "Skincare",
    "Makeup",
    "Haircare",
    "Suncare",
    "Derma/Functional",
  ]

  const volumeOptions = ["Under $50K", "$50K – $500K", "Over $500K"]

  const handleCategoryToggle = (category: string) => {
    setCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    )
  }

  const handleBusinessTypeToggle = (type: string) => {
    setBusinessType((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || password.length < 6) {
      setSubmitError("Password must be at least 6 characters.")
      return
    }
    if (password !== confirmPassword) {
      setSubmitError("Passwords do not match.")
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
          setSubmitError("This email is already registered. Please log in.")
          setShowLoginLink(true)
        } else if (msg.toLowerCase().includes("password") || msg.includes("6 characters")) {
          setSubmitError("Password must be at least 6 characters.")
        } else if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
          setSubmitError("Please check your network connection.")
        } else {
          setSubmitError("An error occurred. Please contact support.")
        }
        return
      }

      const supabase = createSupabaseBrowserClient()

      // 2. 계정 생성 직후 로그인으로 세션 확보 (미들웨어 통과)
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) {
        setSubmitError("Account created but login failed. Please log in from the login page.")
        setShowLoginLink(true)
        return
      }

      // 3. beauty_buyers 레코드 삽입
      const websiteUrl = website
        ? /^https?:\/\//i.test(website) ? website : `https://${website}`
        : null

      const { error } = await supabase.from("beauty_buyers").insert({
        user_id: signupData.userId,
        company_name: companyName,
        business_email: email,
        website: websiteUrl,
        country,
        state: state || null,
        ein_number: einVat || null,
        business_type: businessType.length > 0 ? businessType.join(",") : null,
        categories,
        annual_import_volume: importVolume || null,
        handling_korean_products: handlingKorean === "Yes" ? true : handlingKorean === "No" ? false : null,
        linkedin_url: linkedinUrl || null,
        known_suppliers: knownSuppliers || null,
        stage1_approved: true,
        status: "active",
        source: "direct_signup",
      })

      if (error) {
        if (error.code === "23505") {
          setSubmitError("This company is already registered. Please log in.")
          setShowLoginLink(true)
        } else {
          setSubmitError(`An error occurred. (Error code: ${error.code ?? "unknown"}) Please contact support.`)
        }
        return
      }

      router.push("/kbeauty/dashboard/buyer")
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
        setSubmitError("Please check your network connection.")
      } else {
        setSubmitError("A server error occurred. Please try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputBaseClass =
    "w-full px-4 py-3 border border-[#E8E2DA] rounded-lg text-sm text-[#0F0F0F] placeholder:text-[#6B6B6B]/50 hover:border-[#1A3A5C]/40 focus:border-[#1A3A5C] focus:outline-none transition-colors duration-200"

  const selectBaseClass =
    "w-full px-4 py-3 border border-[#E8E2DA] rounded-lg text-sm text-[#0F0F0F] hover:border-[#1A3A5C]/40 focus:border-[#1A3A5C] focus:outline-none transition-colors duration-200 appearance-none bg-white cursor-pointer"


  return (
    <div className="max-w-[600px] mx-auto px-6 mb-6">
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-[#E8E2DA] rounded-xl p-8 md:p-10 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
      >
        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading}
          className="w-full flex items-center justify-center gap-2.5 border border-[#E8E2DA] bg-white py-3.5 rounded-lg text-[15px] font-medium text-[#0F0F0F] hover:bg-[#F8F7F5] transition-colors disabled:opacity-60 mb-6"
        >
          {GOOGLE_SVG}
          {isGoogleLoading ? "Connecting..." : "Continue with Google"}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-[#E8E2DA]" />
          <span className="text-xs text-[#6B6B6B]">or</span>
          <div className="flex-1 h-px bg-[#E8E2DA]" />
        </div>

        {/* Company Name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
            Company Name <span className="text-[#1A3A5C]">*</span>
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Beauty Co."
            required
            className={inputBaseClass}
          />
        </div>

        {/* Business Email */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
            Business Email <span className="text-[#1A3A5C]">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@company.com"
            required
            className={inputBaseClass}
          />
          <p className="text-xs text-[#6B6B6B] mt-1.5">
            Personal emails (Gmail, Naver, etc.) are not accepted.
          </p>
        </div>

        {/* Website URL */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
            Website URL <span className="text-[#1A3A5C]">*</span>
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
              required
              className="flex-1 px-3 py-3 text-sm text-[#0F0F0F] placeholder:text-[#6B6B6B]/50 focus:outline-none bg-white"
            />
          </div>
          <p className="text-xs text-[#6B6B6B] mt-1.5">
            Must match your business email domain.
          </p>
        </div>

        {/* Location - 2 Column */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Country */}
          <div>
            <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
              Country <span className="text-[#1A3A5C]">*</span>
            </label>
            <div className="relative">
              <select
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value)
                  if (e.target.value !== "United States") {
                    setState("")
                  }
                }}
                required
                className={cn(selectBaseClass, !country && "text-[#6B6B6B]/50")}
              >
                <option value="" disabled>
                  Select country
                </option>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B] pointer-events-none" />
            </div>
          </div>

          {/* State / Region */}
          <div>
            <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
              State / Region
            </label>
            <div className="relative">
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                disabled={country !== "United States"}
                className={cn(
                  selectBaseClass,
                  !state && "text-[#6B6B6B]/50",
                  country !== "United States" && "bg-[#F8F7F5] cursor-not-allowed"
                )}
              >
                <option value="" disabled>
                  Select state
                </option>
                {usStates.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B] pointer-events-none" />
            </div>
          </div>
        </div>

        {/* EIN / VAT Number */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
            EIN / VAT Number <span className="text-[#1A3A5C]">*</span>
          </label>
          <input
            type="text"
            value={einVat}
            onChange={(e) => setEinVat(e.target.value)}
            placeholder="XX-XXXXXXX"
            required
            className={inputBaseClass}
          />
          <p className="text-xs text-[#6B6B6B] mt-1.5">
            US: EIN (XX-XXXXXXX) · EU: VAT Number · Others: Business Registration No.
          </p>
        </div>

        <div className="border-t border-[#E8E2DA] my-7" />

        {/* Business Type */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#0F0F0F] mb-1">
            Business Type <span className="text-[#1A3A5C]">*</span>
          </label>
          <span className="text-[13px] text-[#6B6B6B] block mb-3">Select all that apply</span>
          <div className="grid grid-cols-2 gap-3">
            {businessTypes.map((type) => (
              <label key={type} className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => handleBusinessTypeToggle(type)}
                  className={cn(
                    "w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer",
                    businessType.includes(type)
                      ? "bg-[#1A3A5C] border-[#1A3A5C]"
                      : "bg-white border-[1.5px] border-[#E8E2DA]"
                  )}
                >
                  {businessType.includes(type) && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </div>
                <span className="text-sm text-[#0F0F0F]">{type}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Product Categories */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#0F0F0F] mb-1">
            Product Categories <span className="text-[#1A3A5C]">*</span>
          </label>
          <span className="text-[13px] text-[#6B6B6B] block mb-3">
            Select all that apply
          </span>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {categoryOptions.map((category) => (
              <label key={category} className="flex items-center gap-3 cursor-pointer">
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

        {/* Annual Import Volume */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#0F0F0F] mb-3">
            Annual Import Volume <span className="text-[#1A3A5C]">*</span>
          </label>
          <div className="flex flex-wrap gap-6">
            {volumeOptions.map((option) => (
              <label key={option} className="flex items-center gap-2.5 cursor-pointer">
                <div
                  onClick={() => setImportVolume(option)}
                  className={cn(
                    "w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-colors cursor-pointer",
                    importVolume === option ? "border-[#1A3A5C]" : "border-[#E8E2DA]"
                  )}
                >
                  {importVolume === option && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#1A3A5C]" />
                  )}
                </div>
                <span className="text-sm text-[#0F0F0F]">{option}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Currently handling Korean products */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#0F0F0F] mb-3">
            Currently handling Korean products?
          </label>
          <div className="flex gap-8">
            {["Yes", "No"].map((option) => (
              <label key={option} className="flex items-center gap-2.5 cursor-pointer">
                <div
                  onClick={() => setHandlingKorean(option)}
                  className={cn(
                    "w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-colors cursor-pointer",
                    handlingKorean === option ? "border-[#1A3A5C]" : "border-[#E8E2DA]"
                  )}
                >
                  {handlingKorean === option && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#1A3A5C]" />
                  )}
                </div>
                <span className="text-sm text-[#0F0F0F]">{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="border-t border-[#E8E2DA] my-7" />

        {/* LinkedIn Company URL */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
            LinkedIn Company URL{" "}
            <span className="text-xs text-[#C8A882] font-normal">(Recommended)</span>
          </label>
          <input
            type="url"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://linkedin.com/company/..."
            className={inputBaseClass}
          />
        </div>

        {/* Known Korean Suppliers */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
            Known Korean Suppliers{" "}
            <span className="text-xs text-[#6B6B6B] font-normal">(Optional)</span>
          </label>
          <input
            type="text"
            value={knownSuppliers}
            onChange={(e) => setKnownSuppliers(e.target.value)}
            placeholder="List any Korean suppliers you've worked with"
            className={inputBaseClass}
          />
        </div>

        <div className="border-t border-[#E8E2DA] my-7" />

        {/* Password */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
            Password <span className="text-[#1A3A5C]">*</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className={inputBaseClass}
          />
        </div>

        {/* Confirm Password */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
            Confirm Password <span className="text-[#1A3A5C]">*</span>
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
            className={inputBaseClass}
          />
        </div>

        {/* Submit Error */}
        {submitError && (
          <div className="mb-4">
            <p className="text-[13px] text-red-500">{submitError}</p>
            {showLoginLink && (
              <Link href="/kbeauty/login" className="mt-1.5 inline-block text-sm font-medium text-[#1A3A5C] hover:underline">
                Log in →
              </Link>
            )}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "w-full bg-[#1A3A5C] text-white font-semibold py-3.5 rounded-lg text-[15px] transition-colors inline-flex items-center justify-center gap-2",
            isSubmitting ? "opacity-60 cursor-not-allowed" : "hover:bg-[#153249]"
          )}
        >
          {isSubmitting ? "Submitting..." : "Request Buyer Access"}
          {!isSubmitting && <span className="text-lg">&#8594;</span>}
        </button>
      </form>
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

// Main Page Component
export default function BuyerRegisterPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <BeautyNavbar />
      <main>
        <HeroHeader />
        <BuyerRegistrationForm />
      </main>
      <FooterSection />
      <ScrollTopButton />
    </div>
  )
}
