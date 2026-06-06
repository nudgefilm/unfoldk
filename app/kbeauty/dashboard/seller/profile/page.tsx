"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Search,
  Calculator,
  Settings,
  CheckCircle2,
  Clock,
  Loader2,
  ChevronLeft,
  Plus,
  X,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

// ─── 상수 ──────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/kbeauty/dashboard/seller" },
  { label: "Discover", icon: Search, href: "/kbeauty/dashboard/seller#discover" },
  { label: "Calculator", icon: Calculator, href: "/kbeauty/dashboard/seller#calculator" },
  { label: "Settings", icon: Settings, href: "/kbeauty/dashboard/seller/settings" },
]

const CATEGORY_OPTIONS = [
  "skincare", "cleansing", "suncare", "makeup", "haircare", "body", "derma",
]

const VOLUME_OPTIONS = [
  { label: "Under $100K / year", value: "under_100k" },
  { label: "$100K – $500K / year", value: "100k_500k" },
  { label: "$500K – $1M / year", value: "500k_1m" },
  { label: "Over $1M / year", value: "over_1m" },
]

const GOLD = "#8B6F47"
const GOLD_LIGHT = "#C8A882"

// ─── 사이드바 ──────────────────────────────────────────────────────────────

function Sidebar({ companyName, verified }: { companyName: string; verified: boolean }) {
  return (
    <aside
      className="fixed top-0 left-0 h-screen bg-white border-r border-[#E8E2DA] flex flex-col"
      style={{ width: 240 }}
    >
      <div className="px-6 py-5 border-b border-[#E8E2DA]">
        <Link href="/kbeauty" className="flex items-center gap-1">
          <span className="font-bold text-[#0F0F0F] text-sm">UnfoldK Beauty</span>
          <span style={{ color: GOLD_LIGHT }} className="text-xs">&#9670;</span>
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
          {verified ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-[#6B6B6B] bg-[#F8F7F5] px-2 py-0.5 rounded-full border border-[#E8E2DA]">
              <Clock className="w-3 h-3" />
              Pending
            </span>
          )}
        </div>
      </div>
    </aside>
  )
}

// ─── 메인 페이지 ───────────────────────────────────────────────────────────

