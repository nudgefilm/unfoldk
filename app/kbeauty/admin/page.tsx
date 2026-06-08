"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Loader2, CheckCircle2, XCircle, Package,
  Users, Store, ShoppingBag, Handshake, FlaskConical,
  ToggleLeft, ToggleRight, ExternalLink, Mail, X, Eye,
  Megaphone, Database, Play, ChevronDown,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

// ─── 상수 ──────────────────────────────────────────────────────────────────

const NAVY = "#1A3A5C"
const GOLD = "#C8A882"

type Tab = "suppliers" | "buyers" | "sellers" | "products" | "matches" | "services" | "emails" | "ads" | "pipeline"

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "suppliers", label: "공급사",    icon: Package },
  { key: "buyers",    label: "바이어",    icon: Users },
  { key: "sellers",   label: "셀러",      icon: Store },
  { key: "products",  label: "상품",      icon: ShoppingBag },
  { key: "matches",   label: "매칭",      icon: Handshake },
  { key: "services",  label: "샘플·소싱", icon: FlaskConical },
  { key: "emails",    label: "이메일 발송", icon: Mail },
  { key: "ads",       label: "광고 관리",  icon: Megaphone },
  { key: "pipeline",  label: "수집 파이프라인", icon: Database },
]

// ─── 이메일 템플릿 ─────────────────────────────────────────────────────────

const EMAIL_GROUPS = [
  { value: "all_suppliers",     label: "전체 공급사" },
  { value: "pending_suppliers", label: "승인 대기 공급사 (DB접근 미부여)" },
  { value: "all_buyers",        label: "전체 바이어" },
  { value: "pending_buyers",    label: "미승인 바이어 (1차 미승인)" },
  { value: "all_sellers",       label: "전체 셀러" },
  { value: "all",               label: "전체 (공급사+바이어+셀러)" },
]

const EMAIL_TEMPLATES: Record<string, { subject: string; body: string }> = {
  new_match: {
    subject: "New match available on UnfoldK Beauty",
    body: `Dear {{company_name}},

A new match has been found for you on {{platform_name}}.

Log in to your dashboard to view the match details and take action.

Best regards,
UnfoldK Beauty Team`,
  },
  profile_completion: {
    subject: "Complete your profile on UnfoldK Beauty",
    body: `Dear {{company_name}},

Your profile on {{platform_name}} is incomplete. Completing it will improve your match quality and visibility to partners.

Log in now to complete your profile.

Best regards,
UnfoldK Beauty Team`,
  },
  weekly_report: {
    subject: "Your weekly activity report — UnfoldK Beauty",
    body: `Dear {{company_name}},

Here is your weekly activity summary on {{platform_name}}:

- New matches this week
- Pending responses
- Profile views

Log in to see full details.

Best regards,
UnfoldK Beauty Team`,
  },
  custom: {
    subject: "",
    body: "",
  },
}

// ─── 타입 ──────────────────────────────────────────────────────────────────

interface Stats {
  totalSuppliers: number
  pendingSuppliers: number
  totalBuyers: number
  pendingBuyers: number
  totalSellers: number
  totalMatches: number
  totalServices: number
}

interface AdminSupplier {
  id: string
  company_name_ko: string
  company_name_en: string
  contact_email: string | null
  categories: string[] | null
  status: string
  buyer_db_access: boolean
  created_at: string
}

interface AdminBuyer {
  id: string
  company_name: string
  country: string
  business_email: string
  categories: string[] | null
  stage1_approved: boolean
  stage2_approved: boolean
  created_at: string
}

interface AdminSeller {
  id: string
  company_name: string
  country: string | null
  annual_sales_volume: string | null
  platform_urls: { amazon?: string; shopify?: string; tiktok?: string } | null
  categories: string[] | null
  contact_verified: boolean
  created_at: string
}

interface AdminProduct {
  id: string
  product_name_ko: string
  brand_name: string
  category: string
  status: string
  moq: number | null
  price_range_min: number | null
  supplier_id: string
  created_at: string
}

interface AdminMatch {
  id: string
  supplier_id: string
  buyer_id: string
  status: string
  initiated_by: string | null
  requested_at: string
}

interface AdminService {
  id: string
  service_type: string
  status: string
  buyer_email: string | null
  quantity: number | null
  message: string | null
  supplier_id: string | null
  created_at: string
}

interface AdminSourcing {
  id: string
  seller_id: string
  supplier_id: string
  initiated_by: string
  status: string
  message: string | null
  requested_at: string
}

interface AdminAd {
  id: string
  slot_id: string
  advertiser_type: string
  title: string
  description: string | null
  image_url: string | null
  link_url: string
  status: string
  start_date: string | null
  end_date: string | null
  monthly_price: number
  paid: boolean
  impressions_count: number
  clicks_count: number
  rejection_reason: string | null
  created_at: string
  beauty_ad_slots: { slot_name: string } | null
  users?: { email: string } | null
}

interface StagingStats {
  total: number
  translateCompleted: number
  apolloMapped: number
  inviteSent: number
}

interface StagingRow {
  id: string
  company_name_ko: string
  company_name_en: string | null
  translate_status: string
  apollo_status: string
  invite_status: string
  created_at: string
}

// ─── 유틸 ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" })
}

