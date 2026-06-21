"use client"

// WeeklySnapshotSection — 위클리 스냅샷 통계 스트립 + 팬 분포 도넛차트
// /api/hallyu-pass/snapshot 에서 데이터 일괄 조회.

import { useEffect, useState } from "react"
import { CalendarDays, Languages, UtensilsCrossed, Globe } from "lucide-react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"

interface SnapshotData {
  this_week_events: number
  learning_streak: number
  saved_recipes: number
  fan_countries: Array<{ country: string; count: number }>
  total_countries: number
}

// 브랜드 톤 핑크 계열 팔레트
const PIE_COLORS = ["#FF4B6E", "#FF7A94", "#FFB0C0", "#FFC8D4", "#444"]

const STAT_CARDS = [
  {
    key: "this_week_events" as keyof SnapshotData,
    icon: CalendarDays,
    label: "Events this week",
    href: "/calendar",
  },
  {
    key: "learning_streak" as keyof SnapshotData,
    icon: Languages,
    label: "Day streak",
    href: "/korean",
  },
  {
    key: "saved_recipes" as keyof SnapshotData,
    icon: UtensilsCrossed,
    label: "Saved recipes",
    href: "/food",
  },
]

export function WeeklySnapshotSection() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SnapshotData | null>(null)

  useEffect(() => {
    fetch("/api/hallyu-pass/snapshot")
      .then((r) => r.json())
      .then((d: SnapshotData) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-4">
      {/* 좌: 통계 스트립 3개 */}
      <div className="grid grid-cols-3 gap-3">
        {STAT_CARDS.map(({ key, icon: Icon, label }) => (
          <div
            key={key}
            className="rounded-2xl border border-white/10 p-4 flex flex-col gap-2"
            style={{ background: "rgba(231,236,235,0.05)" }}
          >
            <Icon className="w-4 h-4 text-muted-foreground" />
            {loading ? (
              <div className="h-6 w-10 rounded bg-white/10 animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-foreground leading-none">
                {((data?.[key] as number) ?? 0).toLocaleString("en-US")}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* 우: 팬 분포 도넛차트 */}
      <div
        className="rounded-2xl border border-white/10 p-4 flex flex-col"
        style={{ background: "rgba(231,236,235,0.05)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs font-semibold text-foreground/80">Fan Distribution</p>
          {!loading && data && (
            <span className="text-[10px] text-muted-foreground ml-auto">
              {data.total_countries} countries
            </span>
          )}
        </div>

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div
              className="w-4 h-4 rounded-full border-2 animate-spin"
              style={{ borderColor: "rgba(255,75,110,0.4)", borderTopColor: "transparent" }}
            />
          </div>
        )}

        {!loading && data && data.fan_countries.length > 0 && (
          <div className="flex items-center gap-3">
            {/* 도넛 */}
            <div className="w-[96px] h-[96px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.fan_countries}
                    cx="50%"
                    cy="50%"
                    innerRadius={28}
                    outerRadius={44}
                    dataKey="count"
                    isAnimationActive={false}
                    strokeWidth={0}
                  >
                    {data.fan_countries.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload as { country: string; count: number }
                      return (
                        <div
                          className="text-[10px] px-1.5 py-1 rounded"
                          style={{
                            background: "rgba(20,20,24,0.95)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "#ccc",
                          }}
                        >
                          {d.country}: {d.count.toLocaleString()}
                        </div>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 범례 */}
            <div className="flex flex-col gap-1 min-w-0">
              {data.fan_countries.slice(0, 5).map((c, i) => (
                <div key={c.country} className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="text-[10px] text-muted-foreground truncate">
                    {c.country}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && (!data || data.fan_countries.length === 0) && (
          <p className="text-xs text-muted-foreground flex-1 flex items-center">
            No data yet
          </p>
        )}
      </div>
    </div>
  )
}
