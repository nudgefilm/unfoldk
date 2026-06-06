"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Search,
  Handshake,
  Settings,
  CheckCircle2,
  Clock,
  Loader2,
  ChevronLeft,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

// ─── 상수 ──────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/kbeauty/dashboard/buyer" },
  { label: "Discover", icon: Search, href: "/kbeauty/dashboard/buyer#discover" },
  { label: "My Matches", icon: Handshake, href: "/kbeauty/dashboard/buyer#matches" },
  { label: "Settings", icon: Settings, href: "/kbeauty/dashboard/buyer/settings" },
]

const CATEGORY_OPTIONS = [
  "skincare", "cleansing", "suncare", "makeup", "haircare", "body", "derma",
]

const VOLUME_OPTIONS = [
  { label: "Under $50K / year", value: "under_50k" },
  { label: "$50K – $500K / year", value: "50k_500k" },
  { label: "Over $500K / year", value: "over_500k" },
]

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

export default function BuyerProfilePage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [buyerId, setBuyerId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState("")
  const [approved, setApproved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 폼 상태
  const [categories, setCategories] = useState<string[]>([])
  const [annualImportVolume, setAnnualImportVolume] = useState("")
  const [handlingKoreanProducts, setHandlingKoreanProducts] = useState<boolean | null>(null)
  const [knownSuppliers, setKnownSuppliers] = useState("")
  const [state, setState] = useState("")

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/kbeauty/buyer/login"); return }

      const { data } = await supabase
        .from("beauty_buyers")
        .select("id, company_name, stage1_approved, categories, annual_import_volume, handling_korean_products, known_suppliers, state")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!data) { router.push("/kbeauty/buyer/register"); return }

      setBuyerId(data.id)
      setCompanyName(data.company_name)
      setApproved(data.stage1_approved ?? false)
      setCategories((data.categories as string[] | null) ?? [])
      setAnnualImportVolume(data.annual_import_volume ?? "")
      setHandlingKoreanProducts(data.handling_korean_products ?? null)
      setKnownSuppliers(data.known_suppliers ?? "")
      setState(data.state ?? "")
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

  async function handleSave() {
    if (!buyerId) return
    setSaving(true)

    const { error } = await supabase
      .from("beauty_buyers")
      .update({
        categories: categories.length > 0 ? categories : null,
        annual_import_volume: annualImportVolume || null,
        handling_korean_products: handlingKoreanProducts,
        known_suppliers: knownSuppliers || null,
        state: state || null,
      })
      .eq("id", buyerId)

    if (error) {
      toast.error("Something went wrong. Please try again.")
      setSaving(false)
      return
    }

    toast.success("Profile updated successfully")
    setTimeout(() => router.push("/kbeauty/dashboard/buyer"), 800)
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F7F5] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#1A3A5C]" />
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
      <Sidebar companyName={companyName} approved={approved} />

      <main className="min-h-screen" style={{ marginLeft: 240 }}>
        <div className="max-w-2xl mx-auto px-8 py-10">

          {/* 헤더 */}
          <div className="mb-8">
            <button
              onClick={() => router.push("/kbeauty/dashboard/buyer")}
              className="flex items-center gap-1 text-xs text-[#6B6B6B] hover:text-[#0F0F0F] mb-4 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back to Dashboard
            </button>
            <h1
              className="text-[#0F0F0F]"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: 28, fontWeight: 600, lineHeight: 1.2 }}
            >
              Complete Your Profile
            </h1>
            <p className="text-sm text-[#6B6B6B] mt-1">
              Help us match you with the right K-beauty suppliers.
            </p>
          </div>

          <div className="bg-white border border-[#E8E2DA] rounded-xl p-6 space-y-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">

            {/* Product Categories */}
            <div>
              <label className="block text-sm font-semibold text-[#0F0F0F] mb-1">
                Product Categories
                <span className="text-[#6B6B6B] font-normal ml-1">(select all that apply)</span>
              </label>
              <div className="flex flex-wrap gap-2 mt-2">
                {CATEGORY_OPTIONS.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize"
                    style={
                      categories.includes(cat)
                        ? { background: "#1A3A5C", borderColor: "#1A3A5C", color: "white" }
                        : { background: "white", borderColor: "#E8E2DA", color: "#6B6B6B" }
                    }
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-[#E8E2DA]" />

            {/* Annual Import Volume */}
            <div>
              <label className="block text-sm font-semibold text-[#0F0F0F] mb-3">
                Annual Import Volume
              </label>
              <div className="flex flex-col gap-2.5">
                {VOLUME_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="radio"
                      name="annual_import_volume"
                      value={opt.value}
                      checked={annualImportVolume === opt.value}
                      onChange={() => setAnnualImportVolume(opt.value)}
                      className="w-4 h-4 accent-[#1A3A5C]"
                    />
                    <span className="text-sm text-[#0F0F0F] group-hover:text-[#1A3A5C] transition-colors">
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-[#E8E2DA]" />

            {/* Handling Korean Products */}
            <div>
              <label className="block text-sm font-semibold text-[#0F0F0F] mb-3">
                Currently handling Korean products?
              </label>
              <div className="flex gap-6">
                {([true, false] as const).map((val) => (
                  <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="handling_korean"
                      checked={handlingKoreanProducts === val}
                      onChange={() => setHandlingKoreanProducts(val)}
                      className="w-4 h-4 accent-[#1A3A5C]"
                    />
                    <span className="text-sm text-[#0F0F0F]">{val ? "Yes" : "No"}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-[#E8E2DA]" />

            {/* Known Suppliers */}
            <div>
              <label className="block text-sm font-semibold text-[#0F0F0F] mb-1">
                Korean brands or suppliers you know
                <span className="text-[#6B6B6B] font-normal ml-1">(optional)</span>
              </label>
              <p className="text-xs text-[#6B6B6B] mb-2">
                List brands or suppliers you&apos;ve worked with or are aware of.
              </p>
              <textarea
                value={knownSuppliers}
                onChange={(e) => setKnownSuppliers(e.target.value)}
                placeholder="e.g. Cosrx, Innisfree, Amorepacific..."
                rows={3}
                className={inputBase + " resize-none"}
              />
            </div>

            <div className="border-t border-[#E8E2DA]" />

            {/* State / Region */}
            <div>
              <label className="block text-sm font-semibold text-[#0F0F0F] mb-1">
                State / Region
              </label>
              <p className="text-xs text-[#6B6B6B] mb-2">
                Your business location helps us suggest local distribution options.
              </p>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. California, New York, Texas..."
                className={inputBase}
              />
            </div>

          </div>

          {/* 저장 버튼 */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => router.push("/kbeauty/dashboard/buyer")}
              className="text-sm font-medium px-5 py-2.5 rounded-lg border border-[#E8E2DA] text-[#6B6B6B] hover:bg-[#F8F7F5] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm font-semibold px-6 py-2.5 rounded-lg text-white transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: "#1A3A5C" }}
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>

        </div>
      </main>
    </div>
  )
}
