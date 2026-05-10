"use client"

// /mypage/fan-events — 본인 팬 행사 신청 목록 + 신규 신청 폼
//
// 흐름:
//   1. 진입 가드 — 비로그인 → / 로
//   2. 상단: 내 신청 목록 (status 배지 + 승인 시 쿠폰 코드 + 거절 시 admin_note)
//   3. 하단: 신규 신청 폼 (제목·설명·날짜·장소·증빙 파일)
//      - 파일은 Supabase Storage `fan-event-proofs` 버킷에 클라이언트 직접 업로드
//      - 업로드 실패 시 proof_url null 로 신청 자체는 계속 진행 (spec)
//
// 사이드바·전체 레이아웃은 /mypage/page.tsx 패턴 그대로 재사용

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Home,
  Calendar,
  Music,
  Film,
  Languages,
  UtensilsCrossed,
  CreditCard,
  Settings,
  PartyPopper,
  Upload,
  Sparkles,
  ExternalLink,
  Pencil,
} from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { RedeemCouponModal } from "@/components/common/redeem-coupon-modal"
import { Toaster } from "@/components/ui/toaster"

const sidebarLinks = [
  { icon: Home, label: "Dashboard", href: "/mypage" },
  { icon: Calendar, label: "My Calendar", href: "/mypage/calendar" },
  { icon: Music, label: "My Artists", href: "/mypage/artists" },
  { icon: Film, label: "My Dramas", href: "/mypage/dramas" },
  { icon: Languages, label: "Learning Progress", href: "/mypage/learning" },
  { icon: UtensilsCrossed, label: "Saved Recipes", href: "/mypage/recipes" },
  { icon: PartyPopper, label: "My Fan Events", href: "/mypage/fan-events" },
  { icon: CreditCard, label: "Subscription", href: "/mypage/subscription" },
  { icon: Settings, label: "Settings", href: "/mypage/settings" },
]

const STORAGE_BUCKET = "fan-event-proofs"
const MAX_FILE_SIZE = 5 * 1024 * 1024                              // 5 MiB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"]

interface FanEventRequest {
  id: string
  title: string
  description: string | null
  event_date: string
  location: string | null
  proof_url: string | null
  status: "pending" | "approved" | "rejected"
  admin_note: string | null
  created_at: string
  reviewed_at: string | null
  coupon_code?: string | null
}

interface FormState {
  title: string
  description: string
  event_date: string                                                // YYYY-MM-DD
  location: string
  file: File | null
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  event_date: "",
  location: "",
  file: null,
}

// 파일명 안전화 — Storage 정책과 호환되는 ASCII slug.
// 모듈 스코프 — 신규 등록 / 편집 모달 양쪽에서 재사용.
function slugifyFilename(name: string): string {
  const dot = name.lastIndexOf(".")
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ""
  const safeBase =
    base
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 40)
      .replace(/^_+|_+$/g, "") || "file"
  return safeBase + ext.toLowerCase()
}

