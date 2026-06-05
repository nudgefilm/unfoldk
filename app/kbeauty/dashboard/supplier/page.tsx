"use client"

import { useEffect, useState } from "react"
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
} from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

// ─── 타입 ──────────────────────────────────────────────────────────────────

interface Supplier {
  id: string
  company_name_ko: string
  cosmetic_license_verified: boolean
  buyer_db_access: boolean
  status: string
  fda_status: string | null
  fda_registration_number: string | null
  iso_22716: boolean
  vegan_certified: boolean
  cruelty_free_certified: boolean
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

interface Product {
  id: string
}

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
      {/* 로고 */}
      <div className="px-6 py-5 border-b border-[#E8E2DA]">
        <Link href="/kbeauty" className="flex items-center gap-1">
          <span className="font-bold text-[#0F0F0F] text-sm">UnfoldK Beauty</span>
          <span className="text-[#C8A882] text-xs">&#9670;</span>
        </Link>
      </div>

      {/* 네비게이션 */}
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

      {/* 하단 계정 정보 */}
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
  const map: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
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

// ─── 메인 페이지 ───────────────────────────────────────────────────────────

export default function SupplierDashboardPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [productCount, setProductCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/kbeauty")
        return
      }

      // 공급사 정보
      const { data: supplierData } = await supabase
        .from("beauty_suppliers")
        .select("id, company_name_ko, cosmetic_license_verified, buyer_db_access, status, fda_status, fda_registration_number, iso_22716, vegan_certified, cruelty_free_certified, export_experience, export_countries")
        .eq("user_id", user.id)
        .single()

      if (!supplierData) {
        router.push("/kbeauty/supplier")
        return
      }

      setSupplier(supplierData)

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
      {/* 사이드바 */}
      <Sidebar
        companyName={supplier?.company_name_ko ?? ""}
        licenseVerified={supplier?.cosmetic_license_verified ?? false}
      />

      {/* 메인 콘텐츠 */}
      <main className="min-h-screen" style={{ marginLeft: 240 }}>
        <div className="max-w-4xl mx-auto px-8 py-10">

          {/* 환영 메시지 */}
          <h1
            className="text-[#0F0F0F] mb-8"
            style={{
              fontFamily: '"Cormorant Garamond", Georgia, serif',
              fontSize: 28,
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            안녕하세요, {supplier?.company_name_ko ?? ""}님
          </h1>

          {/* 요약 카드 */}
          <div className="flex gap-4 mb-8">
            <SummaryCard label="받은 매칭 요청" value={totalMatchCount} />
            <SummaryCard label="승인한 매칭" value={approvedCount} />
            <SummaryCard label="등록 제품" value={productCount} />
            <SummaryCard label="조회수" value={0} />
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
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0F0F0F]">화장품 제조·책임판매업 등록필증</p>
                  <p className="text-xs text-[#6B6B6B] mt-0.5">식약처 발급 — 국내 합법 화장품 업체 증명</p>
                </div>
                {supplier?.cosmetic_license_verified ? (
                  <span className="text-xs font-medium text-[#1A3A5C] whitespace-nowrap">✅ 등록 완료</span>
                ) : (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-medium text-amber-600 whitespace-nowrap">⚠️ 미등록</span>
                    <Link
                      href="/kbeauty/dashboard/supplier/settings"
                      className="text-xs font-medium text-white px-2.5 py-1 rounded-md"
                      style={{ background: "#1A3A5C" }}
                    >
                      업로드
                    </Link>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-[#E8E2DA] mb-4" />

            {/* 권장 서류 */}
            <p className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wider mb-3">권장 서류 (배지 부여)</p>
            <div className="space-y-4">

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
                </div>
                <span className="text-xs font-medium whitespace-nowrap flex-shrink-0">
                  {supplier?.fda_status === "등록 완료" ? "✅ 등록 완료"
                    : supplier?.fda_status === "진행 중" ? "🔄 진행 중"
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
                </div>
                <span className="text-xs font-medium whitespace-nowrap flex-shrink-0">
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
                </div>
                <span className="text-xs font-medium whitespace-nowrap flex-shrink-0">
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
                </div>
                <span className="text-xs font-medium whitespace-nowrap flex-shrink-0">
                  {supplier?.cruelty_free_certified ? "✅ 보유" : "➖ 미보유"}
                </span>
              </div>

              {/* 수출 경험 */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#0F0F0F]">수출 경험</p>
                  {supplier?.export_experience === "수출 경험 있음" && supplier.export_countries && (
                    <p className="text-xs text-[#6B6B6B] mt-0.5">{supplier.export_countries}</p>
                  )}
                </div>
                <span className="text-xs font-medium whitespace-nowrap flex-shrink-0">
                  {supplier?.export_experience === "수출 경험 있음" ? "✅ 수출 경험 있음"
                    : supplier?.export_experience === "수출 준비 중" ? "🔄 수출 준비 중"
                    : "➖ 미입력"}
                </span>
              </div>

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
