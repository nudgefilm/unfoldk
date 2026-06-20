"use client"

// MonthlyTrendReportCard — Hallyu Pass 전용
// 가장 최근 monthly_trend_reports 1건 표시.
// 데이터 없으면 "First monthly report coming on the 1st" 안내.

import { useEffect, useState } from "react"
import Link from "next/link"
import { TrendingUp, Globe, Tv, CalendarDays } from "lucide-react"

interface TopArtist {
  id: string
  name: string
  change_pct: number
  start_listeners: number
  end_listeners: number
}

interface CountryTrend {
  country_code: string
  start_artist: string
  end_artist: string
  changed: boolean
}

interface TopDrama {
  id: string
  title: string
  genre: string | null
  popularity: number
  platform: string | null
}

interface UpcomingEvent {
  id: string
  title: string
  artist_or_drama: string
  event_date: string
  type: string
}

interface ReportContent {
  data_period: { start: string; end: string }
  top_artists: TopArtist[]
  country_trends: CountryTrend[]
  top_dramas: TopDrama[]
  upcoming_events: UpcomingEvent[]
}

interface MonthlyReport {
  id: string
  year_month: string
  report_content: ReportContent
  summary_text: string
  created_at: string
}

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", KR: "South Korea", JP: "Japan", GB: "United Kingdom",
  BR: "Brazil", PH: "Philippines", TH: "Thailand", ID: "Indonesia",
  MY: "Malaysia", VN: "Vietnam", MX: "Mexico", AU: "Australia",
  CA: "Canada", DE: "Germany", FR: "France", IN: "India",
}

function countryLabel(code: string): string {
  return COUNTRY_NAMES[code] ?? code
}

// YYYY-MM-DD → "June 1, 2026"
function fmtDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  })
}

// YYYY-MM-DDTHH:mm:ssZ → "Jul 15"
function fmtEventDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", timeZone: "UTC",
  })
}

// "2026-06-01" → "June 2026"
function dataPeriodMonth(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "long", year: "numeric", timeZone: "UTC",
  })
}

// 섹션 헤더 공통 스타일
function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <p className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">{label}</p>
    </div>
  )
}

export function MonthlyTrendReportCard() {
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<MonthlyReport | null>(null)

  useEffect(() => {
    fetch("/api/hallyu-pass/monthly-report")
      .then((r) => r.json())
      .then((data: { report?: MonthlyReport | null }) => setReport(data.report ?? null))
      .catch(() => setReport(null))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div
      className="rounded-2xl border border-white/10 p-6 flex flex-col min-h-[160px]"
      style={{ background: "rgba(231,236,235,0.05)" }}
    >
      {/* 로딩 */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div
            className="w-5 h-5 rounded-full border-2 animate-spin"
            style={{ borderColor: "rgba(255,75,110,0.4)", borderTopColor: "transparent" }}
          />
        </div>
      )}

      {/* 데이터 없음 */}
      {!loading && !report && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-4">
          <TrendingUp className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            First monthly report coming on the 1st.
          </p>
        </div>
      )}

      {/* 리포트 표시 */}
      {!loading && report && (() => {
        const c = report.report_content

        return (
          <>
            {/* 리포트 제목 */}
            <div className="mb-1">
              <h2 className="text-base font-semibold text-foreground">
                UnfoldK {dataPeriodMonth(c.data_period.start)} Hallyu Trend Report
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Data period: {fmtDate(c.data_period.start)} – {fmtDate(c.data_period.end)}
              </p>
            </div>

            <div className="mt-5 space-y-5">
              {/* 상위 상승 아티스트 */}
              {c.top_artists.length > 0 && (
                <div>
                  <SectionHeader icon={TrendingUp} label="Top Rising Artists" />
                  <ol className="space-y-1">
                    {c.top_artists.map((a, i) => (
                      <li key={a.id} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground/60 w-4">{i + 1}.</span>
                        <Link
                          href={`/kpop/${a.id}`}
                          className="text-foreground/80 hover:text-white hover:underline transition-colors font-medium"
                        >
                          {a.name}
                        </Link>
                        <span style={{ color: "#4ade80" }}>+{a.change_pct}%</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* 국가별 트렌드 */}
              {c.country_trends.length > 0 && (
                <div>
                  <SectionHeader icon={Globe} label="Trending Countries" />
                  <div className="space-y-1">
                    {c.country_trends.map((ct) => (
                      <div key={ct.country_code} className="flex items-start gap-2 text-xs">
                        <span
                          className="font-medium px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ background: "rgba(255,255,255,0.1)", color: "#ccc" }}
                        >
                          {ct.country_code}
                        </span>
                        <p className="text-muted-foreground leading-tight">
                          {countryLabel(ct.country_code)}:{" "}
                          {ct.changed ? (
                            <>
                              <span className="text-foreground/70">{ct.end_artist}</span>
                              <span className="text-muted-foreground/60">
                                {" "}(was {ct.start_artist})
                              </span>
                            </>
                          ) : (
                            <span className="text-foreground/70">{ct.end_artist}</span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 화제 드라마 */}
              {c.top_dramas.length > 0 && (
                <div>
                  <SectionHeader icon={Tv} label="Most Talked-About Dramas" />
                  <ol className="space-y-1">
                    {c.top_dramas.map((d, i) => (
                      <li key={d.id} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground/60 w-4">{i + 1}.</span>
                        <Link
                          href="/drama"
                          className="text-foreground/80 hover:text-white hover:underline transition-colors font-medium"
                        >
                          {d.title}
                        </Link>
                        {d.genre && (
                          <span className="text-muted-foreground/60">— {d.genre}</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* 다음달 예정 일정 */}
              {c.upcoming_events.length > 0 && (
                <div>
                  <SectionHeader icon={CalendarDays} label="Coming Up Next Month" />
                  <ul className="space-y-1">
                    {c.upcoming_events.map((ev) => (
                      <li key={ev.id} className="flex items-start gap-2 text-xs">
                        <span className="text-muted-foreground/50 mt-0.5">•</span>
                        <p className="text-muted-foreground leading-tight">
                          <span className="text-foreground/70">{ev.artist_or_drama}</span>
                          {" — "}
                          <span className="capitalize">{ev.type}</span>
                          {" — "}
                          {fmtEventDate(ev.event_date)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Claude 생성 인사이트 */}
              {report.summary_text && (
                <div
                  className="pt-4 mt-2 border-t border-white/10"
                >
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {report.summary_text}
                  </p>
                </div>
              )}
            </div>
          </>
        )
      })()}
    </div>
  )
}
