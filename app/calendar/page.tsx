"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronLeft, ChevronRight, Calendar, X, Lock, Plus, Ticket, Play, RefreshCw } from "lucide-react"
import Link from "next/link"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { hasProAccess } from "@/lib/auth/plan"
import { ReportButton } from "@/components/common/report-button"
import { getEventTypeColor } from "@/lib/calendar/event-type-colors"
import { StartModal } from "@/components/start-modal"
import { AuthGate } from "@/components/auth-gate"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"

type EventType = "K-pop" | "K-drama" | "Concert" | "Fan Meet"

interface CalendarEvent {
  id: string
  title: string
  date: number
  type: EventType
  time?: string
  artist?: string
  description?: string                   // Claude 가 생성한 한 줄 설명 (TMDB·YouTube·manual). Ticketmaster 는 0037 이후 null.
  isPremium?: boolean
  thumbnailUrl?: string                  // DB hallyu_calendar_events.thumbnail_url
  sourceApi?: string                     // 'ticketmaster' | 'tmdb' | 'youtube' | 'lastfm' — Featured 우선순위
  url?: string                           // 외부 티켓 예매 페이지 (Ticketmaster). sourceApi='ticketmaster' 일 때만 의미.
  // 공연장 분리 컬럼 (Ticketmaster 만 채워짐, 0037 마이그레이션).
  venueName?: string
  venueCity?: string
  venueCountryCode?: string              // ISO 3166-1 alpha-2 (US, GB, JP, BR ...)
  createdAt?: string                     // ISO string — Featured 정렬 키 (등록순)
  contactEmail?: string                  // fan_event_request 행사 주최자 연락처 이메일
  registrationLink?: string              // fan_event_request 행사 신청 URL (Google Form 등)
}

// ISO 3166-1 alpha-2 → flag emoji (regional indicator symbols).
// "US" → 🇺🇸 / "GB" → 🇬🇧 / "JP" → 🇯🇵.
// 잘못된 코드 길이는 빈 문자열 반환 — UI 가 자연스럽게 fallback.
function countryFlag(code: string | undefined): string {
  if (!code || code.length !== 2) return ""
  const A = 0x1f1e6 - "A".charCodeAt(0) // regional indicator 'A' offset
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => A + c.charCodeAt(0))
  )
}

// 권역 필터 칩. ONLINE = venueCountryCode 가 비어있는 이벤트 (드라마/컴백/온라인 콘서트).
// countries 배열 inclusion 으로 매칭. 신규 국가는 해당 권역 배열에 추가만 하면 됨.
// 권역 분류는 ISO 3166-1 alpha-2 기준 — UK 는 GB, 일본은 JP, 한국은 KR.
const REGION_FILTERS = [
  { code: "ALL",         label: "All",         flag: "",   countries: [] as readonly string[] },
  { code: "AMERICAS",    label: "Americas",    flag: "🌎", countries: ["US", "CA", "BR", "MX", "AR", "CL", "CO", "PE"] as readonly string[] },
  { code: "EUROPE",      label: "Europe",      flag: "🌍", countries: ["GB", "FR", "DE", "IE", "NL", "IT", "ES", "DK", "BE", "NO", "CZ", "PL", "PT", "SE", "CH", "AT", "FI"] as readonly string[] },
  { code: "ASIA",        label: "Asia",        flag: "🌏", countries: ["KR", "JP", "TH", "SG", "MY", "PH", "VN", "ID", "TW", "HK", "CN", "IN"] as readonly string[] },
  { code: "OCEANIA",     label: "Oceania",     flag: "🦘", countries: ["AU", "NZ"] as readonly string[] },
  { code: "MIDDLE_EAST", label: "Middle East", flag: "🕌", countries: ["AE", "SA", "QA", "KW", "BH", "OM", "JO", "IL"] as readonly string[] },
  { code: "ONLINE",      label: "Online",      flag: "🌐", countries: [] as readonly string[] },
] as const
type RegionCode = (typeof REGION_FILTERS)[number]["code"]

// 단일 이벤트가 권역에 매칭되는지 — 필터 로직과 visible chip 계산에서 공용.
function eventMatchesRegion(e: CalendarEvent, region: RegionCode): boolean {
  if (region === "ALL") return true
  if (region === "ONLINE") return !e.venueCountryCode
  const cfg = REGION_FILTERS.find((r) => r.code === region)
  return !!cfg && !!e.venueCountryCode && cfg.countries.includes(e.venueCountryCode)
}

// Ticketmaster 이벤트에서만 Get Tickets 버튼 노출 — 다른 소스는 url 없거나 의미 다름.
function shouldShowGetTickets(event: CalendarEvent): boolean {
  return event.sourceApi === "ticketmaster" && !!event.url
}

// TMDB 드라마 이벤트 + US watch providers 있을 때만 Watch Now 버튼.
// url 컬럼을 Ticketmaster 와 공유하지만 sourceApi 가드로 격리 → 두 조건이 동시에 참이 될 수 없음.
function shouldShowWatchNow(event: CalendarEvent): boolean {
  return event.sourceApi === "tmdb" && !!event.url
}

// 유저 등록 fan_event_request 행사의 신청 버튼 — registration_link 우선, 없으면 contact_email.
function shouldShowApplyButton(event: CalendarEvent): boolean {
  return event.sourceApi === "fan_event_request" && (!!event.registrationLink || !!event.contactEmail)
}

// 이벤트 1차 CTA 가 외부 링크인지 — Add to GCal 강등 판정용.
function hasExternalPrimaryCta(event: CalendarEvent): boolean {
  return shouldShowGetTickets(event) || shouldShowWatchNow(event) || shouldShowApplyButton(event)
}

const tabs = ["All", "K-pop", "K-drama", "Concert", "Fan Meet"] as const
const lockedTabs = ["Concert", "Fan Meet"]

// Google Calendar TEMPLATE URL 빌더 — EventDetailModal / UpcomingAccordionItem 양쪽에서 사용.
// OAuth 없이 사용자 GCal 에 종일 이벤트 등록. event.time 라벨은 파싱 위험으로 종일 포맷.
function buildGoogleCalendarUrl(event: CalendarEvent, viewDate: Date): string {
  const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), event.date)
  const end = new Date(viewDate.getFullYear(), viewDate.getMonth(), event.date + 1)
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    ...(event.description ? { details: event.description } : {}),
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

