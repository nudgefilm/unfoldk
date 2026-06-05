"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Menu, Check, ChevronDown, Instagram, Linkedin } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

// Navbar Component (Light variant - same as main landing)
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
      const supabase = createSupabaseBrowserClient()

      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
      if (authError) {
        const msg = authError.message || ""
        if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already exists")) {
          setSubmitError("This email is already registered. Please log in.")
          setShowLoginLink(true)
        } else if (msg.toLowerCase().includes("password") || msg.includes("6 characters")) {
          setSubmitError("Password must be at least 6 characters.")
        } else if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
          setSubmitError("Please check your network connection.")
        } else {
          setSubmitError(`An error occurred. (Error code: ${(authError as { status?: number }).status ?? msg}) Please contact support.`)
        }
        setIsSubmitting(false)
        return
      }

      // signUp 직후 세션이 없는 경우(이메일 확인 대기) 강제 로그인으로 세션 확보
      // 미들웨어가 beauty_buyers 레코드 조회 전에 user=null로 보고 /kbeauty로 튕기는 것을 방지
      if (!authData.session) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signInErr) {
          setSubmitError("Account created but login failed. Please log in from the login page.")
          setShowLoginLink(true)
          return
        }
      }

      const websiteUrl = website
        ? /^https?:\/\//i.test(website) ? website : `https://${website}`
        : null

      const { error } = await supabase.from("beauty_buyers").insert({
        user_id: authData.user?.id ?? null,
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
    </div>
  )
}
