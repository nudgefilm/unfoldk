"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronLeft, ChevronRight, Calendar, X, Lock, Plus, Ticket, Play } from "lucide-react"
import Link from "next/link"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { hasProAccess } from "@/lib/auth/plan"
import { ReportButton } from "@/components/common/report-button"
import { getEventTypeColor } from "@/lib/calendar/event-type-colors"
import { StartModal } from "@/components/start-modal"

type EventType = "K-pop" | "K-drama" | "Concert" | "Fan Meet"

interface CalendarEvent {
  id: string
  title: string
  date: number
  type: EventType
  time?: string
  artist?: string
  description?: string                   // Claude 가 생성한 한 줄 설명 (영어)
  isPremium?: boolean
  thumbnailUrl?: string                  // DB hallyu_calendar_events.thumbnail_url
  sourceApi?: string                     // 'ticketmaster' | 'tmdb' | 'youtube' | 'lastfm' — Featured 우선순위
  url?: string                           // 외부 티켓 예매 페이지 (Ticketmaster). sourceApi='ticketmaster' 일 때만 의미.
  createdAt?: string                     // ISO string — Featured 정렬 키 (등록순)
}

// Ticketmaster 이벤트에서만 Get Tickets 버튼 노출 — 다른 소스는 url 없거나 의미 다름.
// TODO: KOPIS 는 현재 캘린더 노출 차단 중. 재노출 시 Melon Ticket 외부 링크를 url 로 채우면 동일 조건 자동 적용.
function shouldShowGetTickets(event: CalendarEvent): boolean {
  return event.sourceApi === "ticketmaster" && !!event.url
}

// TMDB 드라마 이벤트 + US watch providers 있을 때만 Watch Now 버튼.
// url 컬럼을 Ticketmaster 와 공유하지만 sourceApi 가드로 격리 → 두 조건이 동시에 참이 될 수 없음.
function shouldShowWatchNow(event: CalendarEvent): boolean {
  return event.sourceApi === "tmdb" && !!event.url
}