function StatusBadge({ value }: { value: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    requested:      { bg: "#EFF6FF", color: "#1D4ED8", label: "요청" },
    approved:       { bg: "#ECFDF5", color: "#065F46", label: "승인" },
    rejected:       { bg: "#FEF2F2", color: "#991B1B", label: "거절" },
    completed:      { bg: "#F3F4F6", color: "#374151", label: "완료" },
    pending:        { bg: "#FFFBEB", color: "#92400E", label: "대기" },
    failed:         { bg: "#FEF2F2", color: "#991B1B", label: "실패" },
    active:         { bg: "#ECFDF5", color: "#065F46", label: "활성" },
    inactive:       { bg: "#F3F4F6", color: "#374151", label: "비활성" },
    stage2_pending: { bg: "#F5F3FF", color: "#5B21B6", label: "2차 대기" },
    pre_registered: { bg: "#F3F4F6", color: "#374151", label: "사전등록" },
    suspended:      { bg: "#FEF2F2", color: "#991B1B", label: "정지" },
    sent:           { bg: "#EFF6FF", color: "#1D4ED8", label: "발송완료" },
    bounced:        { bg: "#FEF2F2", color: "#991B1B", label: "반송" },
    unsubscribed:   { bg: "#F3F4F6", color: "#374151", label: "수신거부" },
    mapped:         { bg: "#ECFDF5", color: "#065F46", label: "매핑완료" },
    not_found:      { bg: "#F3F4F6", color: "#374151", label: "미발견" },
  }
  const s = map[value] ?? { bg: "#F3F4F6", color: "#374151", label: value }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function ToggleBtn({ on, onClick, loading }: { on: boolean; onClick: () => void; loading?: boolean }) {
  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-[#6B6B6B]" />
  return (
    <button onClick={onClick} className="hover:opacity-70 transition-opacity">
      {on
        ? <ToggleRight className="w-6 h-6" style={{ color: "#10B981" }} />
        : <ToggleLeft  className="w-6 h-6 text-[#D1D5DB]" />}
    </button>
  )
}

// ─── 메인 페이지 ───────────────────────────────────────────────────────────

export default function KBeautyAdminPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [ready, setReady] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>("suppliers")
  const [loadedTabs, setLoadedTabs] = useState<Set<Tab>>(new Set())
  const [toggling, setToggling] = useState<string | null>(null)

  // 탭별 데이터
  const [suppliers, setSuppliers]   = useState<AdminSupplier[]>([])
  const [buyers,    setBuyers]      = useState<AdminBuyer[]>([])
  const [sellers,   setSellers]     = useState<AdminSeller[]>([])
  const [products,  setProducts]    = useState<AdminProduct[]>([])
  const [matches,   setMatches]     = useState<AdminMatch[]>([])
  const [services,  setServices]    = useState<AdminService[]>([])
  const [sourcings, setSourceings]  = useState<AdminSourcing[]>([])
  const [ads,       setAds]         = useState<AdminAd[]>([])

  // 파이프라인 탭 상태
  const [stagingStats,       setStagingStats]       = useState<StagingStats | null>(null)
  const [stagingItems,       setStagingItems]       = useState<StagingRow[]>([])
  const [stagingFilter,      setStagingFilter]      = useState<string>("all")
  const [stagingPage,        setStagingPage]        = useState<number>(1)
  const [pipelineRunning,    setPipelineRunning]    = useState<Record<string, boolean>>({})
  const [openSections,       setOpenSections]       = useState<Record<string, boolean>>({ supplier: true, buyer: false, seller: false })

  // 광고 관리 상태
  const [adFilter,       setAdFilter]       = useState<string>("all")
  const [rejectTarget,   setRejectTarget]   = useState<string | null>(null)
  const [rejectReason,   setRejectReason]   = useState("")
  const [adActioning,    setAdActioning]    = useState<string | null>(null)

  // 이름 맵 (ID → 이름) — 매칭·상품 탭 표시용
  const [supplierNameMap, setSupplierNameMap] = useState<Record<string, string>>({})
  const [buyerNameMap,    setBuyerNameMap]    = useState<Record<string, string>>({})
  const [sellerNameMap,   setSellerNameMap]   = useState<Record<string, string>>({})

  // 매칭 상태 필터
  const [matchFilter, setMatchFilter] = useState<string>("all")

  // 이메일 발송 탭 상태
  const [emailGroup,    setEmailGroup]    = useState("all_suppliers")
  const [emailTemplate, setEmailTemplate] = useState("new_match")
  const [emailSubject,  setEmailSubject]  = useState(EMAIL_TEMPLATES.new_match.subject)
  const [emailBody,     setEmailBody]     = useState(EMAIL_TEMPLATES.new_match.body)
  const [showPreview,   setShowPreview]   = useState(false)
  const [isSending,     setIsSending]     = useState(false)

  // ─── 초기화 ───────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/kbeauty/login"); return }

      // 어드민 여부 확인 (SECURITY DEFINER 함수 호출)
      const { data: isAdminResult } = await supabase.rpc("is_admin", { uid: user.id })
      if (!isAdminResult) { router.push("/kbeauty/login"); return }

      // 통계 + 이름 맵 병렬 로드
      const [
        { count: tSup },  { count: pSup },
        { count: tBuy },  { count: pBuy },
        { count: tSel },  { count: tMatch },
        { count: tSvc },  { count: tSrc },
        { data: supNames }, { data: buyNames }, { data: selNames },
      ] = await Promise.all([
        supabase.from("beauty_suppliers").select("*", { count: "exact", head: true }),
        supabase.from("beauty_suppliers").select("*", { count: "exact", head: true }).eq("buyer_db_access", false),
        supabase.from("beauty_buyers").select("*", { count: "exact", head: true }),
        supabase.from("beauty_buyers").select("*", { count: "exact", head: true }).eq("stage1_approved", false),
        supabase.from("beauty_sellers").select("*", { count: "exact", head: true }),
        supabase.from("beauty_matches").select("*", { count: "exact", head: true }),
        supabase.from("beauty_post_matching_services").select("*", { count: "exact", head: true }),
        supabase.from("beauty_seller_sourcing").select("*", { count: "exact", head: true }),
        supabase.from("beauty_suppliers").select("id, company_name_ko"),
        supabase.from("beauty_buyers").select("id, company_name"),
        supabase.from("beauty_sellers").select("id, company_name"),
      ])

      setStats({
        totalSuppliers:   tSup ?? 0,
        pendingSuppliers: pSup ?? 0,
        totalBuyers:      tBuy ?? 0,
        pendingBuyers:    pBuy ?? 0,
        totalSellers:     tSel ?? 0,
        totalMatches:     tMatch ?? 0,
        totalServices:    (tSvc ?? 0) + (tSrc ?? 0),
      })

      const snm: Record<string, string> = {}
      ;(supNames ?? []).forEach((r: { id: string; company_name_ko: string }) => { snm[r.id] = r.company_name_ko })
      setSupplierNameMap(snm)

      const bnm: Record<string, string> = {}
      ;(buyNames ?? []).forEach((r: { id: string; company_name: string }) => { bnm[r.id] = r.company_name })
      setBuyerNameMap(bnm)

      const slnm: Record<string, string> = {}
      ;(selNames ?? []).forEach((r: { id: string; company_name: string }) => { slnm[r.id] = r.company_name })
      setSellerNameMap(slnm)

      setReady(true)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── 탭 데이터 로드 ───────────────────────────────────────────────────────

  const loadTab = useCallback(async (tab: Tab) => {
    if (loadedTabs.has(tab)) return

    if (tab === "suppliers") {
      const { data } = await supabase.from("beauty_suppliers")
        .select("id, company_name_ko, company_name_en, contact_email, categories, status, buyer_db_access, created_at")
        .order("created_at", { ascending: false })
      setSuppliers((data ?? []) as AdminSupplier[])
    }
    if (tab === "buyers") {
      const { data } = await supabase.from("beauty_buyers")
        .select("id, company_name, country, business_email, categories, stage1_approved, stage2_approved, created_at")
        .order("created_at", { ascending: false })
      setBuyers((data ?? []) as AdminBuyer[])
    }
    if (tab === "sellers") {
      const { data } = await supabase.from("beauty_sellers")
        .select("id, company_name, country, annual_sales_volume, platform_urls, categories, contact_verified, created_at")
        .order("created_at", { ascending: false })
      setSellers((data ?? []) as AdminSeller[])
    }
    if (tab === "products") {
      const { data } = await supabase.from("beauty_products")
        .select("id, product_name_ko, brand_name, category, status, moq, price_range_min, supplier_id, created_at")
        .order("created_at", { ascending: false })
      setProducts((data ?? []) as AdminProduct[])
    }
    if (tab === "matches") {
      const { data } = await supabase.from("beauty_matches")
        .select("id, supplier_id, buyer_id, status, initiated_by, requested_at")
        .order("requested_at", { ascending: false })
      setMatches((data ?? []) as AdminMatch[])
    }
    if (tab === "services") {
      const [{ data: svc }, { data: src }] = await Promise.all([
        supabase.from("beauty_post_matching_services")
          .select("id, service_type, status, buyer_email, quantity, message, supplier_id, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("beauty_seller_sourcing")
          .select("id, seller_id, supplier_id, initiated_by, status, message, requested_at")
          .order("requested_at", { ascending: false }),
      ])
      setServices((svc ?? []) as AdminService[])
      setSourceings((src ?? []) as AdminSourcing[])
    }

    if (tab === "ads") {
      const { data } = await supabase
        .from("beauty_ads")
        .select("id, slot_id, advertiser_type, title, description, image_url, link_url, status, start_date, end_date, monthly_price, paid, impressions_count, clicks_count, rejection_reason, created_at, beauty_ad_slots(slot_name)")
        .order("created_at", { ascending: false })
      setAds((data ?? []) as AdminAd[])
    }

    if (tab === "pipeline") {
      const [
        { count: total },
        { count: translateCompleted },
        { count: apolloMapped },
        { count: inviteSent },
        { data: items },
      ] = await Promise.all([
        supabase.from("beauty_suppliers_staging").select("*", { count: "exact", head: true }),
        supabase.from("beauty_suppliers_staging").select("*", { count: "exact", head: true }).eq("translate_status", "completed"),
        supabase.from("beauty_suppliers_staging").select("*", { count: "exact", head: true }).eq("apollo_status", "mapped"),
        supabase.from("beauty_suppliers_staging").select("*", { count: "exact", head: true }).eq("invite_status", "sent"),
        supabase.from("beauty_suppliers_staging")
          .select("id, company_name_ko, company_name_en, translate_status, apollo_status, invite_status, created_at")
          .order("created_at", { ascending: false })
          .range(0, 49),
      ])
      setStagingStats({
        total: total ?? 0,
        translateCompleted: translateCompleted ?? 0,
        apolloMapped: apolloMapped ?? 0,
        inviteSent: inviteSent ?? 0,
      })
      setStagingPage(1)
      setStagingItems((items ?? []) as StagingRow[])
    }

    setLoadedTabs(prev => new Set(prev).add(tab))
  }, [loadedTabs, supabase])

  useEffect(() => {
    if (ready) loadTab(activeTab)
  }, [activeTab, ready, loadTab])

  // ─── 토글 함수 ────────────────────────────────────────────────────────────

  async function toggleBuyerDbAccess(id: string, current: boolean) {
    setToggling(id)
    const { error } = await supabase.from("beauty_suppliers")
      .update({ buyer_db_access: !current }).eq("id", id)
    if (error) { toast.error("업데이트 실패"); setToggling(null); return }
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, buyer_db_access: !current } : s))
    setStats(prev => prev ? {
      ...prev,
      pendingSuppliers: prev.pendingSuppliers + (current ? 1 : -1),
    } : prev)
    toast.success(!current ? "DB 접근 권한 부여됨" : "DB 접근 권한 해제됨")
    setToggling(null)
  }

  async function toggleBuyerApproval(id: string, field: "stage1_approved" | "stage2_approved", current: boolean) {
    setToggling(`${id}-${field}`)
    const { error } = await supabase.from("beauty_buyers")
      .update({ [field]: !current }).eq("id", id)
    if (error) { toast.error("업데이트 실패"); setToggling(null); return }
    setBuyers(prev => prev.map(b => b.id === id ? { ...b, [field]: !current } : b))
    if (field === "stage1_approved") {
      setStats(prev => prev ? {
        ...prev,
        pendingBuyers: prev.pendingBuyers + (current ? 1 : -1),
      } : prev)
    }
    toast.success(!current ? "승인됨" : "승인 취소됨")
    setToggling(null)
  }

  function handleTemplateChange(tpl: string) {
    setEmailTemplate(tpl)
    if (tpl !== "custom") {
      setEmailSubject(EMAIL_TEMPLATES[tpl].subject)
      setEmailBody(EMAIL_TEMPLATES[tpl].body)
    }
  }

  async function handleSendEmail() {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error("제목과 본문을 입력해주세요.")
      return
    }
    setIsSending(true)
    try {
      const res = await fetch("/api/kbeauty/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group: emailGroup, subject: emailSubject, body: emailBody }),
      })
      const result = await res.json() as { success?: number; failed?: number; message?: string; error?: string }
      if (!res.ok) {
        toast.error(result.error ?? "발송 실패")
        return
      }
      if (result.message) {
        toast.info(result.message)
      } else {
        toast.success(`발송 완료 — 성공 ${result.success ?? 0}건 / 실패 ${result.failed ?? 0}건`)
      }
    } catch {
      toast.error("발송 중 오류가 발생했습니다.")
    } finally {
      setIsSending(false)
    }
  }

  async function approveAd(id: string) {
    setAdActioning(id)
    const ad = ads.find(a => a.id === id)
    const newStatus = ad?.start_date && new Date(ad.start_date) > new Date() ? "approved" : "active"
    const { error } = await supabase.from("beauty_ads").update({ status: newStatus }).eq("id", id)
    if (error) { toast.error("업데이트 실패"); setAdActioning(null); return }
    setAds(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a))
    toast.success(newStatus === "active" ? "광고 승인 및 집행 시작됨" : "광고 승인됨 (집행일 대기)")
    setAdActioning(null)
  }

  async function rejectAd(id: string) {
    if (!rejectReason.trim()) { toast.error("거절 사유를 입력하세요."); return }
    setAdActioning(id)
    const { error } = await supabase.from("beauty_ads")
      .update({ status: "rejected", rejection_reason: rejectReason.trim() }).eq("id", id)
    if (error) { toast.error("업데이트 실패"); setAdActioning(null); return }
    setAds(prev => prev.map(a => a.id === id ? { ...a, status: "rejected", rejection_reason: rejectReason.trim() } : a))
    toast.success("광고 거절됨")
    setRejectTarget(null)
    setRejectReason("")
    setAdActioning(null)
  }

  async function updateProductStatus(id: string, newStatus: "active" | "inactive") {
    setToggling(id)
    const { error } = await supabase.from("beauty_products")
      .update({ status: newStatus }).eq("id", id)
    if (error) { toast.error("업데이트 실패"); setToggling(null); return }
    setProducts(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p))
    toast.success(newStatus === "active" ? "상품 승인됨" : "상품 비활성화됨")
    setToggling(null)
  }

  function toggleSection(key: string) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function refreshStagingData() {
    const [
      { count: total },
      { count: translateCompleted },
      { count: apolloMapped },
      { count: inviteSent },
      { data: items },
    ] = await Promise.all([
      supabase.from("beauty_suppliers_staging").select("*", { count: "exact", head: true }),
      supabase.from("beauty_suppliers_staging").select("*", { count: "exact", head: true }).eq("translate_status", "completed"),
      supabase.from("beauty_suppliers_staging").select("*", { count: "exact", head: true }).eq("apollo_status", "mapped"),
      supabase.from("beauty_suppliers_staging").select("*", { count: "exact", head: true }).eq("invite_status", "sent"),
      supabase.from("beauty_suppliers_staging")
        .select("id, company_name_ko, company_name_en, translate_status, apollo_status, invite_status, created_at")
        .order("created_at", { ascending: false })
        .range(0, 49),
    ])
    setStagingStats({ total: total ?? 0, translateCompleted: translateCompleted ?? 0, apolloMapped: apolloMapped ?? 0, inviteSent: inviteSent ?? 0 })
    setStagingPage(1)
    setStagingItems((items ?? []) as StagingRow[])
  }

  async function loadStagingPage(page: number) {
    const from = (page - 1) * 50
    const { data: items } = await supabase
      .from("beauty_suppliers_staging")
      .select("id, company_name_ko, company_name_en, translate_status, apollo_status, invite_status, created_at")
      .order("created_at", { ascending: false })
      .range(from, from + 49)
    setStagingPage(page)
    setStagingItems((items ?? []) as StagingRow[])
  }

  async function runPipeline(endpoint: string, key: string) {
    setPipelineRunning(prev => ({ ...prev, [key]: true }))
    try {
      const res = await fetch(endpoint, { method: "POST" })
      const result = await res.json() as Record<string, unknown>
      if (!res.ok) {
        toast.error(`실패: ${String(result.error ?? "오류 발생")}`)
      } else {
        const msg = Object.entries(result)
          .filter(([k]) => k !== "message")
          .map(([k, v]) => `${k}: ${v}`)
          .join(" / ")
        const message = typeof result.message === "string" ? result.message : msg
        toast.success(`완료 — ${message}`)
        await refreshStagingData()
      }
    } catch {
      toast.error("요청 중 오류가 발생했습니다.")
    } finally {
      setPipelineRunning(prev => ({ ...prev, [key]: false }))
    }
  }

  // ─── 렌더링 ───────────────────────────────────────────────────────────────

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#F8F7F5] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: NAVY }} />
      </div>
    )
  }

  const thCls = "text-left text-xs font-semibold text-[#6B6B6B] pb-2 border-b border-[#E8E2DA] whitespace-nowrap"
  const tdCls = "text-sm text-[#0F0F0F] py-2.5 align-top"

  return (
    <div
      className="min-h-screen bg-[#F8F7F5]"
      style={{ fontFamily: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
    >
      <Toaster position="top-right" richColors />

      {/* ── 사이드바 ──────────────────────────────────────────────────── */}
      <aside
        className="fixed top-0 left-0 h-screen bg-white border-r border-[#E8E2DA] flex flex-col z-20"
        style={{ width: 220 }}
      >
        <div className="px-5 py-5 border-b border-[#E8E2DA]">
          <Link href="/kbeauty" className="flex items-center gap-1">
            <span className="font-bold text-[#0F0F0F] text-sm">UnfoldK Beauty</span>
            <span style={{ color: GOLD }} className="text-xs">&#9670;</span>
          </Link>
          <span className="mt-1 block text-[10px] font-semibold tracking-widest text-[#6B6B6B] uppercase">Admin</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left"
              style={
                activeTab === key
                  ? { background: NAVY, color: "white" }
                  : { color: "#6B6B6B" }
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-[#E8E2DA]">
          <span className="text-xs text-[#6B6B6B]">관리자 전용</span>
        </div>
      </aside>

      {/* ── 메인 콘텐츠 ───────────────────────────────────────────────── */}
      <main className="min-h-screen" style={{ marginLeft: 220 }}>
        <div className="px-8 py-8">

          {/* 헤더 */}
          <div className="mb-6">
            <h1
              className="text-[#0F0F0F]"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: 26, fontWeight: 600 }}
            >
              KBeauty 어드민 패널
            </h1>
          </div>

          {/* ── 통계 카드 7개 ────────────────────────────────────────── */}
          {stats && (
            <div className="grid grid-cols-7 gap-3 mb-8">
              {[
                { label: "전체 공급사", value: stats.totalSuppliers, sub: null },
                { label: "승인 대기 공급사", value: stats.pendingSuppliers, sub: "DB접근 미부여", warn: stats.pendingSuppliers > 0 },
                { label: "전체 바이어", value: stats.totalBuyers, sub: null },
                { label: "승인 대기 바이어", value: stats.pendingBuyers, sub: "1차 미승인", warn: stats.pendingBuyers > 0 },
                { label: "전체 셀러", value: stats.totalSellers, sub: null },
                { label: "전체 매칭 요청", value: stats.totalMatches, sub: null },
                { label: "샘플·소싱 요청", value: stats.totalServices, sub: null },
              ].map(({ label, value, sub, warn }) => (
                <div
                  key={label}
                  className="bg-white border rounded-xl p-4 shadow-[0_1px_4px_rgba(0,0,0,0.05)]"
                  style={{ borderColor: warn ? "#F59E0B" : "#E8E2DA" }}
                >
                  <p className="text-xs text-[#6B6B6B] mb-1 leading-snug">{label}</p>
                  <p className="text-2xl font-bold" style={{ color: warn ? "#D97706" : NAVY }}>{value}</p>
                  {sub && <p className="text-[10px] text-[#6B6B6B] mt-0.5">{sub}</p>}
                </div>
              ))}
            </div>
          )}

          {/* ── 탭 콘텐츠 ────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E8E2DA] rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">

            {/* ── ① 공급사 관리 ──────────────────────────────────────── */}
            {activeTab === "suppliers" && (
              <div className="p-6">
                <h2 className="text-base font-bold text-[#0F0F0F] mb-4">공급사 관리</h2>
                {!loadedTabs.has("suppliers")
                  ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#6B6B6B]" /></div>
                  : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          {["회사명(한)", "회사명(영)", "이메일", "카테고리", "상태", "DB 접근", "가입일", ""].map(h => (
                            <th key={h} className={thCls + " pr-4"}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F3F4F6]">
                        {suppliers.map(s => (
                          <tr key={s.id}>
                            <td className={tdCls + " pr-4 font-medium max-w-[140px] truncate"}>{s.company_name_ko}</td>
                            <td className={tdCls + " pr-4 text-[#6B6B6B] max-w-[140px] truncate"}>{s.company_name_en}</td>
                            <td className={tdCls + " pr-4 text-[#6B6B6B] text-xs"}>{s.contact_email ?? "—"}</td>
                            <td className={tdCls + " pr-4"}>
                              <div className="flex flex-wrap gap-1">
                                {(s.categories ?? []).slice(0, 3).map(c => (
                                  <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#6B6B6B]">{c}</span>
                                ))}
                              </div>
                            </td>
                            <td className={tdCls + " pr-4"}><StatusBadge value={s.status} /></td>
                            <td className={tdCls + " pr-4"}>
                              <ToggleBtn
                                on={s.buyer_db_access}
                                loading={toggling === s.id}
                                onClick={() => toggleBuyerDbAccess(s.id, s.buyer_db_access)}
                              />
                            </td>
                            <td className={tdCls + " text-[#6B6B6B] text-xs"}>{fmtDate(s.created_at)}</td>
                            <td className={tdCls}>
                              <a
                                href={`/kbeauty/dashboard/supplier?preview=${s.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-[#1A3A5C] hover:underline whitespace-nowrap"
                              >
                                <ExternalLink className="w-3 h-3" />보기
                              </a>
                            </td>
                          </tr>
                        ))}
                        {suppliers.length === 0 && (
                          <tr><td colSpan={8} className="text-center py-10 text-sm text-[#6B6B6B]">데이터 없음</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── ② 바이어 관리 ──────────────────────────────────────── */}
            {activeTab === "buyers" && (
              <div className="p-6">
                <h2 className="text-base font-bold text-[#0F0F0F] mb-4">바이어 관리</h2>
                {!loadedTabs.has("buyers")
                  ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#6B6B6B]" /></div>
                  : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          {["회사명", "국가", "이메일", "카테고리", "1차 승인", "2차 승인", "가입일", ""].map(h => (
                            <th key={h} className={thCls + " pr-4"}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F3F4F6]">
                        {buyers.map(b => (
                          <tr key={b.id}>
                            <td className={tdCls + " pr-4 font-medium max-w-[160px] truncate"}>{b.company_name}</td>
                            <td className={tdCls + " pr-4 text-[#6B6B6B]"}>{b.country}</td>
                            <td className={tdCls + " pr-4 text-[#6B6B6B] text-xs"}>{b.business_email}</td>
                            <td className={tdCls + " pr-4"}>
                              <div className="flex flex-wrap gap-1">
                                {(b.categories ?? []).slice(0, 3).map(c => (
                                  <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#6B6B6B]">{c}</span>
                                ))}
                              </div>
                            </td>
                            <td className={tdCls + " pr-4"}>
                              <ToggleBtn
                                on={b.stage1_approved}
                                loading={toggling === `${b.id}-stage1_approved`}
                                onClick={() => toggleBuyerApproval(b.id, "stage1_approved", b.stage1_approved)}
                              />
                            </td>
                            <td className={tdCls + " pr-4"}>
                              <ToggleBtn
                                on={b.stage2_approved}
                                loading={toggling === `${b.id}-stage2_approved`}
                                onClick={() => toggleBuyerApproval(b.id, "stage2_approved", b.stage2_approved)}
                              />
                            </td>
                            <td className={tdCls + " text-[#6B6B6B] text-xs"}>{fmtDate(b.created_at)}</td>
                            <td className={tdCls}>
                              <a
                                href={`/kbeauty/dashboard/buyer?preview=${b.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-[#1A3A5C] hover:underline whitespace-nowrap"
                              >
                                <ExternalLink className="w-3 h-3" />보기
                              </a>
                            </td>
                          </tr>
                        ))}
                        {buyers.length === 0 && (
                          <tr><td colSpan={8} className="text-center py-10 text-sm text-[#6B6B6B]">데이터 없음</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── ③ 셀러 관리 ────────────────────────────────────────── */}
            {activeTab === "sellers" && (
              <div className="p-6">
                <h2 className="text-base font-bold text-[#0F0F0F] mb-4">셀러 관리</h2>
                {!loadedTabs.has("sellers")
                  ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#6B6B6B]" /></div>
                  : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          {["회사명", "국가", "연매출", "플랫폼", "카테고리", "인증", "가입일", ""].map(h => (
                            <th key={h} className={thCls + " pr-4"}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F3F4F6]">
                        {sellers.map(s => {
                          const pu = s.platform_urls ?? {}
                          return (
                            <tr key={s.id}>
                              <td className={tdCls + " pr-4 font-medium max-w-[140px] truncate"}>{s.company_name}</td>
                              <td className={tdCls + " pr-4 text-[#6B6B6B]"}>{s.country ?? "—"}</td>
                              <td className={tdCls + " pr-4 text-xs text-[#6B6B6B]"}>{s.annual_sales_volume ?? "—"}</td>
                              <td className={tdCls + " pr-4"}>
                                <div className="flex gap-1.5">
                                  {pu.amazon  && <a href={pu.amazon}  target="_blank" rel="noopener noreferrer" className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#FFF7ED] text-[#C2410C] hover:opacity-80 flex items-center gap-0.5">AMZ<ExternalLink className="w-2.5 h-2.5" /></a>}
                                  {pu.shopify && <a href={pu.shopify} target="_blank" rel="noopener noreferrer" className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#F0FDF4] text-[#166534] hover:opacity-80 flex items-center gap-0.5">SHO<ExternalLink className="w-2.5 h-2.5" /></a>}
                                  {pu.tiktok  && <a href={pu.tiktok}  target="_blank" rel="noopener noreferrer" className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#FDF2F8] text-[#86198F] hover:opacity-80 flex items-center gap-0.5">TTK<ExternalLink className="w-2.5 h-2.5" /></a>}
                                  {!pu.amazon && !pu.shopify && !pu.tiktok && <span className="text-xs text-[#6B6B6B]">—</span>}
                                </div>
                              </td>
                              <td className={tdCls + " pr-4"}>
                                <div className="flex flex-wrap gap-1">
                                  {(s.categories ?? []).slice(0, 3).map(c => (
                                    <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#6B6B6B]">{c}</span>
                                  ))}
                                </div>
                              </td>
                              <td className={tdCls + " pr-4"}>
                                {s.contact_verified
                                  ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                                  : <XCircle className="w-4 h-4 text-[#D1D5DB]" />}
                              </td>
                              <td className={tdCls + " text-[#6B6B6B] text-xs"}>{fmtDate(s.created_at)}</td>
                              <td className={tdCls}>
                                <a
                                  href={`/kbeauty/dashboard/seller?preview=${s.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-[#1A3A5C] hover:underline whitespace-nowrap"
                                >
                                  <ExternalLink className="w-3 h-3" />보기
                                </a>
                              </td>
                            </tr>
                          )
                        })}
                        {sellers.length === 0 && (
                          <tr><td colSpan={8} className="text-center py-10 text-sm text-[#6B6B6B]">데이터 없음</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── ④ 상품 관리 ────────────────────────────────────────── */}
            {activeTab === "products" && (
              <div className="p-6">
                <h2 className="text-base font-bold text-[#0F0F0F] mb-4">상품 관리</h2>
                {!loadedTabs.has("products")
                  ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#6B6B6B]" /></div>
                  : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          {["상품명", "브랜드", "카테고리", "상태", "공급사", "MOQ", "수출가", "등록일", "액션"].map(h => (
                            <th key={h} className={thCls + " pr-4"}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F3F4F6]">
                        {products.map(p => (
                          <tr key={p.id}>
                            <td className={tdCls + " pr-4 font-medium max-w-[180px] truncate"}>{p.product_name_ko}</td>
                            <td className={tdCls + " pr-4 text-[#6B6B6B]"}>{p.brand_name}</td>
                            <td className={tdCls + " pr-4"}><StatusBadge value={p.category} /></td>
                            <td className={tdCls + " pr-4"}><StatusBadge value={p.status} /></td>
                            <td className={tdCls + " pr-4 text-xs text-[#6B6B6B] max-w-[120px] truncate"}>
                              {supplierNameMap[p.supplier_id] ?? p.supplier_id.slice(0, 8) + "…"}
                            </td>
                            <td className={tdCls + " pr-4 text-[#6B6B6B]"}>{p.moq ?? "—"}</td>
                            <td className={tdCls + " pr-4 text-[#6B6B6B]"}>
                              {p.price_range_min != null ? `$${p.price_range_min}` : "—"}
                            </td>
                            <td className={tdCls + " pr-4 text-[#6B6B6B] text-xs"}>{fmtDate(p.created_at)}</td>
                            <td className={tdCls}>
                              {toggling === p.id
                                ? <Loader2 className="w-4 h-4 animate-spin text-[#6B6B6B]" />
                                : (
                                <div className="flex gap-1.5">
                                  {p.status !== "active" && (
                                    <button
                                      onClick={() => updateProductStatus(p.id, "active")}
                                      className="text-[10px] font-semibold px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 transition-colors whitespace-nowrap"
                                    >
                                      승인
                                    </button>
                                  )}
                                  {p.status !== "inactive" && (
                                    <button
                                      onClick={() => updateProductStatus(p.id, "inactive")}
                                      className="text-[10px] font-semibold px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 transition-colors whitespace-nowrap"
                                    >
                                      비활성
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                        {products.length === 0 && (
                          <tr><td colSpan={9} className="text-center py-10 text-sm text-[#6B6B6B]">데이터 없음</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── ⑤ 매칭 관리 ────────────────────────────────────────── */}
            {activeTab === "matches" && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-[#0F0F0F]">매칭 관리</h2>
                  <div className="flex gap-1.5">
                    {["all", "requested", "stage2_pending", "approved", "rejected", "completed"].map(f => (
                      <button
                        key={f}
                        onClick={() => setMatchFilter(f)}
                        className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                        style={
                          matchFilter === f
                            ? { background: NAVY, borderColor: NAVY, color: "white" }
                            : { background: "white", borderColor: "#E8E2DA", color: "#6B6B6B" }
                        }
                      >
                        {f === "all" ? "전체" : f === "requested" ? "요청" : f === "stage2_pending" ? "2차 대기" :
                         f === "approved" ? "승인" : f === "rejected" ? "거절" : "완료"}
                      </button>
                    ))}
                  </div>
                </div>
                {!loadedTabs.has("matches")
                  ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#6B6B6B]" /></div>
                  : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          {["공급사", "바이어", "상태", "요청 유형", "요청일"].map(h => (
                            <th key={h} className={thCls + " pr-4"}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F3F4F6]">
                        {matches
                          .filter(m => matchFilter === "all" || m.status === matchFilter)
                          .map(m => (
                          <tr key={m.id}>
                            <td className={tdCls + " pr-4 font-medium max-w-[160px] truncate"}>
                              {supplierNameMap[m.supplier_id] ?? m.supplier_id.slice(0, 8) + "…"}
                            </td>
                            <td className={tdCls + " pr-4 max-w-[160px] truncate"}>
                              {buyerNameMap[m.buyer_id] ?? m.buyer_id.slice(0, 8) + "…"}
                            </td>
                            <td className={tdCls + " pr-4"}><StatusBadge value={m.status} /></td>
                            <td className={tdCls + " pr-4 text-xs text-[#6B6B6B]"}>
                              {m.initiated_by === "supplier" ? "공급사 → 바이어" : m.initiated_by === "buyer" ? "바이어 → 공급사" : "—"}
                            </td>
                            <td className={tdCls + " text-[#6B6B6B] text-xs"}>{fmtDate(m.requested_at)}</td>
                          </tr>
                        ))}
                        {matches.filter(m => matchFilter === "all" || m.status === matchFilter).length === 0 && (
                          <tr><td colSpan={5} className="text-center py-10 text-sm text-[#6B6B6B]">데이터 없음</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── ⑥ 샘플·소싱 관리 ──────────────────────────────────── */}
            {activeTab === "services" && (
              <div className="p-6">
                <h2 className="text-base font-bold text-[#0F0F0F] mb-5">샘플·소싱 요청</h2>
                {!loadedTabs.has("services")
                  ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#6B6B6B]" /></div>
                  : (
                  <>
                    {/* 샘플 요청 */}
                    <div className="mb-8">
                      <h3 className="text-sm font-semibold text-[#0F0F0F] mb-3">샘플 요청 (beauty_post_matching_services)</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr>
                              {["유형", "바이어 이메일", "공급사", "상태", "수량", "메시지", "날짜"].map(h => (
                                <th key={h} className={thCls + " pr-4"}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#F3F4F6]">
                            {services.map(sv => (
                              <tr key={sv.id}>
                                <td className={tdCls + " pr-4"}>
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{sv.service_type}</span>
                                </td>
                                <td className={tdCls + " pr-4 text-xs text-[#6B6B6B] max-w-[160px] truncate"}>{sv.buyer_email ?? "—"}</td>
                                <td className={tdCls + " pr-4 text-xs text-[#6B6B6B] max-w-[140px] truncate"}>
                                  {sv.supplier_id ? (supplierNameMap[sv.supplier_id] ?? sv.supplier_id.slice(0, 8) + "…") : "—"}
                                </td>
                                <td className={tdCls + " pr-4"}><StatusBadge value={sv.status} /></td>
                                <td className={tdCls + " pr-4 text-[#6B6B6B]"}>{sv.quantity ?? "—"}</td>
                                <td className={tdCls + " pr-4 text-xs text-[#6B6B6B] max-w-[200px] truncate"}>{sv.message ?? "—"}</td>
                                <td className={tdCls + " text-[#6B6B6B] text-xs"}>{fmtDate(sv.created_at)}</td>
                              </tr>
                            ))}
                            {services.length === 0 && (
                              <tr><td colSpan={7} className="text-center py-6 text-sm text-[#6B6B6B]">데이터 없음</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 소싱 요청 */}
                    <div>
                      <h3 className="text-sm font-semibold text-[#0F0F0F] mb-3">소싱 요청 (beauty_seller_sourcing)</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr>
                              {["셀러", "공급사", "요청 방향", "상태", "메시지", "날짜"].map(h => (
                                <th key={h} className={thCls + " pr-4"}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#F3F4F6]">
                            {sourcings.map(sc => (
                              <tr key={sc.id}>
                                <td className={tdCls + " pr-4 max-w-[140px] truncate"}>
                                  {sellerNameMap[sc.seller_id] ?? sc.seller_id.slice(0, 8) + "…"}
                                </td>
                                <td className={tdCls + " pr-4 max-w-[140px] truncate"}>
                                  {supplierNameMap[sc.supplier_id] ?? sc.supplier_id.slice(0, 8) + "…"}
                                </td>
                                <td className={tdCls + " pr-4 text-xs text-[#6B6B6B]"}>
                                  {sc.initiated_by === "seller" ? "셀러 → 공급사" : "공급사 → 셀러"}
                                </td>
                                <td className={tdCls + " pr-4"}><StatusBadge value={sc.status} /></td>
                                <td className={tdCls + " pr-4 text-xs text-[#6B6B6B] max-w-[200px] truncate"}>{sc.message ?? "—"}</td>
                                <td className={tdCls + " text-[#6B6B6B] text-xs"}>{fmtDate(sc.requested_at)}</td>
                              </tr>
                            ))}
                            {sourcings.length === 0 && (
                              <tr><td colSpan={6} className="text-center py-6 text-sm text-[#6B6B6B]">데이터 없음</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── ⑦ 이메일 발송 ──────────────────────────────────────── */}
            {activeTab === "emails" && (
              <div className="p-6 max-w-2xl">
                <h2 className="text-base font-bold text-[#0F0F0F] mb-6">이메일 발송</h2>

                {/* 대상 그룹 */}
                <div className="mb-5">
                  <p className="text-sm font-semibold text-[#0F0F0F] mb-3">대상 그룹</p>
                  <div className="flex flex-col gap-2.5">
                    {EMAIL_GROUPS.map(g => (
                      <label key={g.value} className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="radio"
                          name="emailGroup"
                          value={g.value}
                          checked={emailGroup === g.value}
                          onChange={() => setEmailGroup(g.value)}
                          className="w-4 h-4"
                          style={{ accentColor: NAVY }}
                        />
                        <span className="text-sm text-[#0F0F0F]">{g.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[#E8E2DA] my-5" />

                {/* 템플릿 선택 */}
                <div className="mb-5">
                  <label className="block text-sm font-semibold text-[#0F0F0F] mb-2">템플릿</label>
                  <select
                    value={emailTemplate}
                    onChange={e => handleTemplateChange(e.target.value)}
                    className="w-full text-sm border border-[#E8E2DA] rounded-lg px-4 py-2.5 bg-white focus:outline-none focus:border-[#1A3A5C] transition-colors"
                  >
                    <option value="new_match">신규 매칭 알림</option>
                    <option value="profile_completion">프로필 완성 독려</option>
                    <option value="weekly_report">주간 활동 리포트</option>
                    <option value="custom">직접 작성</option>
                  </select>
                </div>

                {/* 제목 */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-[#0F0F0F] mb-2">제목</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={e => setEmailSubject(e.target.value)}
                    placeholder="이메일 제목"
                    className="w-full text-sm border border-[#E8E2DA] rounded-lg px-4 py-2.5 bg-white focus:outline-none focus:border-[#1A3A5C] transition-colors"
                  />
                </div>

                {/* 본문 */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-[#0F0F0F]">본문</label>
                    <span className="text-[11px] text-[#6B6B6B]">변수: {"{{company_name}}"}, {"{{platform_name}}"}</span>
                  </div>
                  <textarea
                    value={emailBody}
                    onChange={e => setEmailBody(e.target.value)}
                    rows={12}
                    placeholder="이메일 본문을 입력하세요..."
                    className="w-full text-sm border border-[#E8E2DA] rounded-lg px-4 py-3 bg-white focus:outline-none focus:border-[#1A3A5C] transition-colors resize-none font-mono"
                  />
                </div>

                {/* 액션 버튼 */}
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => setShowPreview(true)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-[#E8E2DA] rounded-lg text-[#0F0F0F] hover:bg-[#F8F7F5] transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    미리보기
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={isSending || !emailSubject.trim() || !emailBody.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg text-white transition-opacity hover:opacity-80 disabled:opacity-40"
                    style={{ background: NAVY }}
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    {isSending ? "발송 중..." : "발송"}
                  </button>
                </div>
              </div>
            )}

            {/* ── ⑧ 광고 관리 ────────────────────────────────────────── */}
            {activeTab === "ads" && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-[#0F0F0F]">광고 관리</h2>
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                    ⚠️ 승인 전 이미지 URL과 랜딩 URL을 반드시 육안으로 확인하세요
                  </p>
                </div>

                {/* 상태 필터 */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {[
                    { value: "all",     label: "전체" },
                    { value: "pending", label: "대기" },
                    { value: "approved",label: "승인" },
                    { value: "active",  label: "집행중" },
                    { value: "rejected",label: "거절" },
                    { value: "expired", label: "만료" },
                  ].map(f => (
                    <button
                      key={f.value}
                      onClick={() => setAdFilter(f.value)}
                      className="text-xs font-medium px-3 py-1.5 rounded-full border transition-colors"
                      style={adFilter === f.value
                        ? { background: NAVY, color: "white", borderColor: NAVY }
                        : { background: "white", color: "#6B6B6B", borderColor: "#E8E2DA" }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {!loadedTabs.has("ads")
                  ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#6B6B6B]" /></div>
                  : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          {["광고주 타입", "슬롯", "제목", "이미지", "랜딩URL", "집행기간", "단가", "결제", "노출/클릭", "CTR", "상태", "액션"].map(h => (
                            <th key={h} className={thCls + " pr-3"}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F3F4F6]">
                        {ads
                          .filter(a => adFilter === "all" || a.status === adFilter)
                          .map(ad => {
                            const ctr = ad.impressions_count > 0
                              ? ((ad.clicks_count / ad.impressions_count) * 100).toFixed(1)
                              : "—"
                            return (
                              <tr key={ad.id}>
                                <td className={tdCls + " pr-3"}>
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#6B6B6B]">
                                    {ad.advertiser_type}
                                  </span>
                                </td>
                                <td className={tdCls + " pr-3 text-xs text-[#6B6B6B]"}>
                                  {ad.beauty_ad_slots?.slot_name ?? ad.slot_id}
                                </td>
                                <td className={tdCls + " pr-3 max-w-[140px]"}>
                                  <p className="text-sm font-medium text-[#0F0F0F] truncate">{ad.title}</p>
                                  {ad.description && (
                                    <p className="text-xs text-[#6B6B6B] truncate">{ad.description}</p>
                                  )}
                                  <p className="text-[10px] text-[#6B6B6B] mt-0.5">
                                    신청: {fmtDate(ad.created_at)}
                                  </p>
                                </td>
                                <td className={tdCls + " pr-3"}>
                                  {ad.image_url ? (
                                    <a href={ad.image_url} target="_blank" rel="noopener noreferrer">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={ad.image_url} alt="" className="w-14 h-10 object-cover rounded border border-[#E8E2DA]" />
                                    </a>
                                  ) : <span className="text-xs text-[#D1D5DB]">없음</span>}
                                </td>
                                <td className={tdCls + " pr-3"}>
                                  <a
                                    href={ad.link_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs text-[#1A3A5C] hover:underline"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    확인
                                  </a>
                                </td>
                                <td className={tdCls + " pr-3 text-xs text-[#6B6B6B]"}>
                                  {ad.start_date ? fmtDate(ad.start_date) : "—"}
                                  {" ~ "}
                                  {ad.end_date ? fmtDate(ad.end_date) : "∞"}
                                </td>
                                <td className={tdCls + " pr-3 text-sm font-medium"}>
                                  ${ad.monthly_price}/mo
                                </td>
                                <td className={tdCls + " pr-3"}>
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ad.paid ? "bg-green-50 text-green-700" : "bg-[#FFFBEB] text-amber-700"}`}>
                                    {ad.paid ? "결제완료" : "미결제"}
                                  </span>
                                </td>
                                <td className={tdCls + " pr-3 text-xs text-[#6B6B6B]"}>
                                  {ad.impressions_count.toLocaleString()} / {ad.clicks_count.toLocaleString()}
                                </td>
                                <td className={tdCls + " pr-3 text-xs font-medium"}>
                                  {ctr}{ctr !== "—" ? "%" : ""}
                                </td>
                                <td className={tdCls + " pr-3"}>
                                  <StatusBadge value={ad.status} />
                                  {ad.rejection_reason && (
                                    <p className="text-[10px] text-red-600 mt-0.5 max-w-[100px] truncate" title={ad.rejection_reason}>
                                      {ad.rejection_reason}
                                    </p>
                                  )}
                                </td>
                                <td className={tdCls + " pr-3"}>
                                  {ad.status === "pending" && (
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => approveAd(ad.id)}
                                        disabled={adActioning === ad.id}
                                        className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white hover:opacity-80 transition-opacity disabled:opacity-40"
                                        style={{ background: "#10B981" }}
                                      >
                                        {adActioning === ad.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "승인"}
                                      </button>
                                      <button
                                        onClick={() => { setRejectTarget(ad.id); setRejectReason("") }}
                                        disabled={adActioning === ad.id}
                                        className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white hover:opacity-80 transition-opacity disabled:opacity-40"
                                        style={{ background: "#EF4444" }}
                                      >
                                        거절
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                    {ads.filter(a => adFilter === "all" || a.status === adFilter).length === 0 && (
                      <p className="text-sm text-[#6B6B6B] text-center py-10">광고 신청 내역이 없습니다.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── ⑨ DB 수집 파이프라인 ───────────────────────────────── */}
            {activeTab === "pipeline" && (
              <div className="p-6">
                <h2 className="text-base font-bold text-[#0F0F0F] mb-6">DB 수집 파이프라인</h2>

                {/* ── 아코디언 3개 ─────────────────────────────────────── */}
                <div className="space-y-3">

                  {/* ① 공급사 파이프라인 */}
                  <div className="border border-[#E8E2DA] rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSection("supplier")}
                      className="w-full flex items-center justify-between px-5 py-4 bg-[#F8F7F5] hover:bg-[#F0EDE8] transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold w-6 h-6 flex items-center justify-center rounded text-white flex-shrink-0" style={{ background: NAVY }}>①</span>
                        <span className="text-sm font-bold text-[#0F0F0F]">공급사 파이프라인</span>
                        {stagingStats && (
                          <span className="text-[11px] text-[#6B6B6B] border border-[#E8E2DA] bg-white px-2 py-0.5 rounded-full">
                            {stagingStats.total.toLocaleString()}건 적재
                          </span>
                        )}
                      </div>
                      <ChevronDown className={`w-4 h-4 text-[#6B6B6B] transition-transform flex-shrink-0 ${openSections.supplier ? "rotate-180" : ""}`} />
                    </button>

                    {openSections.supplier && (
                      <div className="px-5 py-5 border-t border-[#E8E2DA]">
                        {stagingStats && (
                          <div className="grid grid-cols-4 gap-3 mb-5">
                            {[
                              { label: "전체 스테이징",    value: stagingStats.total },
                              { label: "번역 완료",        value: stagingStats.translateCompleted, sub: "translate_status=completed" },
                              { label: "Apollo 매핑 완료", value: stagingStats.apolloMapped,       sub: "apollo_status=mapped" },
                              { label: "초대 발송 완료",   value: stagingStats.inviteSent,          sub: "invite_status=sent" },
                            ].map(({ label, value, sub }) => (
                              <div key={label} className="bg-[#F8F7F5] border border-[#E8E2DA] rounded-lg p-3">
                                <p className="text-xs text-[#6B6B6B] mb-0.5 leading-snug">{label}</p>
                                <p className="text-xl font-bold" style={{ color: NAVY }}>{value.toLocaleString()}</p>
                                {sub && <p className="text-[9px] text-[#6B6B6B] mt-0.5 font-mono">{sub}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => runPipeline("/api/kbeauty/pipeline/mfds", "mfds")}
                            disabled={pipelineRunning.mfds}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-white transition-opacity hover:opacity-80 disabled:opacity-50"
                            style={{ background: NAVY }}
                          >
                            {pipelineRunning.mfds ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                            식약처 API 조회 실행
                          </button>
                          <button disabled className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[#E8E2DA] text-[#9CA3AF] bg-[#F9FAFB] cursor-not-allowed">
                            <Play className="w-3.5 h-3.5" />GMP 업체 조회 실행
                            <span className="text-[9px] bg-[#F3F4F6] text-[#9CA3AF] rounded px-1 py-0.5">추후</span>
                          </button>
                          <button
                            onClick={() => runPipeline("/api/kbeauty/pipeline/translate", "translate")}
                            disabled={pipelineRunning.translate}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-white transition-opacity hover:opacity-80 disabled:opacity-50"
                            style={{ background: "#7C3AED" }}
                          >
                            {pipelineRunning.translate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                            영문 변환 실행
                          </button>
                          {["Apollo 매핑 실행", "초대 이메일 발송", "공급사 이관 실행"].map(label => (
                            <button key={label} disabled className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[#E8E2DA] text-[#9CA3AF] bg-[#F9FAFB] cursor-not-allowed">
                              <Play className="w-3.5 h-3.5" />{label}
                              <span className="text-[9px] bg-[#F3F4F6] text-[#9CA3AF] rounded px-1 py-0.5">추후</span>
                            </button>
                          ))}
                        </div>

                        {/* ── 스테이징 목록 ─────────────────────────── */}
                        <div className="mt-6">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-[#0F0F0F]">
                              {stagingStats
                                ? `스테이징 목록 (전체 ${stagingStats.total.toLocaleString()}건, 50개씩 표시)`
                                : "스테이징 목록 (전체 0건)"}
                            </h3>
                            <div className="flex gap-1.5">
                              {[
                                { key: "all",       label: "전체" },
                                { key: "translate", label: "번역 기준" },
                                { key: "apollo",    label: "Apollo 기준" },
                                { key: "invite",    label: "초대 기준" },
                              ].map(f => (
                                <button
                                  key={f.key}
                                  onClick={() => setStagingFilter(f.key)}
                                  className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                                  style={
                                    stagingFilter === f.key
                                      ? { background: NAVY, borderColor: NAVY, color: "white" }
                                      : { background: "white", borderColor: "#E8E2DA", color: "#6B6B6B" }
                                  }
                                >
                                  {f.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {!loadedTabs.has("pipeline")
                            ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#6B6B6B]" /></div>
                            : (() => {
                              const totalPages = Math.ceil((stagingStats?.total ?? 0) / 50)
                              const filtered = stagingItems.filter(row => {
                                if (stagingFilter === "translate") return row.translate_status !== "completed"
                                if (stagingFilter === "apollo")    return row.apollo_status !== "mapped"
                                if (stagingFilter === "invite")    return row.invite_status !== "sent"
                                return true
                              })
                              return (
                                <>
                                  <div className="overflow-x-auto">
                                    <table className="w-full">
                                      <thead>
                                        <tr>
                                          {["업체명 (한글)", "업체명 (영문)", "번역 상태", "Apollo 상태", "초대 상태", "등록일"].map(h => (
                                            <th key={h} className={thCls + " pr-4"}>{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-[#F3F4F6]">
                                        {filtered.map(row => (
                                          <tr key={row.id}>
                                            <td className={tdCls + " pr-4 font-medium max-w-[180px] truncate"}>{row.company_name_ko}</td>
                                            <td className={tdCls + " pr-4 text-[#6B6B6B] max-w-[180px] truncate"}>{row.company_name_en ?? "—"}</td>
                                            <td className={tdCls + " pr-4"}><StatusBadge value={row.translate_status} /></td>
                                            <td className={tdCls + " pr-4"}><StatusBadge value={row.apollo_status} /></td>
                                            <td className={tdCls + " pr-4"}><StatusBadge value={row.invite_status} /></td>
                                            <td className={tdCls + " text-[#6B6B6B] text-xs"}>{fmtDate(row.created_at)}</td>
                                          </tr>
                                        ))}
                                        {filtered.length === 0 && (
                                          <tr><td colSpan={6} className="text-center py-10 text-sm text-[#6B6B6B]">
                                            스테이징 데이터 없음
                                          </td></tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>

                                  {totalPages > 1 && (
                                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#F3F4F6]">
                                      <p className="text-xs text-[#6B6B6B]">{stagingPage} / {totalPages} 페이지</p>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => loadStagingPage(stagingPage - 1)}
                                          disabled={stagingPage <= 1}
                                          className="px-3 py-1.5 text-xs font-medium border border-[#E8E2DA] rounded-lg text-[#0F0F0F] hover:bg-[#F8F7F5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >이전</button>
                                        <button
                                          onClick={() => loadStagingPage(stagingPage + 1)}
                                          disabled={stagingPage >= totalPages}
                                          className="px-3 py-1.5 text-xs font-medium border border-[#E8E2DA] rounded-lg text-[#0F0F0F] hover:bg-[#F8F7F5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >다음</button>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )
                            })()
                          }
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ② 바이어 파이프라인 */}
                  <div className="border border-[#E8E2DA] rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSection("buyer")}
                      className="w-full flex items-center justify-between px-5 py-4 bg-[#F8F7F5] hover:bg-[#F0EDE8] transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold w-6 h-6 flex items-center justify-center rounded text-white flex-shrink-0" style={{ background: "#059669" }}>②</span>
                        <span className="text-sm font-bold text-[#0F0F0F]">바이어 파이프라인</span>
                        <span className="text-[11px] text-[#9CA3AF] border border-[#E8E2DA] bg-white px-2 py-0.5 rounded-full">준비중</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-[#6B6B6B] transition-transform flex-shrink-0 ${openSections.buyer ? "rotate-180" : ""}`} />
                    </button>

                    {openSections.buyer && (
                      <div className="px-5 py-5 border-t border-[#E8E2DA]">
                        <div className="grid grid-cols-2 gap-3 mb-5">
                          {[
                            { label: "전체 바이어 스테이징", value: 0 },
                            { label: "Apollo 매핑 완료",     value: 0 },
                          ].map(({ label, value }) => (
                            <div key={label} className="bg-[#F8F7F5] border border-[#E8E2DA] rounded-lg p-3">
                              <p className="text-xs text-[#6B6B6B] mb-0.5">{label}</p>
                              <p className="text-xl font-bold text-[#D1D5DB]">{value}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {["CSV 업로드", "Apollo 매핑 실행", "초대 이메일 발송"].map(label => (
                            <button key={label} disabled className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[#E8E2DA] text-[#9CA3AF] bg-[#F9FAFB] cursor-not-allowed">
                              <Play className="w-3.5 h-3.5" />{label}
                              <span className="text-[9px] bg-[#F3F4F6] text-[#9CA3AF] rounded px-1 py-0.5">추후</span>
                            </button>
                          ))}
                        </div>
                        <div className="mt-4 rounded-lg border border-dashed border-[#E8E2DA] py-8 text-center">
                          <p className="text-xs text-[#9CA3AF]">스테이징 목록 — 준비중입니다</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ③ 셀러 파이프라인 */}
                  <div className="border border-[#E8E2DA] rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSection("seller")}
                      className="w-full flex items-center justify-between px-5 py-4 bg-[#F8F7F5] hover:bg-[#F0EDE8] transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold w-6 h-6 flex items-center justify-center rounded text-white flex-shrink-0" style={{ background: "#7C3AED" }}>③</span>
                        <span className="text-sm font-bold text-[#0F0F0F]">셀러 파이프라인</span>
                        <span className="text-[11px] text-[#9CA3AF] border border-[#E8E2DA] bg-white px-2 py-0.5 rounded-full">준비중</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-[#6B6B6B] transition-transform flex-shrink-0 ${openSections.seller ? "rotate-180" : ""}`} />
                    </button>

                    {openSections.seller && (
                      <div className="px-5 py-5 border-t border-[#E8E2DA]">
                        <div className="grid grid-cols-2 gap-3 mb-5">
                          {[
                            { label: "전체 셀러 스테이징", value: 0 },
                            { label: "초대 발송 완료",     value: 0 },
                          ].map(({ label, value }) => (
                            <div key={label} className="bg-[#F8F7F5] border border-[#E8E2DA] rounded-lg p-3">
                              <p className="text-xs text-[#6B6B6B] mb-0.5">{label}</p>
                              <p className="text-xl font-bold text-[#D1D5DB]">{value}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {["EchoTik CSV 업로드", "Store Leads CSV 업로드", "초대 이메일 발송"].map(label => (
                            <button key={label} disabled className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[#E8E2DA] text-[#9CA3AF] bg-[#F9FAFB] cursor-not-allowed">
                              <Play className="w-3.5 h-3.5" />{label}
                              <span className="text-[9px] bg-[#F3F4F6] text-[#9CA3AF] rounded px-1 py-0.5">추후</span>
                            </button>
                          ))}
                        </div>
                        <div className="mt-4 rounded-lg border border-dashed border-[#E8E2DA] py-8 text-center">
                          <p className="text-xs text-[#9CA3AF]">스테이징 목록 — 준비중입니다</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>
      </main>

      {/* ── 광고 거절 모달 ────────────────────────────────────────── */}
      {rejectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setRejectTarget(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E2DA]">
              <h3 className="text-sm font-bold text-[#0F0F0F]">광고 거절 사유 입력</h3>
              <button onClick={() => setRejectTarget(null)} className="text-[#6B6B6B] hover:text-[#0F0F0F]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={4}
                placeholder="광고주에게 전달될 거절 사유를 입력하세요."
                className="w-full border border-[#E8E2DA] rounded-lg px-3 py-2 text-sm text-[#0F0F0F] focus:outline-none focus:ring-1 focus:ring-[#1A3A5C] resize-none"
              />
            </div>
            <div className="px-6 py-4 border-t border-[#E8E2DA] flex justify-end gap-2">
              <button
                onClick={() => setRejectTarget(null)}
                className="text-sm font-medium px-4 py-2 border border-[#E8E2DA] rounded-lg text-[#6B6B6B] hover:bg-[#F8F7F5]"
              >
                취소
              </button>
              <button
                onClick={() => rejectAd(rejectTarget)}
                disabled={adActioning === rejectTarget}
                className="text-sm font-semibold px-4 py-2 rounded-lg text-white hover:opacity-80 disabled:opacity-40"
                style={{ background: "#EF4444" }}
              >
                {adActioning === rejectTarget ? <Loader2 className="w-4 h-4 animate-spin" /> : "거절 확정"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 미리보기 모달 ─────────────────────────────────────────── */}
      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E2DA]">
              <h3 className="text-sm font-bold text-[#0F0F0F]">이메일 미리보기</h3>
              <button onClick={() => setShowPreview(false)} className="text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
              <p className="text-xs text-[#6B6B6B] mb-1">발신: UnfoldK Beauty &lt;support@unfoldk.com&gt;</p>
              <p className="text-xs text-[#6B6B6B] mb-4">
                대상: {EMAIL_GROUPS.find(g => g.value === emailGroup)?.label}
              </p>
              <div className="border border-[#E8E2DA] rounded-lg overflow-hidden">
                <div className="bg-[#F8F7F5] px-5 py-3 border-b border-[#E8E2DA]">
                  <p className="text-xs text-[#6B6B6B]">제목</p>
                  <p className="text-sm font-semibold text-[#0F0F0F] mt-0.5">
                    {emailSubject
                      .replace(/\{\{company_name\}\}/g, "(회사명)")
                      .replace(/\{\{platform_name\}\}/g, "UnfoldK Beauty")}
                  </p>
                </div>
                <div className="px-5 py-4">
                  <pre
                    className="text-sm text-[#0F0F0F] whitespace-pre-wrap font-sans leading-relaxed"
                    style={{ fontFamily: '"Pretendard Variable", Pretendard, -apple-system, sans-serif' }}
                  >
                    {emailBody
                      .replace(/\{\{company_name\}\}/g, "(회사명)")
                      .replace(/\{\{platform_name\}\}/g, "UnfoldK Beauty")}
                  </pre>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#E8E2DA] flex justify-end">
              <button
                onClick={() => setShowPreview(false)}
                className="text-sm font-medium px-4 py-2 border border-[#E8E2DA] rounded-lg text-[#6B6B6B] hover:bg-[#F8F7F5] transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
