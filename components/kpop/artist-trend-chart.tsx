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
  payload?: Array<{ value?: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#252525] border border-white/10 rounded-lg px-3 py-2 text-sm shadow-lg">
      <p className="text-muted-foreground mb-0.5">{label}</p>
      <p className="text-white font-medium">{fmtViews(payload[0].value ?? 0)} weekly views</p>
    </div>
  )
}

export function ArtistTrendChart({ history }: { history: DataRow[] }) {
  const chartData = history
    .filter((r) => r.youtube_weekly_views !== null)
    .map((r) => ({ date: fmtDate(r.date), views: r.youtube_weekly_views as number }))

  if (chartData.length < 2) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        Not enough data yet — check back soon.
      </div>
    )
  }

  // x축 틱: 최대 5개 균등 분포
  const n = chartData.length
  const positions = [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1]
  const xTicks = [...new Set(positions)].map((i) => chartData[i].date)

  const periodLabel = `${chartData[0].date} — ${chartData[n - 1].date}`

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
            dot={{ fill: "#FF4B6E", r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#FF4B6E", strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
