"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Plus, Calendar, X, Lock } from "lucide-react"
import Link from "next/link"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { hasProAccess } from "@/lib/auth/plan"
import { ReportButton } from "@/components/common/report-button"
import { getEventTypeColor } from "@/lib/calendar/event-type-colors"

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
  createdAt?: string                     // ISO string — Featured 정렬 키 (등록순)
}

const tabs = ["All", "K-pop", "K-drama", "Concert", "Fan Meet"] as const
const lockedTabs = ["Concert", "Fan Meet"]

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

  // Add to Google Calendar — OAuth 없이 GCal TEMPLATE URL 로 새 탭 오픈
  // event.date(1~31) + viewDate(연·월) 로 실제 날짜 합성, event.time 은 라벨 문자열이라
  // 신뢰성 있는 파싱이 어려워 종일(all-day) 포맷으로 처리. 종료일은 exclusive 라 +1일.
  const handleAddToGoogleCalendar = () => {
    if (!event) return
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
    window.open(
      `https://calendar.google.com/calendar/render?${params.toString()}`,
      "_blank",
      "noopener,noreferrer"
    )
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
          <Button
            className="w-full py-3 rounded-xl font-medium text-white"
            style={{ backgroundColor: "#FF4B6E" }}
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

  // 마운트 시 plan 권한 확인 — 탭/배너/이벤트 블러 가드용
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
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

  // Featured 카드용 — 썸네일 있는 이벤트만, created_at desc 로 최신 등록이 좌측.
  // ISO 타임스탬프는 lexicographic sort 가 chronological sort 와 동치.
  const featuredEvents = filteredEvents
    .filter((e) => !!e.thumbnailUrl)
    .slice()
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, 6)

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

        {/* Community contribution note — 달력 바로 아래 3줄 안내 (문장 단위 줄바꿈) */}
        <section className="mb-12">
          <p className="text-muted-foreground text-sm leading-relaxed text-center max-w-3xl mx-auto">
            This calendar is built together with Hallyu fans around the world.
            <br />
            Share news about Hallyu events happening in your area.
            <br />
            Selected submissions receive a complimentary Hallyu Pass. Ready to contribute? Head to{" "}
            <Link
              href="/mypage/fan-events"
              className="hover:underline"
              style={{ color: "#FF4B6E" }}
            >
              My Fan Events
            </Link>
            .
          </p>
        </section>

        {/* Featured 가로 스크롤 — 썸네일 있는 이벤트만, 카드 클릭 시 EventDetailModal 오픈.
            featuredEvents 가 비어있으면 섹션 자체 미노출 (빈 placeholder 안 보임).
            우측 가장자리는 background 색 → transparent 그라데이션 오버레이로 추가 콘텐츠 신호. */}
        {featuredEvents.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-foreground mb-6">Featured events</h2>
            <div className="relative">
              <div
                className="flex gap-4 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
              {featuredEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => handleEventClick(event)}
                  className="flex-shrink-0 w-48 bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/50 transition-colors text-left"
                >
                  {/* 프레임 3:4 세로 고정. object-contain 으로 원본 비율 유지 —
                      16:9 가로 썸네일은 가로폭 맞춤 + 위아래 레터박스, 2:3 포스터는 좌우 살짝 레터박스. */}
                  <div className="aspect-[3/4] bg-[#0d0d0f] overflow-hidden flex items-center justify-center">
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
              {/* 우측 페이드 — "더 있어요" 신호. overflow 없을 땐 빈 영역에 겹쳐 사실상 비표시.
                  scroll 끝까지 갔을 땐 마지막 카드가 살짝 페이드되는 미세 wart 가 있지만,
                  JS 스크롤 위치 트래킹 없이 얻는 비용 대비 효율 좋음. */}
              <div
                className="pointer-events-none absolute right-0 top-0 bottom-2 w-12"
                style={{
                  background:
                    "linear-gradient(to left, hsl(var(--background)) 0%, transparent 100%)",
                }}
                aria-hidden="true"
              />
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
            {upcomingEvents.map((event, index) => {
              // Pro 유저는 4번째 이후도 명확 (블러 미적용)
              const isBlurred = !isPro && index >= 3
              const isPast = isPastEvent(event.date)
              return (
                <div
                  key={event.id}
                  onClick={() => !isBlurred && handleEventClick(event)}
                  className={`flex items-center justify-between bg-[#1a1a1a] border border-border/30 rounded-xl p-4 transition-colors ${
                    isBlurred ? "blur-[4px] pointer-events-none" : "cursor-pointer hover:border-primary/50"
                  } ${isPast ? "opacity-40" : ""}`}
                >
                  <div className="flex items-center gap-4">
                    {/* Date Badge — 타입별 색상 */}
                    <div
                      className="w-14 h-14 rounded-xl flex flex-col items-center justify-center text-white"
                      style={{ backgroundColor: getEventTypeColor(event.type) }}
                    >
                      <span className="text-xs font-medium">{monthShort}</span>
                      <span className="text-xl font-bold">{event.date}</span>
                    </div>

                    {/* Event Info */}
                    <div>
                      <h3 className="text-foreground font-medium">{event.title}</h3>
                      <span className="text-muted-foreground text-sm">{event.type}</span>
                    </div>
                  </div>

                  {/* Add to Calendar Button */}
                  <Link href="/login" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full border-border/50 hover:bg-secondary/50"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add to Calendar
                    </Button>
                  </Link>
                </div>
              )
            })}

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

      </main>

      <FooterSection />
    </div>
  )
}
