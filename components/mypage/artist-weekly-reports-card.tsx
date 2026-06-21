"use client"

// ArtistWeeklyReportsCard — Hallyu Pass 전용
// 유저의 My Artists 아티스트별 주간 리포트 표시.
// 추적 아티스트 없으면 KpopStats 링크 안내.

import { useEffect, useState } from "react"
import Link from "next/link"
import { Music, TrendingUp, TrendingDown, ExternalLink } from "lucide-react"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from "recharts"

interface TopCountry {
  country_code: string
  listeners: number
}

interface SparkPoint {
  week_start: string
  listener_count: number
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
  history: SparkPoint[]
}

function fmt(n: number): string {
  return Math.abs(n).toLocaleString("en-US")
}

function fmtChange(n: number): string {
  if (n === 0) return "0"
  return `${n > 0 ? "+" : "−"}${fmt(n)}`
}

// 미니 스파크라인 — 2개 이상 데이터포인트일 때만 렌더
function Sparkline({ data }: { data: SparkPoint[] }) {
  if (data.length < 2) return null

  const chartData = data.map((d) => ({ v: d.listener_count }))
  const vals = chartData.map((d) => d.v)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const isFlat = min === max

  return (
    <div className="w-24 h-8 flex-shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={isFlat ? "#555" : "#FF4B6E"}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              return (
                <div
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(20,20,24,0.9)", color: "#ccc", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  {Number(payload[0].value).toLocaleString("en-US")}
                </div>
              )
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
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

      {/* 아티스트 비교 막대그래프 — 리포트 있는 아티스트 2명 이상일 때만 */}
      {!loading && artists.length > 0 && (() => {
        const chartData = artists
          .filter((a) => a.report !== null)
          .map((a) => ({
            name: a.name.length > 13 ? a.name.slice(0, 13) + "…" : a.name,
            change: a.report!.listener_change,
          }))
        if (chartData.length < 2) return null
        return (
          <div className="mb-5">
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-2">
              Listener change this week
            </p>
            <div style={{ height: chartData.length * 30 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={chartData}
                  margin={{ left: 0, right: 12, top: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    tick={{ fontSize: 10, fill: "#888" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const v = payload[0].value as number
                      return (
                        <div
                          className="text-[10px] px-1.5 py-1 rounded"
                          style={{
                            background: "rgba(20,20,24,0.95)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "#ccc",
                          }}
                        >
                          {v >= 0 ? "+" : ""}{v.toLocaleString()} listeners
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="change" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.change >= 0 ? "#4ade80" : "#f87171"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 border-t border-white/[0.08]" />
          </div>
        )
      })()}

      {/* 아티스트 리포트 목록 */}
      {!loading && artists.length > 0 && (
        <div className="space-y-5">
          {artists.map((artist) => (
            <div
              key={artist.id}
              className="pb-5 border-b border-white/[0.08] last:border-b-0 last:pb-0"
            >
              {/* 아티스트명 + 스파크라인 */}
              <div className="flex items-center justify-between gap-3 mb-2">
                <Link
                  href={`/kpop/${artist.id}`}
                  className="text-sm font-semibold text-foreground hover:text-white hover:underline transition-colors truncate"
                >
                  {artist.name}
                </Link>
                <Sparkline data={artist.history} />
              </div>

              {artist.report ? (
                <div className="space-y-2">
                  {/* 리스너 수 + 증감 */}
                  <div className="flex items-center gap-1.5">
                    {artist.report.listener_change >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#4ade80" }} />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#f87171" }} />
                    )}
                    <p className="text-xs text-muted-foreground leading-tight">
                      <span className="text-foreground/80">{fmt(artist.report.listener_count)}</span>
                      {" global listeners "}
                      <span
                        style={{
                          color: artist.report.listener_change >= 0 ? "#4ade80" : "#f87171",
                        }}
                      >
                        ({fmtChange(artist.report.listener_change)})
                      </span>
                    </p>
                  </div>

                  {/* 국가별 배지 */}
                  {artist.report.top_countries.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {artist.report.top_countries.slice(0, 3).map((c) => (
                        <span
                          key={c.country_code}
                          className="text-[10px] font-medium px-1 py-px rounded"
                          style={{
                            background: "rgba(255,255,255,0.07)",
                            color: "#999",
                            letterSpacing: "0.03em",
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
                      {artist.report.new_events_count} new event{artist.report.new_events_count > 1 ? "s" : ""} this week
                    </p>
                  )}

                  {/* Claude 생성 요약 — 구분선 아래 작은 폰트 */}
                  {artist.report.summary_text && (
                    <p
                      className="text-[11px] text-muted-foreground/70 leading-relaxed pt-2 mt-1 border-t border-white/[0.06]"
                    >
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
