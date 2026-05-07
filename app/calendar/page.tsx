"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Plus, Calendar, X, Lock } from "lucide-react"
import Link from "next/link"

type EventType = "K-pop" | "K-drama" | "Concert" | "Fan Meet"

interface CalendarEvent {
  id: string
  title: string
  date: number
  type: EventType
  time?: string
  artist?: string
  isPremium?: boolean
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
  const [reminders, setReminders] = useState({
    d7: false,
    d1: true,
    dayOf: true
  })

  if (!event) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const toggleReminder = (key: keyof typeof reminders) => {
    setReminders(prev => ({ ...prev, [key]: !prev[key] }))
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
            style={{ backgroundColor: "#FF4B6E" }}
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
        <div className="flex items-center gap-3 mb-6">
          {/* Placeholder Avatar */}
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
            style={{ backgroundColor: "#FF4B6E" }}
          >
            {event.artist?.charAt(0) || "?"}
          </div>
          <span className="text-foreground font-medium">{event.artist || "Unknown"}</span>
        </div>

        {/* Divider */}
        <div className="border-t border-border/30 mb-6" />

        {/* Action Buttons */}
        <div className="space-y-3 mb-6">
          <Button 
            className="w-full py-3 rounded-xl font-medium text-white"
            style={{ backgroundColor: "#FF4B6E" }}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Add to Google Calendar
          </Button>
          <Button 
            variant="outline"
            className="w-full py-3 rounded-xl font-medium border-border/50 hover:bg-secondary/50"
          >
            Copy iCal Link
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
    if (lockedTabs.includes(tab)) {
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

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event)
  }

  const closeModal = () => {
    setSelectedEvent(null)
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
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
                const isLocked = lockedTabs.includes(tab)
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

        {/* Artist Tracking Limit Banner */}
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
                          className="w-full text-left text-[10px] md:text-xs font-medium text-white px-1.5 py-0.5 rounded truncate hover:opacity-80 transition-opacity cursor-pointer"
                          style={{ backgroundColor: "#FF4B6E" }}
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

        {/* Upcoming Events List */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-6">
            {isCurrentRealMonth
              ? "Upcoming this month"
              : `Events in ${viewDate.toLocaleString("en-US", { month: "long" })}`}
          </h2>
          <div className="space-y-4 relative">
            {upcomingEvents.map((event, index) => {
              const isBlurred = index >= 3
              return (
                <div
                  key={event.id}
                  onClick={() => !isBlurred && handleEventClick(event)}
                  className={`flex items-center justify-between bg-[#1a1a1a] border border-border/30 rounded-xl p-4 transition-colors ${
                    isBlurred ? "blur-[4px] pointer-events-none" : "cursor-pointer hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Date Badge */}
                    <div
                      className="w-14 h-14 rounded-xl flex flex-col items-center justify-center text-white"
                      style={{ backgroundColor: "#FF4B6E" }}
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

            {/* Blur Upsell Overlay - positioned over 4th and 5th events */}
            {upcomingEvents.length > 3 && (
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
