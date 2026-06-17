import Link from "next/link"
import { Calendar } from "lucide-react"

export interface MonthEvent {
  id: string
  title: string
  artist_or_drama: string
  event_date: string
}

export interface ThisMonthHallyuData {
  countryCount: number
  cityCount: number
  topCities: string[]
  comebacks: MonthEvent[]
  dramaEvents: MonthEvent[]
  monthLabel: string
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function ThisMonthHallyu({
  countryCount,
  cityCount,
  topCities,
  comebacks,
  dramaEvents,
  monthLabel,
}: ThisMonthHallyuData) {
  const hasData = countryCount > 0 || comebacks.length > 0 || dramaEvents.length > 0
  if (!hasData) return null

  return (
    <div>
      {/* 헤더 */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
          THIS MONTH IN HALLYU
        </h2>
        <span className="text-sm text-muted-foreground">{monthLabel}</span>
      </div>

      {/* 국가·도시 통계 바 */}
      {countryCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">This month:</span>
          <span className="font-semibold text-foreground">
            {countryCount} {countryCount === 1 ? "country" : "countries"} ·{" "}
            {cityCount} {cityCount === 1 ? "city" : "cities"} hosting Hallyu events
          </span>
          {topCities.map(city => (
            <span
              key={city}
              className="text-xs px-2 py-0.5 rounded-full border border-border/30 bg-white/[0.03] text-muted-foreground"
            >
              {city}
            </span>
          ))}
        </div>
      )}

      {/* 3열 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 이달 요약 stats */}
        <div className="bg-[#141418] border border-border/30 rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4">
            Hallyu Moments
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Comebacks</span>
              <span className="text-2xl font-bold text-foreground tabular-nums">{comebacks.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Premieres</span>
              <span className="text-2xl font-bold text-foreground tabular-nums">{dramaEvents.length}</span>
            </div>
            {countryCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Countries</span>
                <span className="text-2xl font-bold tabular-nums" style={{ color: "#FF4B6E" }}>
                  {countryCount}
                </span>
              </div>
            )}
          </div>
          <Link
            href="/calendar"
            className="mt-4 flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ color: "#FF4B6E" }}
          >
            <Calendar className="w-3 h-3" />
            View full calendar →
          </Link>
        </div>

        {/* 컴백 */}
        <div className="bg-[#141418] border border-border/30 rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4">
            Comebacks
          </p>
          {comebacks.length > 0 ? (
            <div className="space-y-3">
              {comebacks.map(c => (
                <div key={c.id} className="flex items-start gap-2.5">
                  <span
                    className="w-1 h-1 rounded-full mt-2 shrink-0"
                    style={{ backgroundColor: "#FF4B6E" }}
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground leading-tight">
                      {c.artist_or_drama || c.title}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">{fmt(c.event_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/40 py-2">No comebacks scheduled</p>
          )}
        </div>

        {/* 드라마 방영 예정 */}
        <div className="bg-[#141418] border border-border/30 rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4">
            Premieres
          </p>
          {dramaEvents.length > 0 ? (
            <div className="space-y-3">
              {dramaEvents.map(d => (
                <div key={d.id} className="flex items-start gap-2.5">
                  <span
                    className="w-1 h-1 rounded-full mt-2 shrink-0"
                    style={{ backgroundColor: "#FF4B6E" }}
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground leading-tight">
                      {d.artist_or_drama || d.title}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">{fmt(d.event_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/40 py-2">No premieres scheduled</p>
          )}
        </div>
      </div>
    </div>
  )
}