// Event Detail Modal Component
function EventDetailModal({
  event,
  onClose,
  viewDate,
  isPro,
  onUpgradeNeeded,
  kpopArtistId,
}: {
  event: CalendarEvent | null
  onClose: () => void
  viewDate: Date
  isPro: boolean
  onUpgradeNeeded: () => void
  kpopArtistId?: string
}) {
  const router = useRouter()
  const [reminders, setReminders] = useState({
    d7: false,
    d1: true,
    dayOf: true,
  })
  const [authChecked, setAuthChecked] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Share Event 피드백 — "Copied!" 또는 "Copy failed" 2초간 표시 후 원복
  const [icalCopyStatus, setIcalCopyStatus] = useState<"idle" | "copied" | "failed">("idle")
  const icalResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 이벤트 설명 — DB 값 또는 Claude 자동 생성
  const [modalDescription, setModalDescription] = useState<string | null>(null)
  const [descLoading, setDescLoading] = useState(false)
  // 세션 내 설명 캐시 — 동일 이벤트 재클릭 시 API 재호출 방지 (페이지 새로고침 시 초기화)
  const descCacheRef = useRef<Map<string, string>>(new Map())

  // 모달 열릴 때 (event 변경) — 로그인 여부 확인 + 서버에서 리마인더 설정 로드
  useEffect(() => {
    if (!event) return
    let cancelled = false

    const load = async () => {
      setAuthChecked(false)
      const supabase = createSupabaseBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return

      setIsLoggedIn(!!user)
      setAuthChecked(true)

      if (!user) return // 비로그인: 디폴트 토글 그대로

      try {
        const res = await fetch(`/api/calendar/reminders?event_id=${event.id}`)
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) {
            setReminders({
              d7: !!data.remind_d7,
              d1: !!data.remind_d1,
              dayOf: !!data.remind_dayof,
            })
          }
        }
      } catch (err) {
        console.error("[reminders] load 실패:", err)
      }
    }

    load()
    return () => {
      cancelled = true
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (icalResetTimerRef.current) clearTimeout(icalResetTimerRef.current)
    }
  }, [event])

  // 이벤트 설명 로드 — 우선순위: ① event.description(DB) → ② 세션 캐시 → ③ API 호출(Claude or DB)
  useEffect(() => {
    if (!event) {
      setModalDescription(null)
      setDescLoading(false)
      return
    }
    // ① 이벤트 객체에 이미 description 있음 (이벤트 목록 fetch 시 DB에서 가져온 값)
    if (event.description) {
      setModalDescription(event.description)
      return
    }
    // ② 세션 내 캐시 히트 — 이전에 생성한 설명을 재사용 (API 호출 없음)
    const cached = descCacheRef.current.get(event.id)
    if (cached) {
      setModalDescription(cached)
      return
    }
    // ③ DB에 없는 이벤트 — API 호출 (API 내부에서 DB 재확인 → 없으면 Claude 생성 → DB 저장)
    let cancelled = false
    setDescLoading(true)
    setModalDescription(null)

    const eventDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), event.date)
      .toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    const params = new URLSearchParams({ event_id: event.id, title: event.title, type: event.type, date: eventDate })
    if (event.artist) params.set("artist", event.artist)

    fetch(`/api/calendar/description?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) {
          const desc = data?.description ?? null
          // 생성된 설명을 세션 캐시에도 저장 — 같은 세션 내 재클릭 시 API 미호출
          if (desc) descCacheRef.current.set(event.id, desc)
          setModalDescription(desc)
        }
      })
      .catch(() => { if (!cancelled) setModalDescription(null) })
      .finally(() => { if (!cancelled) setDescLoading(false) })

    return () => { cancelled = true }
  }, [event, viewDate])

  // Add to Google Calendar — 모듈 레벨 buildGoogleCalendarUrl 헬퍼 재사용
  const handleAddToGoogleCalendar = () => {
    if (!event) return
    window.open(buildGoogleCalendarUrl(event, viewDate), "_blank", "noopener,noreferrer")
  }

  // Share Event 버튼 — 이벤트 딥링크 클립보드 복사
  const handleCopyIcal = async () => {
    if (!event) return
    const url = `https://www.unfoldk.com/calendar?event=${event.id}`
    try {
      await navigator.clipboard.writeText(url)
      setIcalCopyStatus("copied")
      toast("Event link copied!")
    } catch (err) {
      console.error("[calendar] 링크 복사 실패:", err)
      setIcalCopyStatus("failed")
    }
    if (icalResetTimerRef.current) clearTimeout(icalResetTimerRef.current)
    icalResetTimerRef.current = setTimeout(() => setIcalCopyStatus("idle"), 2000)
  }

  // 토글 변경 시 300ms debounce 후 서버 저장
  const scheduleSave = (next: typeof reminders) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      if (!event) return
      try {
        await fetch("/api/calendar/reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_id: event.id,
            remind_d7: next.d7,
            remind_d1: next.d1,
            remind_dayof: next.dayOf,
          }),
        })
      } catch (err) {
        console.error("[reminders] save 실패:", err)
      }
    }, 300)
  }

  if (!event) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const toggleReminder = (key: keyof typeof reminders) => {
    if (!isPro) { onUpgradeNeeded(); return }
    // 비로그인 사용자가 토글 시 → 로그인 페이지로 (원래 경로 보존)
    if (authChecked && !isLoggedIn) {
      router.push(`/login?redirect=/calendar`)
      return
    }
    const next = { ...reminders, [key]: !reminders[key] }
    setReminders(next)
    scheduleSave(next)
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
      onClick={handleOverlayClick}
    >
      <div 
        className="w-full max-w-md bg-[#1a1a1a] rounded-2xl p-6 relative animate-in zoom-in-95 duration-150"
        style={{ borderRadius: "16px" }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Event Type Badge */}
        <div className="mb-4">
          <span
            className="inline-block px-3 py-1 text-xs font-medium text-white rounded-full"
            style={{ backgroundColor: getEventTypeColor(event.type) }}
          >
            {event.type}
          </span>
        </div>

        {/* Event Name */}
        <h2 className="text-2xl font-bold text-white mb-3">
          {event.title}
        </h2>

        {/* Description — DB 저장 값 또는 Claude Haiku 자동 생성 2문장 */}
        {descLoading ? (
          <div className="mb-4 space-y-1.5">
            <div className="h-3.5 bg-[#2a2a2a] rounded animate-pulse w-full" />
            <div className="h-3.5 bg-[#2a2a2a] rounded animate-pulse w-4/5" />
          </div>
        ) : modalDescription ? (
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
            {modalDescription}
          </p>
        ) : null}

        {/* Date & Time Row */}
        <div className="flex items-center gap-4 text-muted-foreground mb-3">
          <span className="flex items-center gap-2">
            <span>📅</span>
            <span>
              {viewDate.toLocaleString("en-US", { month: "long" })} {event.date}, {viewDate.getFullYear()}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <span>🕗</span>
            <span>{event.time || "TBA"}</span>
          </span>
        </div>

        {/* Artist/Drama Info Row */}
        <div className="flex items-center gap-3 mb-4">
          {/* Placeholder Avatar */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
            style={{ backgroundColor: "#FF4B6E" }}
          >
            {event.artist?.charAt(0) || "?"}
          </div>
          <span className="text-foreground font-medium">{event.artist || "Unknown"}</span>
        </div>

        {/* Venue 정보 — Ticketmaster 콘서트·팬미팅에만. venue_name 기준 노출 분기. */}
        {event.venueName && (
          <p className="text-muted-foreground text-sm leading-relaxed mb-2 flex items-start gap-1.5">
            <span aria-hidden>📍</span>
            <span>
              {[event.venueName, event.venueCity].filter(Boolean).join(" · ")}
              {event.venueCountryCode && (
                <span className="ml-2">
                  {countryFlag(event.venueCountryCode)} {event.venueCountryCode}
                </span>
              )}
            </span>
          </p>
        )}

        {/* Divider */}
        <div className="border-t border-border/30 mb-6" />

        {/* Action Buttons */}
        <div className="space-y-3 mb-6">
          {/* Get Tickets — Ticketmaster 이벤트 + url 있을 때만. 외부 티켓 페이지 새 탭. */}
          {shouldShowGetTickets(event) && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button
                className="w-full py-3 rounded-xl font-medium text-white"
                style={{ backgroundColor: "#FF4B6E" }}
              >
                <Ticket className="w-4 h-4 mr-2" />
                Get Tickets
              </Button>
            </a>
          )}
          {/* Watch Now — TMDB 드라마 + US OTT provider 있을 때만. TMDB 가 region 기반 리다이렉트. */}
          {shouldShowWatchNow(event) && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button
                className="w-full py-3 rounded-xl font-medium text-white"
                style={{ backgroundColor: "#FF4B6E" }}
              >
                <Play className="w-4 h-4 mr-2" />
                Watch Now
              </Button>
            </a>
          )}
          {/* Apply / Contact — fan_event_request 행사. registration_link 우선, 없으면 mailto: */}
          {shouldShowApplyButton(event) && (
            <a
              href={event.registrationLink ?? `mailto:${event.contactEmail}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button
                className="w-full py-3 rounded-xl font-medium text-white"
                style={{ backgroundColor: "#FF4B6E" }}
              >
                <Ticket className="w-4 h-4 mr-2" />
                {event.registrationLink ? "Register Now" : "Contact Organizer"}
              </Button>
            </a>
          )}
          <Button
            variant={hasExternalPrimaryCta(event) ? "outline" : "default"}
            className={`w-full py-3 rounded-xl font-medium ${
              hasExternalPrimaryCta(event)
                ? "border-border/50 hover:bg-secondary/50"
                : "text-white"
            }`}
            style={
              hasExternalPrimaryCta(event)
                ? undefined
                : { backgroundColor: "#FF4B6E" }
            }
            onClick={handleAddToGoogleCalendar}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Add to Google Calendar
          </Button>
          <Button
            variant="outline"
            className="w-full py-3 rounded-xl font-medium border-border/50 hover:bg-secondary/50"
            onClick={handleCopyIcal}
          >
            {icalCopyStatus === "copied"
              ? "Copied!"
              : icalCopyStatus === "failed"
              ? "Copy failed"
              : "Share Event"}
          </Button>
        </div>

        {/* Reminder Toggles */}
        <div className="text-center">
          <p className="text-muted-foreground text-sm mb-3 flex items-center justify-center gap-1">
            Set reminder:
            {!isPro && <Lock className="w-3 h-3" />}
          </p>
          <div className="flex items-center justify-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-muted-foreground">D-7</span>
              <button
                onClick={() => toggleReminder("d7")}
                title={!isPro ? "Coming with Hallyu Pass" : undefined}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  reminders.d7 ? "bg-primary" : "bg-[#333]"
                }`}
                style={reminders.d7 ? { backgroundColor: "#FF4B6E" } : {}}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    reminders.d7 ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-muted-foreground">D-1</span>
              <button
                onClick={() => toggleReminder("d1")}
                title={!isPro ? "Coming with Hallyu Pass" : undefined}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  reminders.d1 ? "bg-primary" : "bg-[#333]"
                }`}
                style={reminders.d1 ? { backgroundColor: "#FF4B6E" } : {}}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    reminders.d1 ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-muted-foreground">Day of</span>
              <button
                onClick={() => toggleReminder("dayOf")}
                title={!isPro ? "Coming with Hallyu Pass" : undefined}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  reminders.dayOf ? "bg-primary" : "bg-[#333]"
                }`}
                style={reminders.dayOf ? { backgroundColor: "#FF4B6E" } : {}}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    reminders.dayOf ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </label>
          </div>
        </div>

        {/* Report + Artist Stats 링크 */}
        <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between">
          {kpopArtistId ? (
            <Link
              href={`/kpop/${kpopArtistId}`}
              className="text-sm font-medium hover:underline"
              style={{ color: "#FF4B6E" }}
              onClick={onClose}
            >
              View artist stats →
            </Link>
          ) : (
            <span />
          )}
          <ReportButton contentType="event" contentId={event.id} />
        </div>
      </div>
    </div>
  )
}

