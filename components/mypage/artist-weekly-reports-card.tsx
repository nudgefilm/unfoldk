"use client"

// ArtistWeeklyReportsCard — Hallyu Pass 전용
// 유저의 My Artists 아티스트별 주간 리포트 표시.
// 추적 아티스트 없으면 KpopStats 링크 안내.

import { useEffect, useState } from "react"
import Link from "next/link"
import { Music, TrendingUp, TrendingDown, ExternalLink } from "lucide-react"

interface TopCountry {
  country_code: string
  listeners: number
}

interface ArtistReport {
  week_start: string
  listener_count: number
  listener_change: number
  top_countries: TopCountry[]
  new_events_count: number
  summary_text: string
}

interface ArtistData {
  id: string
  name: string
  report: ArtistReport | null
}

// 숫자 천 단위 구분 (절댓값)
function fmt(n: number): string {
  return Math.abs(n).toLocaleString("en-US")
}

// +/- 부호 포함 포맷
function fmtChange(n: number): string {
  if (n === 0) return "0"
  return `${n > 0 ? "+" : "−"}${fmt(n)}`
}

export function ArtistWeeklyReportsCard() {
  const [loading, setLoading] = useState(true)
  const [artists, setArtists] = useState<ArtistData[]>([])

  useEffect(() => {
    fetch("/api/hallyu-pass/artist-reports")
      .then((r) => r.json())
      .then((data: { artists?: ArtistData[] }) => setArtists(data.artists ?? []))
      .catch(() => setArtists([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div
      className="rounded-2xl border border-white/10 p-6 flex flex-col min-h-[200px]"
      style={{ background: "rgba(231,236,235,0.05)" }}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-4">
        <Music className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">
          This Week&apos;s Artist Reports
        </h2>
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div
            className="w-5 h-5 rounded-full border-2 animate-spin"
            style={{
              borderColor: "rgba(255,75,110,0.4)",
              borderTopColor: "transparent",
            }}
          />
        </div>
      )}

      {/* 추적 아티스트 없음 */}
      {!loading && artists.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-6">
          <p className="text-muted-foreground text-sm leading-relaxed">
            Track an artist in KpopStats to see weekly reports here.
          </p>
          <Link
            href="/kpop"
            className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline transition-colors"
            style={{ color: "#FF4B6E" }}
          >
            Go to KpopStats
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* 아티스트 리포트 목록 */}
      {!loading && artists.length > 0 && (
        <div className="space-y-5">
          {artists.map((artist) => (
            <div
              key={artist.id}
              className="pb-5 border-b border-white/[0.08] last:border-b-0 last:pb-0"
            >
              {/* 아티스트명 (클릭 → /kpop/[id]) */}
              <Link
                href={`/kpop/${artist.id}`}
                className="text-sm font-semibold text-foreground hover:text-white hover:underline transition-colors"
              >
                {artist.name}
              </Link>

              {artist.report ? (
                <div className="mt-2 space-y-2">
                  {/* 리스너 수 + 증감 */}
                  <div className="flex items-start gap-2">
                    {artist.report.listener_change >= 0 ? (
                      <TrendingUp
                        className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                        style={{ color: "#4ade80" }}
                      />
                    ) : (
                      <TrendingDown
                        className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                        style={{ color: "#f87171" }}
                      />
                    )}
                    <p className="text-xs text-muted-foreground leading-tight">
                      Global listeners:{" "}
                      <span className="text-foreground/80">
                        {fmt(artist.report.listener_count)}
                      </span>{" "}
                      <span
                        style={{
                          color:
                            artist.report.listener_change >= 0 ? "#4ade80" : "#f87171",
                        }}
                      >
                        ({fmtChange(artist.report.listener_change)} this week)
                      </span>
                    </p>
                  </div>

                  {/* 국가별 배지 */}
                  {artist.report.top_countries.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">Top countries:</span>
                      {artist.report.top_countries.slice(0, 3).map((c) => (
                        <span
                          key={c.country_code}
                          className="text-xs font-medium px-1.5 py-0.5 rounded"
                          style={{
                            background: "rgba(255,255,255,0.1)",
                            color: "#ccc",
                          }}
                        >
                          {c.country_code}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 이번 주 새 이벤트 */}
                  {artist.report.new_events_count > 0 && (
                    <p className="text-xs font-medium" style={{ color: "#FF4B6E" }}>
                      New events this week: {artist.report.new_events_count}
                    </p>
                  )}

                  {/* Claude 생성 요약 */}
                  {artist.report.summary_text && (
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                      {artist.report.summary_text}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Report for this week is being generated.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