// 이벤트 1차 CTA 가 외부 링크 (Get Tickets / Watch Now) 인지 — Add to GCal 강등 판정용.
function hasExternalPrimaryCta(event: CalendarEvent): boolean {
  return shouldShowGetTickets(event) || shouldShowWatchNow(event)
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
}: {
  event: CalendarEvent | null
  onClose: () => void
  viewDate: Date
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
  // iCal 복사 피드백 — "Copied!" 또는 "Copy failed" 2초간 표시 후 원복
  const [icalCopyStatus, setIcalCopyStatus] = useState<"idle" | "copied" | "failed">("idle")
  const icalResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Add to Google Calendar — 모듈 레벨 buildGoogleCalendarUrl 헬퍼 재사용
  const handleAddToGoogleCalendar = () => {
    if (!event) return
    window.open(buildGoogleCalendarUrl(event, viewDate), "_blank", "noopener,noreferrer")
  }

  // Copy iCal Link 버튼 — 클립보드에 이벤트별 iCal feed URL 복사 + 2초간 상태 표시
  // 운영 시 /api/calendar/ical/{id} 라우트 구현 예정. 현재는 placeholder URL.
  const handleCopyIcal = async () => {
    if (!event) return
    const url = `${window.location.origin}/api/calendar/ical/${event.id}`
    try {
      await navigator.clipboard.writeText(url)
      setIcalCopyStatus("copied")
    } catch (err) {
      console.error("[calendar] iCal 복사 실패:", err)
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
        <h2 className="text-2xl font-bold text-white mb-4">
          {event.title}
        </h2>

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

        {/* Description — Claude 가 생성한 한 줄 설명 (있을 때만 노출) */}
        {event.description && (
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            {event.description}
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
              : "Copy iCal Link"}
          </Button>
        </div>

        {/* Reminder Toggles */}
        <div className="text-center">
          <p className="text-muted-foreground text-sm mb-3">Set reminder:</p>
          <div className="flex items-center justify-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-muted-foreground">D-7</span>
              <button
                onClick={() => toggleReminder("d7")}
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

        {/* Report incorrect info — 모달 하단 우측, 콘텐츠 신고 시스템 진입점 */}
        <div className="mt-4 pt-4 border-t border-border/30 flex justify-end">
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
  lockedFeature
}: { 
  isOpen: boolean
  onClose: () => void
  lockedFeature: string | null
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
          {lockedFeature} is a Pro Feature
        </h2>

        {/* Description */}
        <p className="text-muted-foreground text-sm mb-6">
          Upgrade to Hallyu Pass to unlock {lockedFeature} events and get unlimited access to all calendar features.
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
          <Link href="/signup" className="block">
            <Button 
              className="w-full py-3 rounded-xl font-medium text-white"
              style={{ backgroundColor: "#FF4B6E" }}
            >
              Upgrade to Hallyu Pass — $15/mo
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
}) {
  const isBlurred = !isPro && index >= 3

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
    if (!isLoggedIn) {
      onLoginNeeded()
      return
    }
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
      className={`bg-[#1a1a1a] border border-border/30 rounded-xl transition-colors ${
        isBlurred ? "blur-[4px] pointer-events-none" : "hover:border-primary/50"
      } ${isPast ? "opacity-40" : ""}`}
    >
      {/* Header row — 클릭 시 아코디언 토글 */}
      <div
        onClick={() => !isBlurred && onToggle()}
        className={`flex items-center justify-between p-4 ${isBlurred ? "" : "cursor-pointer"}`}
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
      {isExpanded && !isBlurred && (
        <div className="px-4 pb-4 pt-3 border-t border-border/20 space-y-4">
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
            <p className="text-muted-foreground text-sm mb-3">Set reminder:</p>
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

          <div className="pt-2 border-t border-border/20 flex justify-end">
            <ReportButton contentType="event" contentId={event.id} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function HallyuCalendarPage() {
  const [activeTab, setActiveTab] = useState<string>("All")
  const [viewDate, setViewDate] = useState<Date>(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [lockedFeature, setLockedFeature] = useState<string | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isPro, setIsPro] = useState(false)                      // monthly/annual/admin 통합 판별
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isAuthReady, setIsAuthReady] = useState(false)
  // My Fan Events 비로그인 클릭 시 인플레이스 OAuth 모달
  const [fanEventsStartOpen, setFanEventsStartOpen] = useState(false)
  // Upcoming 아코디언에서 비로그인 액션(Add to GCal / Reminder) 시도 시 OAuth 모달
  const [accordionStartOpen, setAccordionStartOpen] = useState(false)
  // 한 번에 한 항목만 확장 — null = 모두 닫힘
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
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
        .select("plan_type, is_admin")
        .eq("id", user.id)
        .single()
      const row = profile as { plan_type?: string; is_admin?: boolean } | null
      setIsPro(hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin }))
    })
  }, [])

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
    return () => ctrl.abort()
  }, [monthQuery])

  const handleTabClick = (tab: string) => {
    // Pro 유저는 lockedTabs 우회 — 모든 탭 자유 전환
    if (!isPro && lockedTabs.includes(tab)) {
      setLockedFeature(tab)
      setShowUpgradeModal(true)
    } else {
      setActiveTab(tab)
    }
  }

  const filteredEvents = activeTab === "All"
    ? events
    : events.filter(e => e.type === activeTab)

  const getEventsForDay = (day: number) => {
    return filteredEvents.filter(e => e.date === day)
  }

  const upcomingEvents = [...filteredEvents]
    .filter((e) => (isCurrentRealMonth ? e.date >= today : true))
    .sort((a, b) => a.date - b.date)
    .slice(0, 5)

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
    <div className="min-h-screen bg-background">
      {/* Event Detail Modal */}
      <EventDetailModal event={selectedEvent} onClose={closeModal} viewDate={viewDate} />
      
      {/* Upgrade Modal */}
      <UpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)} 
        lockedFeature={lockedFeature}
      />
      
      <main className="max-w-[1320px] mx-auto px-6 py-8">
        {/* Page Header */}
        <section className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
            HallyuCalendar
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl mb-8 max-w-2xl mx-auto">
            Never miss a K-pop comeback or K-drama premiere
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/mypage/calendar">
              <Button 
                className="px-6 py-3 rounded-full font-medium"
                style={{ backgroundColor: "#FF4B6E", color: "white" }}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Subscribe to Google Calendar
              </Button>
            </Link>
            <Link href="/mypage/calendar">
              <Button 
                variant="outline"
                className="px-6 py-3 rounded-full font-medium border-border/50 hover:bg-secondary/50"
              >
                Copy iCal Link
              </Button>
            </Link>
          </div>
        </section>

        {/* Filter Bar */}
        <section className="mb-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-border/30 pb-4">
            {/* Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {tabs.map((tab) => {
                const isLocked = !isPro && lockedTabs.includes(tab)
                return (
                  <div key={tab} className="relative">
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
        </section>

        {/* Artist Tracking Limit Banner — isPro 면 미노출 (무제한 트래킹) */}
        {!isPro && (
          <section className="mb-6">
            <div className="bg-[#1a1a1a] border border-border/30 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                You are tracking <span className="text-foreground font-medium">3/3 artists</span> on Free plan
              </span>
              <Link
                href="/signup"
                className="text-sm font-medium hover:underline"
                style={{ color: "#FF4B6E" }}
              >
                Upgrade to track unlimited artists
              </Link>
            </div>
          </section>
        )}

        {/* Main Calendar Grid */}
        <section className="mb-12">
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-4 md:p-6 overflow-x-auto">
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
                        <button
                          key={event.id}
                          onClick={() => handleEventClick(event)}
                          className={`w-full text-left text-[10px] md:text-xs font-medium text-white px-1.5 py-0.5 rounded truncate hover:opacity-80 transition-opacity cursor-pointer ${
                            isPastEvent(event.date) ? "opacity-40" : ""
                          }`}
                          style={{ backgroundColor: getEventTypeColor(event.type) }}
                          title={event.title}
                        >
                          {event.title}
                        </button>
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
                <button
                  key={event.id}
                  type="button"
                  onClick={() => handleEventClick(event)}
                  className="flex-shrink-0 w-72 snap-start bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/50 transition-colors text-left"
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
                  </div>
                </button>
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
          <div className="space-y-4 relative">
            {upcomingEvents.map((event, index) => (
              <UpcomingAccordionItem
                key={event.id}
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
              />
            ))}

            {/* Blur Upsell Overlay - positioned over 4th and 5th events. Pro 면 미노출 */}
            {!isPro && upcomingEvents.length > 3 && (
              <div 
                className="absolute bottom-0 left-0 right-0 flex items-center justify-center pointer-events-auto"
                style={{ 
                  height: `${Math.min(upcomingEvents.length - 3, 2) * 82 + 16}px`,
                  background: "linear-gradient(to bottom, transparent, rgba(13, 13, 15, 0.8) 30%)"
                }}
              >
                <div className="bg-[#1a1a1a] border border-border/50 rounded-xl p-6 text-center shadow-xl">
                  <p className="text-foreground font-medium mb-4">
                    Unlock all events with Hallyu Pass
                  </p>
                  <Link href="/#pricing-section">
                    <Button
                      className="px-6 py-2 rounded-full font-medium text-white"
                      style={{ backgroundColor: "#FF4B6E" }}
                    >
                      Upgrade — $15/month
                    </Button>
                  </Link>
                </div>
              </div>
            )}
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

      <FooterSection />
    </div>
  )
}
