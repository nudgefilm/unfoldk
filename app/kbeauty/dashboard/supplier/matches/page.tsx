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
  CheckCircle2,
  Clock,
  XCircle,
  ChevronLeft,
  Lock,
  Search,
  Megaphone,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { NotificationBell } from "@/components/kbeauty/NotificationBell"
import { AdRequestForm } from "@/components/kbeauty/AdRequestForm"
import { usePaddle } from "@/components/PaddleProvider"
import { PADDLE_PRICE_IDS } from "@/lib/paddle/constants"

// ─── 타입 ──────────────────────────────────────────────────────────────────

interface Match {
  id: string
  buyer_id: string
  status: string
  requested_at: string
  initiated_by: string | null
  beauty_buyers?: { company_name: string; user_id: string | null; country: string | null; categories: string[] | null } | null
}

type FilterTab = "전체" | "대기중" | "승인" | "거절"

// ─── 상수 ──────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "대시보드", icon: LayoutDashboard, href: "/kbeauty/dashboard/supplier" },
  { label: "제품 관리", icon: Package, href: "/kbeauty/dashboard/supplier/products/new" },
  { label: "매칭 관리", icon: Handshake, href: "/kbeauty/dashboard/supplier/matches" },
  { label: "프로필 관리", icon: UserCircle, href: "/kbeauty/dashboard/supplier/profile" },
  { label: "계정 설정", icon: Settings, href: "/kbeauty/dashboard/supplier/settings" },
]

const FILTER_TABS: FilterTab[] = ["전체", "대기중", "승인", "거절"]
const STATUS_MAP: Record<FilterTab, string | null> = {
  전체: null,
  대기중: "requested",
  승인: "approved",
  거절: "rejected",
}

