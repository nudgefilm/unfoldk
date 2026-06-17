import Link from "next/link"
import { CalendarDays, BookOpen, UtensilsCrossed } from "lucide-react"

export interface WeekEvent {
  id: string
  title: string
  artist_or_drama: string
  event_date: string
  type: string
  venue_city: string | null
  venue_country_code: string | null
}

export interface WeekDrama {
  id: string
  title: string
  event_date: string
}

export interface WeekPhrase {
  korean: string
  romanization: string
  english: string
  drama_name: string | null
}

export interface WeekRecipe {
  id: number
  title_en: string
  drama_title: string | null
}

interface HallyuThisWeekProps {
  upcomingEvents: WeekEvent[]
  weeklyDramas: WeekDrama[]
  phrase: WeekPhrase | null
  weeklyRecipe: WeekRecipe | null
}

function daysUntil(iso: string): number {
  const now = new Date()
  const target = new Date(iso)
  const diff = target.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function HallyuThisWeek({
  upcomingEvents,
  weeklyDramas,
  phrase,
  weeklyRecipe,
}: HallyuThisWeekProps) {
  const hasData =
    upcomingEvents.length > 0 ||
    weeklyDramas.length > 0 ||
    phrase !== null ||
    weeklyRecipe !== null

  if (!hasData) return null

  return (
    <div>
      {/* 헤더 */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-5">
        <h2 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
          HALLYU THIS WEEK
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* D-Day 이벤트 카운트다운 */}
        {upcomingEvents.length > 0 && (
          <div className="bg-[#141418] border border-border/30 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="w-3.5 h-3.5" style={{ color: "#FF4B6E" }} />
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Countdown
              </p>
            </div>
            <div className="space-y-3">
              {upcomingEvents.slice(0, 4).map(ev => {
                const days = daysUntil(ev.event_date)
                return (
                  <div key={ev.id} className="flex items-center gap-2.5">
                    <div
                      className="shrink-0 w-12 text-center rounded-lg py-1.5"
                      style={{ backgroundColor: "rgba(255, 75, 110, 0.08)" }}
                    >
                      {days === 0 ? (
                        <span className="text-xs font-bold" style={{ color: "#FF4B6E" }}>TODAY</span>
                      ) : (
                        <>
                          <span className="block text-base font-bold leading-none" style={{ color: "#FF4B6E" }}>
                            {days}
                          </span>
                          <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wide">
                            days
                          </span>
                        </>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate leading-tight">
                        {ev.artist_or_drama || ev.title}
                      </p>
                      <p className="text-xs text-muted-foreground/50 mt-0.5">
                        {fmt(ev.event_date)}
                        {ev.venue_city ? ` · ${ev.venue_city}` : ""}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
            <Link
              href="/calendar"
              className="mt-4 block text-xs font-medium transition-opacity hover:opacity-80 text-right"
              style={{ color: "#FF4B6E" }}
            >
              Full calendar →
            </Link>
          </div>
        )}

        {/* 이번 주 방영 드라마 */}
        {weeklyDramas.length > 0 && (
          <div className="bg-[#141418] border border-border/30 rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Airing This Week
            </p>
            <div className="space-y-3">
              {weeklyDramas.slice(0, 4).map(d => (
                <div key={d.id} className="flex items-start gap-2">
                  <span
                    className="w-1 h-1 rounded-full mt-2 shrink-0"
                    style={{ backgroundColor: "#FF4B6E" }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground leading-tight truncate">
                      {d.title}
                    </p>
                    <p className="text-xs text-muted-foreground/50 mt-0.5">{fmt(d.event_date)}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/drama"
              className="mt-4 block text-xs font-medium transition-opacity hover:opacity-80 text-right"
              style={{ color: "#FF4B6E" }}
            >
              All dramas →
            </Link>
          </div>
        )}

        {/* 이번 주 한국어 표현 */}
        {phrase && (
          <div className="bg-[#141418] border border-border/30 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-3.5 h-3.5" style={{ color: "#FF4B6E" }} />
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                This Week&apos;s Expression
              </p>
            </div>
            <div>
              <p
                className="text-2xl font-bold leading-tight mb-1"
                style={{ color: "#FF4B6E" }}
              >
                {phrase.korean}
              </p>
              <p className="text-sm text-muted-foreground/80 mb-1">{phrase.romanization}</p>
              <p className="text-sm font-medium text-foreground">{phrase.english}</p>
              {phrase.drama_name && (
                <p className="text-xs text-muted-foreground/50 mt-2">
                  from <span className="italic">{phrase.drama_name}</span>
                </p>
              )}
            </div>
            <Link
              href="/korean"
              className="mt-4 block text-xs font-medium transition-opacity hover:opacity-80 text-right"
              style={{ color: "#FF4B6E" }}
            >
              Learn Korean →
            </Link>
          </div>
        )}

        {/* 이번 주 레시피 */}
        {weeklyRecipe && (
          <div className="bg-[#141418] border border-border/30 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <UtensilsCrossed className="w-3.5 h-3.5" style={{ color: "#FF4B6E" }} />
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                K-Food Spotlight
              </p>
            </div>
            <div>
              <p className="text-base font-bold text-foreground leading-tight mb-1">
                {weeklyRecipe.title_en}
              </p>
              {weeklyRecipe.drama_title && (
                <p className="text-xs text-muted-foreground/60">
                  as seen in <span className="italic">{weeklyRecipe.drama_title}</span>
                </p>
              )}
            </div>
            <Link
              href="/food"
              className="mt-4 block text-xs font-medium transition-opacity hover:opacity-80 text-right"
              style={{ color: "#FF4B6E" }}
            >
              Explore K-Food →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