// Upgrade Modal Component
function UpgradeModal({
  isOpen,
  onClose,
  lockedFeature,
  isLoggedIn = false,
}: {
  isOpen: boolean
  onClose: () => void
  lockedFeature: string | null
  isLoggedIn?: boolean
}) {
  if (!isOpen) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
      onClick={handleOverlayClick}
    >
      <div 
        className="w-full max-w-sm bg-[#1a1a1a] rounded-2xl p-6 relative animate-in zoom-in-95 duration-150 text-center"
        style={{ borderRadius: "16px" }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Lock Icon */}
        <div 
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
        >
          <Lock className="w-8 h-8" style={{ color: "#FF4B6E" }} />
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-white mb-2">
          {lockedFeature} — Coming with Hallyu Pass
        </h2>

        {/* Description */}
        <p className="text-muted-foreground text-sm mb-6">
          {lockedFeature} events arrive with Hallyu Pass at launch. Sign up now to be first in line.
        </p>

        {/* Features List */}
        <div className="text-left bg-[#141416] rounded-xl p-4 mb-6">
          <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide">Included in Hallyu Pass:</p>
          <ul className="space-y-2 text-sm text-foreground">
            <li className="flex items-center gap-2">
              <span style={{ color: "#FF4B6E" }}>✓</span> All event categories
            </li>
            <li className="flex items-center gap-2">
              <span style={{ color: "#FF4B6E" }}>✓</span> Unlimited artist tracking
            </li>
            <li className="flex items-center gap-2">
              <span style={{ color: "#FF4B6E" }}>✓</span> Priority notifications
            </li>
            <li className="flex items-center gap-2">
              <span style={{ color: "#FF4B6E" }}>✓</span> Exclusive content access
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link href={isLoggedIn ? "/pricing" : "/signup"} className="block">
            <Button
              className="w-full py-3 rounded-xl font-medium text-white"
              style={{ backgroundColor: "#FF4B6E" }}
            >
              {isLoggedIn ? "Upgrade to Hallyu Pass" : "Notify me when Hallyu Pass launches"}
            </Button>
          </Link>
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}