// ─── 사이드바 ──────────────────────────────────────────────────────────────

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
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/kbeauty/dashboard/supplier/matches"
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
              <CheckCircle2 className="w-3 h-3" />인증 완료
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-[#6B6B6B] bg-[#F8F7F5] px-2 py-0.5 rounded-full border border-[#E8E2DA]">
              <Clock className="w-3 h-3" />인증 대기
            </span>
          )}
        </div>
      </div>
    </aside>
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
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-[#0F0F0F]">Pro 플랜 업그레이드</h2>
          <button onClick={onClose} className="text-[#6B6B6B] hover:text-[#0F0F0F] text-xl leading-none">&times;</button>
        </div>
        <ul className="text-sm text-[#6B6B6B] space-y-2.5 mb-6">
          {["매칭 요청 승인 · 거절", "샘플 요청 승인 · 거절", "추천 바이어 · 셀러 전체 열람", "컨택 정보 공개 및 요청"].map((f) => (
            <li key={f} className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#1A3A5C] shrink-0" />{f}
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

export default function SupplierMatchesPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState("")
  const [licenseVerified, setLicenseVerified] = useState(false)
  const [proActive, setProActive] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<FilterTab>("전체")
  const [search, setSearch] = useState("")
  const [showProModal, setShowProModal] = useState(false)
  const [showAdForm, setShowAdForm] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/kbeauty"); return }

      setUserId(user.id)
      setUserEmail(user.email ?? null)

      const { data: supplier } = await supabase
        .from("beauty_suppliers")
        .select("id, company_name_ko, cosmetic_license_verified, pro_active")
        .eq("user_id", user.id)
        .single()

      if (!supplier) { router.push("/kbeauty/supplier"); return }

      setSupplierId(supplier.id)
      setCompanyName(supplier.company_name_ko ?? "")
      setLicenseVerified(supplier.cosmetic_license_verified ?? false)
      setProActive(supplier.pro_active ?? false)

      const { data: matchData } = await supabase
        .from("beauty_matches")
        .select("id, buyer_id, status, requested_at, initiated_by, beauty_buyers(company_name, user_id, country, categories)")
        .eq("supplier_id", supplier.id)
        .order("requested_at", { ascending: false })

      setMatches((matchData as unknown as Match[]) ?? [])
      setLoading(false)
    }
    load()
  }, [router, supabase])

  async function handleStatus(id: string, newStatus: "approved" | "rejected", buyerUserId: string | null) {
    setUpdatingId(id)
    const { error } = await supabase.from("beauty_matches").update({ status: newStatus }).eq("id", id)
    if (error) {
      toast.error("오류가 발생했습니다.")
    } else {
      setMatches((prev) => prev.map((m) => (m.id === id ? { ...m, status: newStatus } : m)))
      toast.success(newStatus === "approved" ? "매칭을 승인했습니다." : "매칭을 거절했습니다.")

      if (buyerUserId) {
        const match = matches.find((m) => m.id === id)
        await supabase.from("beauty_notifications").insert({
          user_id: buyerUserId,
          type: newStatus === "approved" ? "match_approved" : "match_rejected",
          title: newStatus === "approved" ? "Match Request Approved" : "Match Request Rejected",
          message: newStatus === "approved"
            ? `${companyName} has approved your matching request.`
            : `${companyName} has declined your matching request.`,
          link: "/kbeauty/dashboard/buyer",
        })
        if (newStatus === "approved" && match) {
          await supabase.from("beauty_notifications").insert({
            user_id: buyerUserId,
            type: "match_approved",
            title: "Rate your experience",
            message: `How was your collaboration with ${companyName}? Share your feedback.`,
            link: "/kbeauty/dashboard/buyer",
          })
        }
      }
    }
    setUpdatingId(null)
  }

  // 필터 적용
  const filtered = matches.filter((m) => {
    const statusFilter = STATUS_MAP[activeTab]
    if (statusFilter && m.status !== statusFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return m.beauty_buyers?.company_name?.toLowerCase().includes(q) ?? false
    }
    return true
  })

  const counts: Record<FilterTab, number> = {
    전체: matches.length,
    대기중: matches.filter((m) => m.status === "requested").length,
    승인: matches.filter((m) => m.status === "approved").length,
    거절: matches.filter((m) => m.status === "rejected").length,
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

      {showAdForm && <AdRequestForm userType="supplier" onClose={() => setShowAdForm(false)} />}
      {showProModal && (
        <ProUpgradeModal onClose={() => setShowProModal(false)} userId={userId} userEmail={userEmail} />
      )}

      <Sidebar companyName={companyName} licenseVerified={licenseVerified} onAdvertiseClick={() => setShowAdForm(true)} />

      <main className="min-h-screen" style={{ marginLeft: 240 }}>
        <div className="max-w-4xl mx-auto px-8 py-10">

          {/* 헤더 */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href="/kbeauty/dashboard/supplier"
                  className="inline-flex items-center gap-1 text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />대시보드
                </Link>
                <span className="text-[#E8E2DA] text-sm">/</span>
                <span className="text-sm font-medium text-[#0F0F0F]">매칭 관리</span>
              </div>
              <h1
                className="text-[#0F0F0F]"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: 28, fontWeight: 600 }}
              >
                매칭 관리
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {userId && <NotificationBell userId={userId} theme="navy" />}
            </div>
          </div>

          {/* Pro 배너 */}
          {!proActive && (
            <div
              className="flex items-center justify-between px-6 py-4 mb-6"
              style={{ background: "#1A3A5C", borderRadius: 12 }}
            >
              <p className="text-white text-sm font-medium">매칭을 승인하려면 Pro 플랜이 필요합니다.</p>
              <button
                onClick={() => setShowProModal(true)}
                className="text-sm font-semibold px-4 py-2 transition-opacity hover:opacity-80"
                style={{ background: "#C8A882", color: "#0F0F0F", borderRadius: 8, whiteSpace: "nowrap" }}
              >
                Pro 업그레이드
              </button>
            </div>
          )}

          {/* 필터 탭 + 검색 */}
          <div className="bg-white border border-[#E8E2DA] mb-6" style={{ borderRadius: 12 }}>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 gap-4 flex-wrap">
              <div className="flex gap-1">
                {FILTER_TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                    style={
                      activeTab === tab
                        ? { background: "#1A3A5C", color: "#fff", fontWeight: 600 }
                        : { color: "#6B6B6B" }
                    }
                  >
                    {tab}
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full"
                      style={
                        activeTab === tab
                          ? { background: "rgba(255,255,255,0.2)", color: "#fff" }
                          : { background: "#F0EDE8", color: "#6B6B6B" }
                      }
                    >
                      {counts[tab]}
                    </span>
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B6B6B]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="바이어 검색..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-[#E8E2DA] rounded-lg bg-[#F8F7F5] focus:outline-none focus:border-[#1A3A5C] transition-colors w-44"
                />
              </div>
            </div>

            {/* 매칭 목록 */}
            {filtered.length === 0 ? (
              <div className="px-6 py-12 text-center border-t border-[#E8E2DA]">
                <p className="text-sm text-[#6B6B6B]">
                  {search ? "검색 결과가 없습니다." : "해당 상태의 매칭 요청이 없습니다."}
                </p>
              </div>
            ) : (
              <ul className="border-t border-[#E8E2DA]">
                {filtered.map((match, idx) => (
                  <li
                    key={match.id}
                    className={`px-6 py-4 ${idx < filtered.length - 1 ? "border-b border-[#E8E2DA]" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-[#0F0F0F]">
                            {match.beauty_buyers?.company_name ?? "바이어"}
                          </p>
                          {match.beauty_buyers?.country && (
                            <span className="text-xs text-[#6B6B6B]">{match.beauty_buyers.country}</span>
                          )}
                          {match.initiated_by === "supplier" && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: "#EEF2F7", color: "#1A3A5C" }}>
                              내가 보낸 요청
                            </span>
                          )}
                        </div>
                        {match.beauty_buyers?.categories && match.beauty_buyers.categories.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {match.beauty_buyers.categories.slice(0, 4).map((cat) => (
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
                        <p className="text-xs text-[#9CA3AF] mt-1.5">
                          {new Date(match.requested_at).toLocaleDateString("ko-KR", {
                            year: "numeric", month: "long", day: "numeric",
                          })}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <StatusBadge status={match.status} />
                        {match.status === "requested" && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleStatus(match.id, "rejected", match.beauty_buyers?.user_id ?? null)}
                              disabled={updatingId === match.id}
                              className="text-xs font-medium px-2.5 py-1 rounded-lg border border-[#E8E2DA] text-[#6B6B6B] hover:bg-[#F8F7F5] transition-colors disabled:opacity-50"
                            >
                              {updatingId === match.id ? "..." : "거절"}
                            </button>
                            <button
                              onClick={() =>
                                proActive
                                  ? handleStatus(match.id, "approved", match.beauty_buyers?.user_id ?? null)
                                  : setShowProModal(true)
                              }
                              disabled={proActive && updatingId === match.id}
                              className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white transition-opacity hover:opacity-80 disabled:opacity-50 flex items-center gap-1"
                              style={{ background: "#1A3A5C" }}
                            >
                              {proActive
                                ? updatingId === match.id ? "..." : "승인"
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
    </div>
  )
}
