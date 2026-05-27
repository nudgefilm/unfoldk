"use client"

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"

interface DataRow {
  date: string
  youtube_weekly_views: number | null
}

function fmtViews(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, "") + "B"
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
  if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, "") + "K"
  return v.toLocaleString()
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value?: number | null }>
  label?: string
}) {
  if (!active || !payload?.length || payload[0].value == null) return null
  return (
    <div className="bg-[#252525] border border-white/10 rounded-lg px-3 py-2 text-sm shadow-lg">
      <p className="text-muted-foreground mb-0.5">{label}</p>
      <p className="text-white font-medium">{fmtViews(payload[0].value)} weekly views</p>
    </div>
  )
}

// 오늘 UTC 기준 N일 전 YYYY-MM-DD 반환
function dateStrOffset(daysAgo: number): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

export function ArtistTrendChart({ history }: { history: DataRow[] }) {
  // 실제 데이터 룩업 맵
  const dataMap = new Map<string, number>()
  for (const row of history) {
    if (row.youtube_weekly_views !== null) {
      dataMap.set(row.date, row.youtube_weekly_views)
    }
  }

  // 항상 오늘 기준 30일 전부터 오늘까지 31개 날짜 생성
  // 데이터 없는 날은 null → recharts 가 해당 구간을 빈 공간으로 표시
  const chartData = Array.from({ length: 31 }, (_, i) => {
    const dateStr = dateStrOffset(30 - i)
    return {
      dateStr,
      date: fmtDate(dateStr),
      views: dataMap.get(dateStr) ?? null,
    }
  })

  const hasAnyData = chartData.some((d) => d.views !== null)

  if (!hasAnyData) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        Not enough data yet — check back soon.
      </div>
    )
  }

  // x축 틱: 0, 7, 14, 21, 30 인덱스 (7일 간격 + 오늘)
  const xTicks = [0, 7, 14, 21, 30].map((i) => chartData[i].date)

  const periodLabel = `${chartData[0].date} — ${chartData[30].date}`

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-4">{periodLabel}</p>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="artistTrendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF4B6E" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#FF4B6E" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            ticks={xTicks}
            tick={{ fill: "#888", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            dy={8}
          />
          <YAxis
            tickFormatter={fmtViews}
            tick={{ fill: "#888", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="views"
            stroke="#FF4B6E"
            strokeWidth={2}
            fill="url(#artistTrendGrad)"
            connectNulls={false}
            dot={(dotProps: { cx: number; cy: number; payload: { views: number | null }; key?: string }) => {
              if (dotProps.payload.views == null) return <g key={dotProps.key} />
              return (
                <circle
                  key={dotProps.key}
                  cx={dotProps.cx}
                  cy={dotProps.cy}
                  r={3}
                  fill="#FF4B6E"
                />
              )
            }}
            activeDot={{ r: 5, fill: "#FF4B6E", strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