export default function MyFanEventsPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [userName, setUserName] = useState("")
  const [userInitial, setUserInitial] = useState("")
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [userPlan, setUserPlan] = useState("Free")
  const [requests, setRequests] = useState<FanEventRequest[]>([])
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [editingRequest, setEditingRequest] = useState<FanEventRequest | null>(null)

  // 진입 가드 + 프로필·신청 목록 로드
  useEffect(() => {
    let cancelled = false
    const supabase = createSupabaseBrowserClient()

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace("/")
        return
      }
      if (cancelled) return

      // 사이드바 프로필
      const meta = (user.user_metadata ?? {}) as { full_name?: string; avatar_url?: string }
      const fallbackName = user.email?.split("@")[0] ?? "User"
      const name = meta.full_name?.trim() || fallbackName
      setUserName(name)
      setUserInitial(name.charAt(0).toUpperCase() || "U")
      setUserAvatar(meta.avatar_url ?? null)

      const { data: profile } = await supabase
        .from("users")
        .select("plan_type")
        .eq("id", user.id)
        .single()
      if (!cancelled) {
        const pt = (profile as { plan_type?: string } | null)?.plan_type
        setUserPlan(pt === "monthly" || pt === "annual" ? "Hallyu Pass" : "Free")
      }

      setAuthChecked(true)
      await refetchRequests()
    }

    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const refetchRequests = async () => {
    setRequestsLoading(true)
    try {
      const res = await fetch("/api/mypage/fan-events")
      if (!res.ok) {
        setRequests([])
        return
      }
      const data = (await res.json()) as { requests: FanEventRequest[] }
      setRequests(data.requests ?? [])
    } catch (err) {
      console.error("[fan-events] 조회 실패:", err)
      setRequests([])
    } finally {
      setRequestsLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg("")
    const file = e.target.files?.[0] ?? null
    if (!file) {
      setForm((f) => ({ ...f, file: null }))
      return
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setErrorMsg("Only JPG, PNG, or PDF files are allowed.")
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg("File must be under 5 MB.")
      return
    }
    setForm((f) => ({ ...f, file }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMsg("")
    setSuccessMsg("")

    if (!form.title.trim() || !form.event_date) {
      setErrorMsg("Title and event date are required.")
      return
    }

    setIsSubmitting(true)
    let proofUrl: string | null = null

    // 1. 파일이 있으면 Supabase Storage 직접 업로드 — 실패해도 신청 자체는 계속
    if (form.file) {
      try {
        const supabase = createSupabaseBrowserClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          const safeName = slugifyFilename(form.file.name)
          const path = `${user.id}/${Date.now()}-${safeName}`
          const { error: uploadErr } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(path, form.file, {
              cacheControl: "3600",
              upsert: false,
              contentType: form.file.type,
            })
          if (uploadErr) {
            console.warn("[fan-events] 파일 업로드 실패:", uploadErr.message)
          } else {
            const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
            proofUrl = pub.publicUrl
          }
        }
      } catch (err) {
        console.warn("[fan-events] 파일 업로드 예외:", err)
      }
    }

    // 2. 신청 등록
    try {
      const res = await fetch("/api/mypage/fan-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          event_date: form.event_date,
          location: form.location.trim() || null,
          proof_url: proofUrl,
        }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: unknown }
        const errorText =
          typeof data.error === "string"
            ? data.error
            : "Failed to submit. Please try again."
        setErrorMsg(errorText)
        setIsSubmitting(false)
        return
      }

      setSuccessMsg("Your event was submitted for review!")
      setForm(EMPTY_FORM)
      // input[type=file] reset — DOM 직접 조작
      const fileInput = document.getElementById("fan-event-proof") as HTMLInputElement | null
      if (fileInput) fileInput.value = ""
      await refetchRequests()
    } catch (err) {
      console.error("[fan-events] 제출 예외:", err)
      setErrorMsg("Network error. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!authChecked) return null

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0d0d0f" }}>
      <Header />

      <div className="flex-1 flex max-w-7xl mx-auto w-full px-4 md:px-6 py-8 gap-8">
        {/* Left Sidebar — /mypage 패턴 그대로 */}
        <aside className="hidden md:flex flex-col w-[240px] flex-shrink-0">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt={userName}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
                  style={{ backgroundColor: "#FF4B6E" }}
                >
                  {userInitial || "U"}
                </div>
              )}
              <div>
                <p className="text-foreground font-medium">{userName || "—"}</p>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "rgba(255, 75, 110, 0.15)", color: "#FF4B6E" }}
                >
                  {userPlan}
                </span>
              </div>
            </div>
          </div>

          <nav className="flex flex-col gap-1">
            {sidebarLinks.map((link) => {
              const isActive = link.label === "My Fan Events"
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative ${
                    isActive
                      ? "bg-[#1a1a1a] text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a]/50"
                  }`}
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                      style={{ backgroundColor: "#FF4B6E" }}
                    />
                  )}
                  <link.icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{link.label}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">My Fan Events</h1>
            <p className="text-muted-foreground text-sm">
              Submit a fan event for review. Approved events earn you a complimentary Hallyu Pass.
            </p>
          </div>

          {/* Section 1: 내 신청 목록 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">My Submissions</h2>
            {requestsLoading ? (
              <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6 text-muted-foreground text-sm">
                Loading...
              </div>
            ) : requests.length === 0 ? (
              <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-8 text-center">
                <PartyPopper className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-foreground font-medium mb-1">No events submitted yet</p>
                <p className="text-muted-foreground text-sm">
                  Use the form below to submit your first fan event.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    onRedeemClick={() => setRedeemOpen(true)}
                    onEditClick={() => setEditingRequest(req)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Section 2: 신규 신청 폼 */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">Submit a New Event</h2>
            <form
              onSubmit={handleSubmit}
              className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6 space-y-4"
            >
              <div>
                <label className="text-muted-foreground text-xs mb-1 block">
                  Title <span style={{ color: "#FF4B6E" }}>*</span>
                </label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="aespa Bay Area Fanmeet"
                  className="h-11 bg-[#0d0d0f] border-[#2a2a2a] rounded-lg text-foreground placeholder:text-muted-foreground"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="text-muted-foreground text-xs mb-1 block">Description</label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What's the event about? Who's it for?"
                  className="bg-[#0d0d0f] border-[#2a2a2a] rounded-lg text-foreground placeholder:text-muted-foreground min-h-[80px] resize-y"
                  maxLength={2000}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-muted-foreground text-xs mb-1 block">
                    Event date <span style={{ color: "#FF4B6E" }}>*</span>
                  </label>
                  <Input
                    type="date"
                    value={form.event_date}
                    onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                    className="h-11 bg-[#0d0d0f] border-[#2a2a2a] rounded-lg text-foreground"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground text-xs mb-1 block">Location</label>
                  <Input
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="San Francisco, CA"
                    className="h-11 bg-[#0d0d0f] border-[#2a2a2a] rounded-lg text-foreground placeholder:text-muted-foreground"
                    maxLength={200}
                  />
                </div>
              </div>

              <div>
                <label className="text-muted-foreground text-xs mb-1 block">
                  Proof <span className="text-muted-foreground/70 ml-1">— JPG / PNG / PDF, max 5 MB · 3:4 portrait recommended for best display</span>
                </label>
                <label
                  htmlFor="fan-event-proof"
                  className="flex items-center gap-3 px-4 py-3 bg-[#0d0d0f] border border-dashed border-[#2a2a2a] rounded-lg cursor-pointer hover:border-[#FF4B6E]/50 transition-colors"
                >
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground truncate">
                    {form.file ? form.file.name : "Click to choose a file"}
                  </span>
                </label>
                <input
                  id="fan-event-proof"
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {errorMsg && (
                <p className="text-sm" style={{ color: "#FF4B6E" }}>
                  {errorMsg}
                </p>
              )}

              {successMsg && (
                <p className="text-sm" style={{ color: "#22c55e" }}>
                  {successMsg}
                </p>
              )}

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full md:w-auto h-11 px-8 rounded-full font-medium text-white"
                  style={{ backgroundColor: "#FF4B6E" }}
                >
                  {isSubmitting ? "Submitting..." : "Submit Event"}
                </Button>
              </div>
            </form>
          </section>
        </main>
      </div>

      {/* 쿠폰 등록 모달 — RequestCard 의 Redeem 버튼 트리거. 성공 시 토스트 + 모달 닫힘. */}
      <RedeemCouponModal open={redeemOpen} onOpenChange={setRedeemOpen} />
      {/* 편집 모달 — pending 상태 신청만 진입. 저장 성공 시 목록 재조회. */}
      <EditFanEventModal
        request={editingRequest}
        onClose={() => setEditingRequest(null)}
        onSaved={async () => {
          setEditingRequest(null)
          await refetchRequests()
        }}
      />
      {/* 토스트 컨테이너 — root layout 에 미마운트라 페이지 레벨에서 로컬 마운트 */}
      <Toaster />

      <FooterSection />
    </div>
  )
}

// 신청 1건 카드 — 상태별 배지·부가 영역. pending 일 때만 Edit 버튼 노출.
function RequestCard({
  req,
  onRedeemClick,
  onEditClick,
}: {
  req: FanEventRequest
  onRedeemClick: () => void
  onEditClick: () => void
}) {
  const eventDateLabel = new Date(req.event_date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-foreground font-semibold truncate">{req.title}</h3>
          <p className="text-muted-foreground text-sm mt-0.5">
            {eventDateLabel}
            {req.location && <> · {req.location}</>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={req.status} />
          {req.status === "pending" && (
            <button
              type="button"
              onClick={onEditClick}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 px-2 py-1 rounded-full border border-border/50 hover:border-border"
              aria-label="Edit submission"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          )}
        </div>
      </div>

      {req.description && (
        <p className="text-muted-foreground text-sm mt-2 mb-3 leading-relaxed">{req.description}</p>
      )}

      {/* 승인 시 — 쿠폰 코드 + redeem 링크 */}
      {req.status === "approved" && (
        <div
          className="mt-3 rounded-lg p-3 flex items-center justify-between gap-3"
          style={{ backgroundColor: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34, 197, 94, 0.2)" }}
        >
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "#22c55e" }}>
              Hallyu Pass coupon
            </div>
            {req.coupon_code ? (
              <div className="font-mono text-foreground font-semibold tracking-wider truncate">
                {req.coupon_code}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">Check the email we sent you</div>
            )}
          </div>
          <button
            type="button"
            onClick={onRedeemClick}
            className="flex-shrink-0 text-sm font-medium hover:underline flex items-center gap-1"
            style={{ color: "#22c55e" }}
          >
            <Sparkles className="w-4 h-4" /> Redeem
          </button>
        </div>
      )}

      {/* 거절 시 — admin_note */}
      {req.status === "rejected" && req.admin_note && (
        <div
          className="mt-3 rounded-lg p-3"
          style={{ backgroundColor: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)" }}
        >
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "#ef4444" }}>
            Reason
          </div>
          <p className="text-muted-foreground text-sm">{req.admin_note}</p>
        </div>
      )}

      {/* 증빙 파일 링크 */}
      {req.proof_url && (
        <a
          href={req.proof_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs mt-3 hover:underline"
          style={{ color: "#FF4B6E" }}
        >
          View proof <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  )
}

// 편집 모달 — pending 신청 수정. 기존 inline 등록 폼과 동일한 필드 구조.
// 파일 업로드 정책: 새 파일을 선택하면 Storage 직접 업로드 → proof_url 교체.
//                 미선택이면 기존 proof_url 유지 (PATCH body 에 키 자체 omit).
function EditFanEventModal({
  request,
  onClose,
  onSaved,
}: {
  request: FanEventRequest | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errorMsg, setErrorMsg] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // request 변경(모달 오픈) 시 폼 pre-fill
  useEffect(() => {
    if (!request) return
    setForm({
      title: request.title,
      description: request.description ?? "",
      event_date: request.event_date.slice(0, 10), // YYYY-MM-DD
      location: request.location ?? "",
      file: null, // 새 파일은 사용자가 다시 선택할 때만 업로드
    })
    setErrorMsg("")
  }, [request])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg("")
    const file = e.target.files?.[0] ?? null
    if (!file) {
      setForm((f) => ({ ...f, file: null }))
      return
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setErrorMsg("Only JPG, PNG, or PDF files are allowed.")
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg("File must be under 5 MB.")
      return
    }
    setForm((f) => ({ ...f, file }))
  }

  const handleSave = async () => {
    if (!request) return
    setErrorMsg("")
    if (!form.title.trim() || !form.event_date) {
      setErrorMsg("Title and event date are required.")
      return
    }

    setIsSubmitting(true)

    // 새 파일이 있을 때만 Storage 업로드 → proof_url 교체. 실패 시 PATCH 자체 중단.
    let newProofUrl: string | undefined
    if (form.file) {
      try {
        const supabase = createSupabaseBrowserClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          const safeName = slugifyFilename(form.file.name)
          const path = `${user.id}/${Date.now()}-${safeName}`
          const { error: uploadErr } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(path, form.file, {
              cacheControl: "3600",
              upsert: false,
              contentType: form.file.type,
            })
          if (uploadErr) {
            console.warn("[fan-events/edit] 업로드 실패:", uploadErr.message)
            setErrorMsg("File upload failed. Please try again.")
            setIsSubmitting(false)
            return
          }
          const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
          newProofUrl = pub.publicUrl
        }
      } catch (err) {
        console.warn("[fan-events/edit] 업로드 예외:", err)
        setErrorMsg("File upload failed. Please try again.")
        setIsSubmitting(false)
        return
      }
    }

    // PATCH body — proof_url 은 새 파일 있을 때만 포함 (기존 값 보존)
    const body: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      event_date: form.event_date,
      location: form.location.trim() || null,
    }
    if (newProofUrl !== undefined) {
      body.proof_url = newProofUrl
    }

    try {
      const res = await fetch(`/api/mypage/fan-events/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: unknown }
        const errorText =
          typeof data.error === "string"
            ? data.error
            : "Failed to update. Please try again."
        setErrorMsg(errorText)
        setIsSubmitting(false)
        return
      }
      // 성공
      setIsSubmitting(false)
      onSaved()
    } catch (err) {
      console.error("[fan-events/edit] PATCH 예외:", err)
      setErrorMsg("Network error. Please try again.")
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={!!request}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="bg-[#141418] border-[#2a2a2a] text-foreground max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-muted-foreground text-xs mb-1 block">
              Title <span style={{ color: "#FF4B6E" }}>*</span>
            </label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="h-11 bg-[#0d0d0f] border-[#2a2a2a] rounded-lg text-foreground placeholder:text-muted-foreground"
              maxLength={200}
            />
          </div>

          <div>
            <label className="text-muted-foreground text-xs mb-1 block">Description</label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="bg-[#0d0d0f] border-[#2a2a2a] rounded-lg text-foreground placeholder:text-muted-foreground min-h-[80px] resize-y"
              maxLength={2000}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-muted-foreground text-xs mb-1 block">
                Event date <span style={{ color: "#FF4B6E" }}>*</span>
              </label>
              <Input
                type="date"
                value={form.event_date}
                onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                className="h-11 bg-[#0d0d0f] border-[#2a2a2a] rounded-lg text-foreground"
              />
            </div>
            <div>
              <label className="text-muted-foreground text-xs mb-1 block">Location</label>
              <Input
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className="h-11 bg-[#0d0d0f] border-[#2a2a2a] rounded-lg text-foreground placeholder:text-muted-foreground"
                maxLength={200}
              />
            </div>
          </div>

          <div>
            <label className="text-muted-foreground text-xs mb-1 block">
              Proof <span className="text-muted-foreground/70 ml-1">— JPG / PNG / PDF, max 5 MB · 3:4 portrait recommended for best display</span>
            </label>
            {/* 기존 증빙 파일 — 새 파일 미선택 시에만 노출 */}
            {request?.proof_url && !form.file && (
              <a
                href={request.proof_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs mb-2 hover:underline"
                style={{ color: "#FF4B6E" }}
              >
                Current proof <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <label
              htmlFor="fan-event-edit-proof"
              className="flex items-center gap-3 px-4 py-3 bg-[#0d0d0f] border border-dashed border-[#2a2a2a] rounded-lg cursor-pointer hover:border-[#FF4B6E]/50 transition-colors"
            >
              <Upload className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground truncate">
                {form.file
                  ? form.file.name
                  : request?.proof_url
                  ? "Choose a new file (replaces current)"
                  : "Click to choose a file"}
              </span>
            </label>
            <input
              id="fan-event-edit-proof"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {errorMsg && (
            <p className="text-sm" style={{ color: "#FF4B6E" }}>
              {errorMsg}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSubmitting}
            className="rounded-full"
            style={{ backgroundColor: "#FF4B6E", color: "white" }}
          >
            {isSubmitting ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StatusBadge({ status }: { status: FanEventRequest["status"] }) {
  const config = {
    pending: {
      label: "Under Review",
      bg: "rgba(234, 179, 8, 0.15)",
      color: "#eab308",
    },
    approved: {
      label: "Approved",
      bg: "rgba(34, 197, 94, 0.15)",
      color: "#22c55e",
    },
    rejected: {
      label: "Not Approved",
      bg: "rgba(239, 68, 68, 0.15)",
      color: "#ef4444",
    },
  }[status]

  return (
    <span
      className="text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0"
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      {config.label}
    </span>
  )
}
