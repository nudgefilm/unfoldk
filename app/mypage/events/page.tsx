"use client"

// /mypage/events — 이번 달 구독한 이벤트 목록
// 데이터: /api/mypage/events (user_calendar_subscriptions 기반 이번 달 필터)
// 카드 클릭 → /calendar?event={id}&month={YYYY-MM} (EventDetailModal 자동 오픈)

import { useEffect, useState } from "react"
import Link from "next/link"
import { CalendarDays, ChevronRight } from "lucide-react"
import { MypageShell } from "@/components/mypage/mypage-shell"
import { getEventTypeColor } from "@/lib/calendar/event-type-colors"

interface EventItem {
  id: string
  title: string
  event_date: string
  type: string
  artist_or_drama: string | null
  thumbnail_url: string | null
}

function eventMonthParam(event_date: string): string {
  return event_date.slice(0, 7) // "YYYY-MM"
}

export default function MyEventsPage() {
  return (
    <MypageShell activeLabel="My Events">
      <MyEventsBody />
    </MypageShell>
  )
}

function MyEventsBody() {
  const [items, setItems] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/mypage/events", { cache: "no-store" })
      .then(async (res) => {
        const json = res.ok ? (await res.json().catch(() => ({}))) as { events?: EventItem[] } : {}
        if (!cancelled) setItems(json.events ?? [])
      })
      .catch(() => { if (!cancelled) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">My Events</h1>
          <p className="text-muted-foreground text-sm">
            Upcoming events you&apos;ve set reminders for.
          </p>
        </div>
        <Link
          href="/calendar"
          className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium px-4 h-10 rounded-full text-white whitespace-nowrap flex-shrink-0"
          style={{ backgroundColor: "#FF4B6E" }}
        >
          Browse Calendar
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {loading ? (
        <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center text-muted-foreground text-sm">
          Loading...
        </div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((event) => {
            const href = `/calendar?event=${event.id}&month=${eventMonthParam(event.event_date)}`
            const typeColor = getEventTypeColor(event.type)
            const dateStr = new Date(event.event_date).toLocaleDateString("en-US", {
              month: "short", day: "numeric", timeZone: "UTC",
            })
            return (
              <Link
                key={event.id}
                href={href}
                className="bg-[#1a1a1a] border border-border/30 rounded-xl p-4 hover:border-primary/50 transition-colors flex items-center gap-4"
              >
                {event.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={event.thumbnail_url}
                    alt={event.title}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${typeColor}20` }}
                  >
                    <CalendarDays className="w-6 h-6" style={{ color: typeColor }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight truncate">{event.title}</p>
                  {event.artist_or_drama && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.artist_or_drama}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: `${typeColor}20`, color: typeColor }}
                    >
                      {event.type}
                    </span>
                    <span className="text-xs text-muted-foreground">{dateStr}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </Link>
            )
          })}
        </div>
      )}

      <div className="sm:hidden mt-8">
        <Link
          href="/calendar"
          className="inline-flex items-center gap-1.5 text-sm font-medium px-4 h-10 rounded-full text-white"
          style={{ backgroundColor: "#FF4B6E" }}
        >
          Browse Calendar
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-12 text-center">
      <CalendarDays className="w-10 h-10 mx-auto mb-3" style={{ color: "#FF4B6E" }} />
      <p className="text-foreground font-medium mb-1">No upcoming events</p>
      <p className="text-muted-foreground text-sm mb-5 max-w-md mx-auto">
        Set a reminder on calendar events to track them here.
      </p>
      <Link
        href="/calendar"
        className="inline-flex items-center gap-1.5 text-sm font-medium px-5 h-10 rounded-full text-white"
        style={{ backgroundColor: "#FF4B6E" }}
      >
        Browse Calendar
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