export default function SellerProfilePage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [sellerId, setSellerId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState("")
  const [verified, setVerified] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 플랫폼 URL
  const [amazonUrl, setAmazonUrl] = useState("")
  const [shopifyUrl, setShopifyUrl] = useState("")
  const [tiktokUrl, setTiktokUrl] = useState("")
  const [otherName, setOtherName] = useState("")
  const [otherUrl, setOtherUrl] = useState("")

  // 연간 판매 규모
  const [annualSalesVolume, setAnnualSalesVolume] = useState("")

  // 취급 카테고리
  const [categories, setCategories] = useState<string[]>([])

  // 판매 타겟 국가 (태그 입력)
  const [targetCountries, setTargetCountries] = useState<string[]>([])
  const [countryInput, setCountryInput] = useState("")

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/kbeauty/seller/login"); return }

      const { data } = await supabase
        .from("beauty_sellers")
        .select("id, company_name, contact_verified, platform_urls, annual_sales_volume, categories, target_countries")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!data) { router.push("/kbeauty/seller/register"); return }

      setSellerId(data.id)
      setCompanyName(data.company_name)
      setVerified(data.contact_verified ?? false)

      const urls = (data.platform_urls as {
        amazon?: string; shopify?: string; tiktok?: string;
        other_name?: string; other_url?: string
      } | null) ?? {}
      setAmazonUrl(urls.amazon ?? "")
      setShopifyUrl(urls.shopify ?? "")
      setTiktokUrl(urls.tiktok ?? "")
      setOtherName(urls.other_name ?? "")
      setOtherUrl(urls.other_url ?? "")

      setAnnualSalesVolume(data.annual_sales_volume ?? "")
      setCategories((data.categories as string[] | null) ?? [])
      setTargetCountries((data.target_countries as string[] | null) ?? [])
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  function addCountry() {
    const trimmed = countryInput.trim()
    if (!trimmed || targetCountries.includes(trimmed)) return
    setTargetCountries((prev) => [...prev, trimmed])
    setCountryInput("")
  }

  function removeCountry(c: string) {
    setTargetCountries((prev) => prev.filter((x) => x !== c))
  }

  async function handleSave() {
    if (!sellerId) return
    setSaving(true)

    const platform_urls: Record<string, string> = {}
    if (amazonUrl.trim()) platform_urls.amazon = amazonUrl.trim()
    if (shopifyUrl.trim()) platform_urls.shopify = shopifyUrl.trim()
    if (tiktokUrl.trim()) platform_urls.tiktok = tiktokUrl.trim()
    if (otherName.trim()) platform_urls.other_name = otherName.trim()
    if (otherUrl.trim()) platform_urls.other_url = otherUrl.trim()

    const { error } = await supabase
      .from("beauty_sellers")
      .update({
        platform_urls: Object.keys(platform_urls).length > 0 ? platform_urls : null,
        annual_sales_volume: annualSalesVolume || null,
        categories: categories.length > 0 ? categories : null,
        target_countries: targetCountries.length > 0 ? targetCountries : null,
      })
      .eq("id", sellerId)

    if (error) {
      toast.error("Something went wrong. Please try again.")
      setSaving(false)
      return
    }

    toast.success("Profile updated successfully")
    setTimeout(() => router.push("/kbeauty/dashboard/seller"), 800)
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F7F5] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: GOLD }} />
      </div>
    )
  }

  const inputBase =
    "w-full text-sm border border-[#E8E2DA] rounded-lg px-4 py-2.5 bg-white focus:outline-none focus:border-[#C8A882] transition-colors"

  return (
    <div
      className="min-h-screen bg-[#F8F7F5]"
      style={{ fontFamily: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
    >
      <Toaster position="top-right" richColors />
      <Sidebar companyName={companyName} verified={verified} />

      <main className="min-h-screen" style={{ marginLeft: 240 }}>
        <div className="max-w-2xl mx-auto px-8 py-10">

          {/* 헤더 */}
          <div className="mb-8">
            <button
              onClick={() => router.push("/kbeauty/dashboard/seller")}
              className="flex items-center gap-1 text-xs text-[#6B6B6B] hover:text-[#0F0F0F] mb-4 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back to Dashboard
            </button>
            <h1
              className="text-[#0F0F0F]"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: 28, fontWeight: 600, lineHeight: 1.2 }}
            >
              Seller Profile
            </h1>
            <p className="text-sm text-[#6B6B6B] mt-1">
              Complete your profile to connect with the right K-beauty suppliers.
            </p>
          </div>

          <div className="bg-white border border-[#E8E2DA] rounded-xl p-6 space-y-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">

            {/* Store Links */}
            <div>
              <p className="text-sm font-semibold text-[#0F0F0F] mb-3">Store Links</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#6B6B6B] mb-1.5">Amazon Store URL</label>
                  <input type="url" value={amazonUrl} onChange={(e) => setAmazonUrl(e.target.value)} placeholder="https://www.amazon.com/..." className={inputBase} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6B6B6B] mb-1.5">Shopify Store URL</label>
                  <input type="url" value={shopifyUrl} onChange={(e) => setShopifyUrl(e.target.value)} placeholder="https://yourstore.myshopify.com" className={inputBase} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6B6B6B] mb-1.5">TikTok Shop URL</label>
                  <input type="url" value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} placeholder="https://www.tiktok.com/..." className={inputBase} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#6B6B6B] mb-1.5">Other Platform Name</label>
                    <input type="text" value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="e.g. Etsy, eBay..." className={inputBase} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#6B6B6B] mb-1.5">Other Store URL</label>
                    <input type="url" value={otherUrl} onChange={(e) => setOtherUrl(e.target.value)} placeholder="https://..." className={inputBase} />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-[#E8E2DA]" />

            {/* Annual Sales Volume */}
            <div>
              <p className="text-sm font-semibold text-[#0F0F0F] mb-3">Annual Sales Volume</p>
              <div className="flex flex-col gap-2.5">
                {VOLUME_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="radio"
                      name="annual_sales_volume"
                      value={opt.value}
                      checked={annualSalesVolume === opt.value}
                      onChange={() => setAnnualSalesVolume(opt.value)}
                      className="w-4 h-4"
                      style={{ accentColor: GOLD }}
                    />
                    <span className="text-sm text-[#0F0F0F] group-hover:text-[#8B6F47] transition-colors">
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-[#E8E2DA]" />

            {/* Product Categories */}
            <div>
              <p className="text-sm font-semibold text-[#0F0F0F] mb-1">Product Categories</p>
              <p className="text-xs text-[#6B6B6B] mb-3">Categories you sell or plan to source.</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize"
                    style={
                      categories.includes(cat)
                        ? { background: GOLD, borderColor: GOLD, color: "white" }
                        : { background: "white", borderColor: "#E8E2DA", color: "#6B6B6B" }
                    }
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-[#E8E2DA]" />

            {/* Target Countries */}
            <div>
              <p className="text-sm font-semibold text-[#0F0F0F] mb-1">Target Sales Countries</p>
              <p className="text-xs text-[#6B6B6B] mb-3">Countries where you sell or plan to sell.</p>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={countryInput}
                  onChange={(e) => setCountryInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCountry() } }}
                  placeholder="e.g. United States, Canada..."
                  className={inputBase.replace("w-full ", "") + " flex-1"}
                />
                <button
                  type="button"
                  onClick={addCountry}
                  className="px-3 py-2 rounded-lg text-white text-sm transition-opacity hover:opacity-80"
                  style={{ background: GOLD }}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {targetCountries.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {targetCountries.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                      style={{ background: `${GOLD}18`, color: GOLD }}
                    >
                      {c}
                      <button onClick={() => removeCountry(c)} className="hover:opacity-70 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* 저장 버튼 */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => router.push("/kbeauty/dashboard/seller")}
              className="text-sm font-medium px-5 py-2.5 rounded-lg border border-[#E8E2DA] text-[#6B6B6B] hover:bg-[#F8F7F5] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm font-semibold px-6 py-2.5 rounded-lg text-white transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: GOLD }}
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>

        </div>
      </main>
    </div>
  )
}
