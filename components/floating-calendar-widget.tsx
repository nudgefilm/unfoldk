"use client"

import { useEffect, useState } from "react"
import { Calendar } from "lucide-react"

type CalendarEvent = {
  id: string
  title: string
  date: number
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

  // 그리드 하이라이트는 과거·미래 모두 노출 (이벤트 있는 날 = 핑크).
  // 하단 태그 목록은 오늘 이후만, 가까운 순 최대 3건.
  // 동월 총 건수(과거 포함)는 footer 에서 events.length 로 별도 표시.
  const today = new Date().getDate()
  const eventDays: Record<number, string> = Object.fromEntries(
    (events ?? []).map((ev) => [ev.date, ev.title])
  )
  const displayed = (events ?? [])
    .filter((ev) => ev.date >= today)
    .sort((a, b) => a.date - b.date)
    .slice(0, 3)

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Expanded Calendar Card */}
      <div
        className={`absolute bottom-16 right-0 w-80 origin-bottom-right transition-all duration-200 ${
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
                        ? "bg-[#FF4B6E]/15 text-[#FF4B6E] font-semibold"
                        : "text-foreground/70 hover:bg-secondary/30"
                    }`}
                    title={event || undefined}
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
                    style={{ backgroundColor: "#FF4B6E" }}
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

      {/* Square Button */}
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
