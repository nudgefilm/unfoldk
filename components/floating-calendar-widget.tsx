"use client"

import { useEffect, useState } from "react"
import { Calendar } from "lucide-react"
import {
  getEventTypeColor,
  getEventTypeColorAlpha,
} from "@/lib/calendar/event-type-colors"

type CalendarEvent = {
  id: string
  title: string
  date: number
  type: string
}

export function FloatingCalendarWidget() {
  const [isOpen, setIsOpen] = useState(false)
  // null = 로딩, [] = 비어있음 / 에러
  const [events, setEvents] = useState<CalendarEvent[] | null>(null)

  useEffect(() => {
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    let cancelled = false
    fetch(`/api/calendar/events?month=${month}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((json: { events?: CalendarEvent[] }) => {
        if (!cancelled) setEvents(json.events ?? [])
      })
      .catch(() => {
        if (!cancelled) setEvents([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 그리드 하이라이트는 과거·미래 모두 노출 (이벤트 있는 날 = 타입별 색).
  // 하단 태그 목록은 오늘 이후만, 가까운 순 최대 3건.
  // 동월 총 건수(과거 포함)는 footer 에서 events.length 로 별도 표시.
  const today = new Date().getDate()
  // 같은 날 여러 이벤트면 마지막 것이 win (현재 디자인이 일자당 1건만 표시).
  const eventDays: Record<number, { title: string; type: string }> = Object.fromEntries(
    (events ?? []).map((ev) => [ev.date, { title: ev.title, type: ev.type }])
  )
  const displayed = (events ?? [])
    .filter((ev) => ev.date >= today)
    .sort((a, b) => a.date - b.date)
    .slice(0, 3)

  return (
    <div className="fixed bottom-6 right-5 z-50 flex flex-col gap-3 items-end">
      {/* Expanded Calendar Card */}
      <div
        className={`absolute bottom-[116px] right-0 w-80 origin-bottom-right transition-all duration-200 ${
          isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none"
        }`}
      >
        <div className="bg-[#0d0d0d] border border-border/30 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: "#FF4B6E" }}>
            <h3 className="text-white font-semibold text-sm">K-pop Events · May 2026</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white transition-colors text-lg font-medium leading-none"
              aria-label="Close calendar"
            >
              ×
            </button>
          </div>

          {/* Calendar Content */}
          <div className="p-4">
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 text-xs">
              {/* Day Headers */}
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center text-muted-foreground py-1.5 font-medium">
                  {day}
                </div>
              ))}

              {/* Empty cells for May 2026 starting on Friday */}
              {[...Array(5)].map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}

              {/* Calendar days */}
              {[...Array(31)].map((_, i) => {
                const day = i + 1
                const event = eventDays[day]

                return (
                  <div
                    key={day}
                    className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-all ${
                      event
                        ? "font-semibold"
                        : "text-foreground/70 hover:bg-secondary/30"
                    }`}
                    style={
                      event
                        ? {
                            backgroundColor: getEventTypeColorAlpha(event.type, 0.15),
                            color: getEventTypeColor(event.type),
                          }
                        : undefined
                    }
                    title={event?.title || undefined}
                  >
                    {day}
                  </div>
                )
              })}
            </div>

            {/* Event Tags */}
            <div className="flex flex-col gap-2 mt-4 pt-3 border-t border-border/20">
              {displayed.map((ev) => (
                <div key={ev.id} className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-medium text-white"
                    style={{ backgroundColor: getEventTypeColor(ev.type) }}
                  >
                    May {ev.date}
                  </span>
                  <span className="text-foreground text-xs">{ev.title}</span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <p className="text-muted-foreground text-xs mt-3 pt-3 border-t border-border/20">
              {events === null
                ? "Loading…"
                : `${events.length} events this month`}
            </p>
          </div>
        </div>
      </div>

      {/* Telegram Button */}
      <a
        href="https://t.me/+Mv3BgRXVS94wMzVl"
        target="_blank"
        rel="noopener noreferrer"
        className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-all duration-200 hover:opacity-90"
        style={{ backgroundColor: "#FF4B6E" }}
        aria-label="Join our Telegram"
      >
        <svg className="w-6 h-6 text-white fill-white" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
      </a>

      {/* Calendar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-all duration-200 ${
          isOpen ? "rotate-0" : "animate-pulse"
        }`}
        style={{ backgroundColor: "#FF4B6E" }}
        aria-label={isOpen ? "Close calendar" : "Open calendar"}
      >
        <Calendar className="w-6 h-6 text-white" />
      </button>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(255, 75, 110, 0.4);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(255, 75, 110, 0);
          }
        }
        .animate-pulse {
          animation: pulse 2s infinite;
        }
      `}</style>
    </div>
  )
}