// Upcoming 리스트 아코디언 아이템 — 클릭 시 인라인 확장.
// 표시: AI 설명 / Add to Google Calendar / Reminder 토글 / Report.
// 모달은 Featured 카드 + 캘린더 그리드 클릭에서만 유지 (이쪽은 동결).
function UpcomingAccordionItem({
  event,
  index,
  monthShort,
  viewDate,
  isPro,
  isPast,
  isLoggedIn,
  isExpanded,
  onToggle,
  onLoginNeeded,
  onUpgradeNeeded,
  kpopArtistId,
}: {
  event: CalendarEvent
  index: number
  monthShort: string
  viewDate: Date
  isPro: boolean
  isPast: boolean
  isLoggedIn: boolean
  isExpanded: boolean
  onToggle: () => void
  onLoginNeeded: () => void
  onUpgradeNeeded: () => void
  kpopArtistId?: string
}) {
  // isBlurred 제거 — 비로그인 접근 정책 전환으로 AuthGate 래퍼가 클릭 차단 담당 (2026-06-01).
  const isBlurred = false

  // 리마인더 — 확장 시 처음 1회 fetch, 토글 시 300ms debounce save
  const [reminders, setReminders] = useState({ d7: false, d1: true, dayOf: true })
  const [remindersLoaded, setRemindersLoaded] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isExpanded || !isLoggedIn || remindersLoaded) return
    let cancelled = false
    fetch(`/api/calendar/reminders?event_id=${event.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        if (data) {
          setReminders({
            d7: !!data.remind_d7,
            d1: !!data.remind_d1,
            dayOf: !!data.remind_dayof,
          })
        }
        setRemindersLoaded(true)
      })
      .catch((err) => {
        console.error("[reminder/accordion] load 실패:", err)
        if (!cancelled) setRemindersLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [isExpanded, isLoggedIn, remindersLoaded, event.id])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const scheduleSave = (next: typeof reminders) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        await fetch("/api/calendar/reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_id: event.id,
            remind_d7: next.d7,
            remind_d1: next.d1,
            remind_dayof: next.dayOf,
          }),
        })
      } catch (err) {
        console.error("[reminder/accordion] save 실패:", err)
      }
    }, 300)
  }

  const toggleReminder = (key: keyof typeof reminders) => {
    if (!isLoggedIn) { onLoginNeeded(); return }
    if (!isPro) { onUpgradeNeeded(); return }
    const next = { ...reminders, [key]: !reminders[key] }
    setReminders(next)
    scheduleSave(next)
  }

  const handleAddToGCal = () => {
    if (!isLoggedIn) {
      onLoginNeeded()
      return
    }
    window.open(buildGoogleCalendarUrl(event, viewDate), "_blank", "noopener,noreferrer")
  }

  return (
    <div
      className={`bg-[#1a1a1a] border border-border/30 rounded-xl transition-colors hover:border-primary/50 ${isPast ? "opacity-40" : ""}`}
    >
      {/* Header row — 클릭 시 아코디언 토글 */}
      <div
        onClick={() => onToggle()}
        className="flex items-center justify-between p-4 cursor-pointer"
      >
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-xl flex flex-col items-center justify-center text-white"
            style={{ backgroundColor: getEventTypeColor(event.type) }}
          >
            <span className="text-xs font-medium">{monthShort}</span>
            <span className="text-xl font-bold">{event.date}</span>
          </div>
          <div>
            <h3 className="text-foreground font-medium">{event.title}</h3>
            <span className="text-muted-foreground text-sm">{event.type}</span>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-muted-foreground transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-3 border-t border-border/20 space-y-4">
          {/* Venue — Ticketmaster 콘서트·팬미팅 만. EventDetailModal 과 동일 포맷. */}
          {event.venueName && (
            <p className="text-muted-foreground text-sm leading-relaxed flex items-start gap-1.5">
              <span aria-hidden>📍</span>
              <span>
                {[event.venueName, event.venueCity].filter(Boolean).join(" · ")}
                {event.venueCountryCode && (
                  <span className="ml-2">
                    {countryFlag(event.venueCountryCode)} {event.venueCountryCode}
                  </span>
                )}
              </span>
            </p>
          )}
          {event.description && (
            <p className="text-muted-foreground text-sm leading-relaxed">{event.description}</p>
          )}

          {/* Get Tickets — Ticketmaster 이벤트 + url 있을 때만 1차 CTA. */}
          {shouldShowGetTickets(event) && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button
                className="w-full py-3 rounded-xl font-medium text-white"
                style={{ backgroundColor: "#FF4B6E" }}
              >
                <Ticket className="w-4 h-4 mr-2" />
                Get Tickets
              </Button>
            </a>
          )}

          {/* Watch Now — TMDB 드라마 + US OTT provider 있을 때만 1차 CTA. */}
          {shouldShowWatchNow(event) && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button
                className="w-full py-3 rounded-xl font-medium text-white"
                style={{ backgroundColor: "#FF4B6E" }}
              >
                <Play className="w-4 h-4 mr-2" />
                Watch Now
              </Button>
            </a>
          )}

          <Button
            onClick={handleAddToGCal}
            variant={hasExternalPrimaryCta(event) ? "outline" : "default"}
            className={`w-full py-3 rounded-xl font-medium ${
              hasExternalPrimaryCta(event)
                ? "border-border/50 hover:bg-secondary/50"
                : "text-white"
            }`}
            style={
              hasExternalPrimaryCta(event)
                ? undefined
                : { backgroundColor: "#FF4B6E" }
            }
          >
            <Calendar className="w-4 h-4 mr-2" />
            Add to Google Calendar
          </Button>

          <div className="text-center">
            <p className="text-muted-foreground text-sm mb-3 flex items-center justify-center gap-1">
              Set reminder:
              {!isPro && <Lock className="w-3 h-3" />}
            </p>
            <div className="flex items-center justify-center gap-4">
              {(["d7", "d1", "dayOf"] as const).map((key) => {
                const labels: Record<typeof key, string> = {
                  d7: "D-7",
                  d1: "D-1",
                  dayOf: "Day of",
                }
                return (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <span className="text-sm text-muted-foreground">{labels[key]}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleReminder(key)
                      }}
                      title={!isPro ? "Coming with Hallyu Pass" : undefined}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        reminders[key] ? "" : "bg-[#333]"
                      }`}
                      style={reminders[key] ? { backgroundColor: "#FF4B6E" } : {}}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                          reminders[key] ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-border/20 flex items-center justify-between">
            {kpopArtistId ? (
              <Link
                href={`/kpop/${kpopArtistId}`}
                className="text-sm font-medium hover:underline"
                style={{ color: "#FF4B6E" }}
              >
                View artist stats →
              </Link>
            ) : (
              <span />
            )}
            <ReportButton contentType="event" contentId={event.id} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function HallyuCalendarPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<string>("All")
  // 권역 필터 — venue_country_code 가 권역 배열에 포함되는지로 매칭.
  // "ONLINE" = venue 정보 없는 이벤트 (드라마·컴백·스트리밍). "ALL" 은 필터 미적용.
  const [activeRegion, setActiveRegion] = useState<RegionCode>("ALL")
  const [viewDate, setViewDate] = useState<Date>(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [lockedFeature, setLockedFeature] = useState<string | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [icalCopied, setIcalCopied] = useState(false)
  const [isPro, setIsPro] = useState(false)                      // monthly/annual/admin 통합 판별
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isAuthReady, setIsAuthReady] = useState(false)
  // mypage/calendar 카드 → /calendar?event=<id>&month=<YYYY-MM> 진입 시 모달 자동 오픈용 pending id.
  // events 로드된 후 매칭되면 selectedEvent 로 승격 + null 로 초기화.
  const [pendingEventId, setPendingEventId] = useState<string | null>(null)
  // My Fan Events 비로그인 클릭 시 인플레이스 OAuth 모달
  const [fanEventsStartOpen, setFanEventsStartOpen] = useState(false)
  // Upcoming 아코디언에서 비로그인 액션(Add to GCal / Reminder) 시도 시 OAuth 모달
  const [accordionStartOpen, setAccordionStartOpen] = useState(false)
  const [subscribeStartOpen, setSubscribeStartOpen] = useState(false)
  // 한 번에 한 항목만 확장 — null = 모두 닫힘
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  // K-pop 아티스트명 → /kpop/[id] 연결용 룩업 맵
  const [kpopArtistMap, setKpopArtistMap] = useState<Record<string, string>>({})

  // Featured 가로 스크롤 컨테이너 — PC 화살표 버튼이 한 번에 보이는 폭만큼 이동
  const featuredScrollRef = useRef<HTMLDivElement>(null)

  const scrollFeatured = (dir: "left" | "right") => {
    const el = featuredScrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === "left" ? -el.clientWidth : el.clientWidth, behavior: "smooth" })
  }

  // 마운트 시 plan 권한 확인 — 탭/배너/이벤트 블러 가드용
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setIsLoggedIn(!!user)
      setIsAuthReady(true)
      if (!user) return
      const { data: profile } = await supabase
        .from("users")
        .select("plan_type, is_admin, trial_ends_at")
        .eq("id", user.id)
        .single()
      const row = profile as { plan_type?: string; is_admin?: boolean; trial_ends_at?: string | null } | null
      setIsPro(hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin, trialEndsAt: row?.trial_ends_at }))
    })
  }, [])

  // mypage/calendar → /calendar?event=<id>&month=<YYYY-MM> 진입 처리.
  // 1) month 가 있으면 viewDate 보정 (다른 달 이벤트도 자연스럽게 전환).
  // 2) event id 를 pendingEventId 로 보관 — events 로드 후 별도 useEffect 가 모달 오픈.
  // 3) URL 에서 param 제거 — 새로고침·뒤로가기 시 모달이 재오픈되지 않게.
  // useSearchParams 대신 window.location.search 직접 파싱 (Suspense 경계 부담 회피, StartModal 동일 패턴).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const eventParam = params.get("event")
    const monthParam = params.get("month")
    let dirty = false

    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split("-").map(Number)
      if (y && m >= 1 && m <= 12) {
        setViewDate(new Date(y, m - 1, 1))
      }
      params.delete("month")
      dirty = true
    }
    if (eventParam) {
      setPendingEventId(eventParam)
      params.delete("event")
      dirty = true
    }
    if (dirty) {
      const search = params.toString()
      const url = window.location.pathname + (search ? `?${search}` : "")
      window.history.replaceState({}, "", url)
    }
  }, [])

  // pendingEventId 가 있고 events 가 로드되면 매칭 이벤트 모달 오픈.
  // events.length=0 케이스 (정말 빈 달 또는 fetch 진행 중) 는 무시 — 다음 events 갱신 때 다시 평가.
  useEffect(() => {
    if (!pendingEventId || events.length === 0) return
    const match = events.find((e) => e.id === pendingEventId)
    if (match) {
      setSelectedEvent(match)
      setPendingEventId(null)
    }
  }, [pendingEventId, events])

  // My Fan Events 클릭 — 인증 ready + 비로그인이면 navigation 차단하고 StartModal 오픈.
  // 로딩 중 / 로그인 됨 → Link 정상 navigate (Free 포함 모든 plan 진입 가능 — 별도 제한 없음).
  const handleMyFanEventsClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isAuthReady && !isLoggedIn) {
      e.preventDefault()
      setFanEventsStartOpen(true)
    }
  }

  // 표시 월 파생값 (viewDate 변경 시 자동 갱신)
  const viewYear = viewDate.getFullYear()
  const viewMonth = viewDate.getMonth() // 0-11
  const monthQuery = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`
  const currentMonth = viewDate.toLocaleString("en-US", { month: "long", year: "numeric" })
  const monthShort = viewDate.toLocaleString("en-US", { month: "short" }).toUpperCase()
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay() // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  // 오늘 표시: 표시 중인 월이 실제 현재 월일 때만 highlight
  const realToday = new Date()
  const isCurrentRealMonth =
    realToday.getFullYear() === viewYear && realToday.getMonth() === viewMonth
  const today = isCurrentRealMonth ? realToday.getDate() : -1

  // "오늘 이전" 판정 — 과거 월이면 전부 past, 미래 월이면 전부 future, 현재 월일 때만 일자 비교.
  // 오늘 당일 이벤트는 past 가 아님 (= dim 미적용).
  const todayMidnight = new Date(
    realToday.getFullYear(),
    realToday.getMonth(),
    realToday.getDate()
  )
  const isPastEvent = (eventDay: number): boolean => {
    const eventDate = new Date(viewYear, viewMonth, eventDay)
    return eventDate < todayMidnight
  }

  const goPrev = () =>
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const goNext = () =>
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  // Supabase 에서 표시 월 이벤트 로드 — month 변경 시 재호출
  // RLS 가 is_premium 게이팅 자동 처리. AbortController 로 빠른 연속 클릭 시 stale 응답 방지.
  useEffect(() => {
    const ctrl = new AbortController()
    setEventsLoading(true)
    fetch(`/api/calendar/events?month=${monthQuery}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text().catch(() => "")
          throw new Error(`HTTP ${res.status} ${res.statusText} — ${body}`)
        }
        return res.json() as Promise<{ events: CalendarEvent[] }>
      })
      .then((data) => {
        setEvents(data.events ?? [])
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return
        // 외부 API 실패 시 fallback 처리 (CLAUDE.md §10-4)
        console.error(
          "[calendar] events fetch 실패:",
          err instanceof Error ? err.message : err
        )
        setEvents([])
      })
      .finally(() => setEventsLoading(false))
    return () => ctrl.abort()
  }, [monthQuery])

  // K-pop 이벤트 아티스트명 → kpop_artists.id 룩업 (events 변경 시 재실행)
  useEffect(() => {
    const names = [
      ...new Set(
        events
          .filter((e) => e.type === "K-pop" && e.artist)
          .map((e) => e.artist as string)
      ),
    ]
    if (names.length === 0) return
    const supabase = createSupabaseBrowserClient()
    supabase
      .from("kpop_artists")
      .select("id, name, name_ko")
      .in("name", names)
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, string> = {}
        for (const a of data as { id: string; name: string; name_ko: string | null }[]) {
          map[a.name] = a.id
          if (a.name_ko) map[a.name_ko] = a.id
        }
        setKpopArtistMap(map)
      })
  }, [events])

  const handleTabClick = (tab: string) => {
    // Pro 유저는 lockedTabs 우회 — 모든 탭 자유 전환
    if (!isPro && lockedTabs.includes(tab)) {
      setLockedFeature(tab)
      setShowUpgradeModal(true)
    } else {
      setActiveTab(tab)
    }
  }

  // 타입 탭 통과 이벤트 — 권역 chip 카운트와 최종 필터 모두 여기서 시작.
  const eventsByTypeOnly = events.filter(
    (e) => activeTab === "All" || e.type === activeTab
  )

  // 권역별 0건 칩 미노출 — useMemo 로 stable reference 유지 (매 렌더 새 배열 방지).
  //   ALL 은 항상 노출 (이벤트 0건이어도 reset 진입점).
  //   그 외는 현재 type 탭 기준 1건이라도 있을 때만 노출.
  const visibleRegions = useMemo(
    () => REGION_FILTERS.filter(
      (r) => r.code === "ALL" || eventsByTypeOnly.some((e) => eventMatchesRegion(e, r.code))
    ),
    [eventsByTypeOnly]
  )

  // 사용자가 선택한 권역이 탭 전환 등으로 0건이 되면 ALL 로 자동 복귀 — 빈 결과 화면 방지.
  useEffect(() => {
    if (activeRegion === "ALL") return
    const stillVisible = visibleRegions.some((r) => r.code === activeRegion)
    if (!stillVisible) setActiveRegion("ALL")
    // visibleRegions 의 reference 가 매 렌더 새로 만들어지지만 setActiveRegion 은
    // 이미 ALL 일 때 no-op 라 무한 루프 위험 없음.
  }, [activeRegion, visibleRegions])

  // 최종 필터 — 타입 + 권역 합성.
  const filteredEvents = eventsByTypeOnly.filter((e) => eventMatchesRegion(e, activeRegion))

  const getEventsForDay = (day: number) => {
    return filteredEvents.filter(e => e.date === day)
  }

  const upcomingEvents = [...filteredEvents]
    .filter((e) => (isCurrentRealMonth ? e.date >= today : true))
    .sort((a, b) => a.date - b.date)
    .slice(0, 5)

  const thisWeekTop3 = useMemo(() => {
    if (!isCurrentRealMonth || events.length === 0) return []
    const now = new Date()
    const dayOfWeek = now.getDay()
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStartDay = Math.max(1, now.getDate() + daysToMonday)
    const weekEndDay = now.getDate() + daysToMonday + 6
    const TYPE_PRIORITY: Partial<Record<EventType, number>> = {
      "K-pop": 0,
      "Concert": 1,
      "Fan Meet": 2,
      "K-drama": 3,
    }
    return [...events]
      .filter((e) => e.date >= weekStartDay && e.date <= weekEndDay)
      .sort((a, b) => {
        const pa = TYPE_PRIORITY[a.type] ?? 3
        const pb = TYPE_PRIORITY[b.type] ?? 3
        return pa !== pb ? pa - pb : a.date - b.date
      })
      .slice(0, 3)
  }, [events, isCurrentRealMonth])

  // Featured 카드용 — 썸네일 있는 이벤트 전체 (개수 제한 없음, 가로 스크롤로 모두 노출).
  // 1차: Ticketmaster (글로벌 공연 데이터) 우선 → 좌측에 노출.
  // 2차: 그 외 source 는 created_at desc 로 정렬 (최신 등록이 좌측).
  const featuredEvents = filteredEvents
    .filter((e) => !!e.thumbnailUrl)
    .slice()
    .sort((a, b) => {
      const aTm = a.sourceApi === "ticketmaster" ? 1 : 0
      const bTm = b.sourceApi === "ticketmaster" ? 1 : 0
      if (aTm !== bTm) return bTm - aTm
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
    })

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event)
  }

  const closeModal = () => {
    setSelectedEvent(null)
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Toaster />
      {/* Event Detail Modal */}
      <EventDetailModal
        event={selectedEvent}
        onClose={closeModal}
        viewDate={viewDate}
        isPro={isPro}
        onUpgradeNeeded={() => setShowUpgradeModal(true)}
        kpopArtistId={selectedEvent ? kpopArtistMap[selectedEvent.artist ?? ""] : undefined}
      />
      
      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        lockedFeature={lockedFeature}
        isLoggedIn={isLoggedIn}
      />
      
      <main className="max-w-[1320px] mx-auto px-6 pt-28 pb-12">
        {/* Page Header */}
        <section className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
            HallyuCalendar
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl mb-8 max-w-2xl mx-auto">
            Never miss a K-pop comeback or K-drama premiere
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              onClick={() => isLoggedIn ? router.push("/mypage/calendar") : setSubscribeStartOpen(true)}
              className="px-6 py-3 rounded-full font-medium"
              style={{ backgroundColor: "#FF4B6E", color: "white" }}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Subscribe to Google Calendar
            </Button>
            <Button
              onClick={async () => {
                const icalUrl = "https://www.unfoldk.com/api/calendar/ical"
                try {
                  await navigator.clipboard.writeText(icalUrl)
                  setIcalCopied(true)
                  setTimeout(() => setIcalCopied(false), 1500)
                } catch {
                  // clipboard API 미지원 시 mypage로 fallback
                  if (isLoggedIn) router.push("/mypage/calendar")
                  else setSubscribeStartOpen(true)
                }
              }}
              variant="outline"
              className="px-6 py-3 rounded-full font-medium border-border/50 hover:bg-secondary/50"
            >
              {icalCopied ? "Copied!" : "Copy iCal Link"}
            </Button>
          </div>
        </section>

        {/* This Week's Must-See Hallyu Events TOP 3 */}
        {thisWeekTop3.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">This Week&apos;s Must-See Hallyu Events</h2>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  Updated every Monday
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {thisWeekTop3.map((event, idx) => {
                const artistId = kpopArtistMap[event.artist ?? ""]
                return (
                  <AuthGate key={event.id} isLoggedIn={isLoggedIn}>
                  <div
                    className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-4 cursor-pointer hover:border-primary/40 transition-colors"
                    onClick={() => handleEventClick(event)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="text-xs font-bold text-primary bg-primary/15 px-2 py-0.5 rounded-full flex-shrink-0">
                        TOP {idx + 1}
                      </span>
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: `${getEventTypeColor(event.type)}20`,
                          color: getEventTypeColor(event.type),
                        }}
                      >
                        {event.type}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground line-clamp-2 mb-2">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(new Date().getFullYear(), new Date().getMonth(), event.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {event.artist && <span className="ml-2">· {event.artist}</span>}
                    </p>
                    {artistId && event.type === "K-pop" && (
                      <Link
                        href={`/kpop/${artistId}`}
                        className="mt-2 text-xs text-primary hover:underline flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View artist stats →
                      </Link>
                    )}
                  </div>
                  </AuthGate>
                )
              })}
            </div>
          </section>
        )}

        {/* Filter Bar */}
        <section className="mb-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-border/30 pb-4">
            {/* Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
              {tabs.map((tab) => {
                const isLocked = !isPro && lockedTabs.includes(tab)
                return (
                  <div key={tab} className="relative">
                    {/* 잠긴 탭: 비로그인 AuthGate 차단. 로그인 비Pro: 탭 전환 허용 + UpgradeModal. */}
                    <AuthGate isLoggedIn={isLocked ? isLoggedIn : null}>
                    <button
                      onClick={() => handleTabClick(tab)}
                      className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors relative flex items-center gap-1.5 ${
                        activeTab === tab
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tab}
                      {isLocked && <Lock className="w-3 h-3" />}
                      {activeTab === tab && (
                        <span
                          className="absolute bottom-0 left-0 right-0 h-0.5"
                          style={{ backgroundColor: "#FF4B6E" }}
                        />
                      )}
                    </button>
                    </AuthGate>
                  </div>
                )
              })}
            </div>

            {/* Month Navigation */}
            <div className="flex items-center gap-4">
              <button
                onClick={goPrev}
                aria-label="Previous month"
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-foreground font-medium min-w-[120px] text-center">
                {currentMonth}
              </span>
              <button
                onClick={goNext}
                aria-label="Next month"
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Region Filter Row — venue_country_code 권역 매칭 (REGION_FILTERS).
              ALL=전체 / Americas·Europe·Asia·Middle East=권역 배열 inclusion /
              ONLINE=venue 없는 이벤트 (컴백·드라마·스트리밍).
              현재 type 탭 기준 0건 권역은 chip 자체 미노출 (visibleRegions). */}
          <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none" }}>
            {visibleRegions.map((f) => {
              const isActive = activeRegion === f.code
              return (
                <button
                  key={f.code}
                  type="button"
                  onClick={() => setActiveRegion(f.code)}
                  className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    isActive
                      ? "text-white"
                      : "border-border/40 bg-[#1a1a1a] text-muted-foreground hover:border-border/70 hover:text-foreground"
                  }`}
                  style={
                    isActive
                      ? { backgroundColor: "#FF4B6E", borderColor: "#FF4B6E" }
                      : undefined
                  }
                  aria-pressed={isActive}
                >
                  {f.flag && <span>{f.flag}</span>}
                  <span>{f.label}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Artist Tracking Banner — 비로그인만 노출 (2026-05-16 임시 정책, DECISIONS.md).
            Free 가 무제한 트래킹 (결제 연동 후 isPro 기준으로 복원). */}
        {!isLoggedIn && (
          <section className="mb-6">
            <div className="bg-[#1a1a1a] border border-border/30 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                Sign in to track unlimited artists — free during preview.
              </span>
              <button
                type="button"
                onClick={() => setSubscribeStartOpen(true)}
                className="text-sm font-medium hover:underline"
                style={{ color: "#FF4B6E" }}
              >
                Sign in
              </button>
            </div>
          </section>
        )}

        {/* Main Calendar Grid */}
        <section className="mb-12">
          <div className="relative bg-[#1a1a1a] border border-border/30 rounded-2xl p-4 md:p-6 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
            {eventsLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-[#1a1a1a]/70">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2 min-w-[600px]">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="text-center text-muted-foreground text-sm font-medium py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1 min-w-[600px]">
              {/* Empty cells: 표시 월 1일 의 요일만큼 offset */}
              {[...Array(firstDayOfWeek)].map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="min-h-[100px] md:min-h-[120px] bg-[#141416] rounded-lg"
                />
              ))}

              {/* Calendar days 1..daysInMonth (28-31) */}
              {[...Array(daysInMonth)].map((_, i) => {
                const day = i + 1
                const dayEvents = getEventsForDay(day)
                const isToday = day === today

                return (
                  <div
                    key={day}
                    className="min-h-[100px] md:min-h-[120px] bg-[#141416] rounded-lg p-2 relative"
                  >
                    {/* Date number */}
                    <div className="flex items-start justify-between">
                      <span
                        className={`text-sm font-medium ${
                          isToday
                            ? "w-7 h-7 rounded-full flex items-center justify-center text-white"
                            : "text-foreground/70"
                        }`}
                        style={isToday ? { backgroundColor: "#FF4B6E" } : {}}
                      >
                        {day}
                      </span>
                    </div>

                    {/* Event tags - clickable */}
                    <div className="mt-1 space-y-1">
                      {dayEvents.map((event) => (
                        <AuthGate key={event.id} isLoggedIn={isLoggedIn} className="w-full">
                        <button
                          onClick={() => handleEventClick(event)}
                          className={`w-full text-left text-[10px] md:text-xs font-medium text-white px-1.5 py-0.5 rounded truncate hover:opacity-80 transition-opacity cursor-pointer ${
                            isPastEvent(event.date) ? "opacity-40" : ""
                          }`}
                          style={{ backgroundColor: getEventTypeColor(event.type) }}
                          title={event.title}
                        >
                          {event.title}
                        </button>
                        </AuthGate>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Community contribution CTA — Eventbrite ingest 폐기 후 fan_event_requests 진입점 강화 (2026-05-14).
            카드형 배너 + Primary CTA 버튼으로 시인성 강화. 헤드라인은 사용자 액션 직접 유도형 문장. */}
        <section className="mb-12">
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-6 md:p-8 max-w-3xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <h3 className="text-foreground text-xl md:text-2xl font-semibold mb-2">
                  Spot a Hallyu event in your area?
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  This calendar is built together with Hallyu fans worldwide.
                  <br />
                  Selected submissions receive a complimentary Hallyu Pass.
                </p>
              </div>
              <Link
                href="/mypage/fan-events"
                onClick={handleMyFanEventsClick}
                className="flex-shrink-0"
              >
                <Button
                  className="px-6 py-3 rounded-full font-medium text-white whitespace-nowrap"
                  style={{ backgroundColor: "#FF4B6E" }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Submit a Fan Event
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Featured 가로 스크롤 — 썸네일 있는 이벤트만, 카드 클릭 시 EventDetailModal 오픈.
            featuredEvents 가 비어있으면 섹션 자체 미노출 (빈 placeholder 안 보임).
            우측 가장자리는 background 색 → transparent 그라데이션 오버레이로 추가 콘텐츠 신호. */}
        {featuredEvents.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-foreground mb-6">Featured events</h2>
            <div className="relative group">
              <div
                ref={featuredScrollRef}
                className="flex gap-4 overflow-x-auto pb-2 snap-x snap-proximity [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
              {featuredEvents.map((event) => (
                <AuthGate key={event.id} isLoggedIn={isLoggedIn} className="flex-shrink-0 w-72 snap-start">
                <button
                  type="button"
                  onClick={() => handleEventClick(event)}
                  className="w-full bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/50 transition-colors text-left"
                >
                  {/* 프레임 16:9 가로 고정 — Ticketmaster 표준 비율.
                      object-contain 으로 원본 비율 유지: Ticketmaster 16:9 는 가득, TMDB 2:3 포스터는 좌우 레터박스. */}
                  <div className="aspect-video bg-[#0d0d0f] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={event.thumbnailUrl}
                      alt={event.title}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="text-foreground font-medium text-sm truncate">{event.title}</h3>
                    {/* 날짜 라벨을 타입 색으로 — 카드에 새 element 추가 없이 타입 표시 */}
                    <p
                      className="text-xs mt-1"
                      style={{ color: getEventTypeColor(event.type) }}
                    >
                      {monthShort} {event.date} · {event.type}
                    </p>
                    {/* Venue 부제 — Ticketmaster city + flag. 없으면 줄 자체 미노출. */}
                    {event.venueCity && (
                      <p className="text-xs mt-1 text-muted-foreground truncate">
                        {countryFlag(event.venueCountryCode)} {event.venueCity}
                      </p>
                    )}
                  </div>
                </button>
                </AuthGate>
              ))}
              </div>
              {/* 우측 페이드 — "더 있어요" 신호 (특히 모바일). overflow 없을 땐 빈 영역에 겹쳐 사실상 비표시. */}
              <div
                className="pointer-events-none absolute right-0 top-0 bottom-2 w-12"
                style={{
                  background:
                    "linear-gradient(to left, hsl(var(--background)) 0%, transparent 100%)",
                }}
                aria-hidden="true"
              />
              {/* PC 전용 화살표 — md+ 에서 group hover 시에만 노출. 모바일은 터치 스와이프 유지. */}
              <button
                type="button"
                onClick={() => scrollFeatured("left")}
                aria-label="Scroll featured events left"
                className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-[#1a1a1a]/90 backdrop-blur-sm border border-border/30 items-center justify-center text-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#1a1a1a]"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => scrollFeatured("right")}
                aria-label="Scroll featured events right"
                className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-[#1a1a1a]/90 backdrop-blur-sm border border-border/30 items-center justify-center text-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#1a1a1a]"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </section>
        )}

        {/* Upcoming Events List */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-6">
            {isCurrentRealMonth
              ? "Upcoming this month"
              : `Events in ${viewDate.toLocaleString("en-US", { month: "long" })}`}
          </h2>
          <div className="space-y-4">
            {!eventsLoading && upcomingEvents.length === 0 && (
              <div className="bg-[#1a1a1a] border border-border/30 rounded-xl px-6 py-10 text-center text-muted-foreground text-sm">
                No upcoming events this month.
              </div>
            )}
            {upcomingEvents.map((event, index) => (
              <AuthGate key={event.id} isLoggedIn={isLoggedIn} className="w-full">
                <UpcomingAccordionItem
                  event={event}
                  index={index}
                  monthShort={monthShort}
                  viewDate={viewDate}
                  isPro={isPro}
                  isPast={isPastEvent(event.date)}
                  isLoggedIn={isLoggedIn}
                  isExpanded={expandedEventId === event.id}
                  onToggle={() =>
                    setExpandedEventId(expandedEventId === event.id ? null : event.id)
                  }
                  onLoginNeeded={() => setAccordionStartOpen(true)}
                  onUpgradeNeeded={() => setShowUpgradeModal(true)}
                  kpopArtistId={kpopArtistMap[event.artist ?? ""]}
                />
              </AuthGate>
            ))}
          </div>
        </section>

        {/* TMDB attribution — ToS 의무 표기.
            "This product uses the TMDB API but is not endorsed or certified by TMDB."
            드라마 이벤트가 source_api='tmdb' 로 캘린더에 노출되므로 페이지 단위 박제. */}
        <section className="mb-8 pt-8 border-t border-border/30">
          <div className="text-center text-xs text-muted-foreground leading-relaxed">
            <p className="mb-1">
              This product uses the{" "}
              <a
                href="https://www.themoviedb.org"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground transition-colors"
              >
                TMDB
              </a>{" "}
              API but is not endorsed or certified by TMDB.
            </p>
          </div>
        </section>

      </main>

      {/* My Fan Events (비로그인) 클릭 시 인플레이스 OAuth 모달.
          OAuth 완료 후 next=/mypage/fan-events 로 직접 진입. */}
      <StartModal
        open={fanEventsStartOpen}
        onOpenChange={setFanEventsStartOpen}
        next="/mypage/fan-events"
      />

      {/* Upcoming 아코디언 — Add to GCal / Reminder 토글 비로그인 클릭 시 OAuth 모달.
          완료 후 현재 페이지(/calendar) 로 복귀해 같은 위치에서 재시도 가능. */}
      <StartModal
        open={accordionStartOpen}
        onOpenChange={setAccordionStartOpen}
        next="/calendar"
      />
      <StartModal
        open={subscribeStartOpen}
        onOpenChange={setSubscribeStartOpen}
        next="/mypage/calendar"
      />

      <FooterSection />
    </div>
  )
}
