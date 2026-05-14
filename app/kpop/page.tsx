"use client"

// /kpop — KpopStats 공개 페이지
// v0 디자인 유지 + /api/kpop/* 데이터 바인딩
// 비회원 Top 5, 로그인 Top 10, 유료(monthly/annual) Top 20+
// Artist Comparison 섹션은 v0 그대로 (Pro 잠금)

import { useEffect, useMemo, useState } from "react"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import { Search, TrendingUp, TrendingDown, Minus, Lock, Flame } from "lucide-react"
import Link from "next/link"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { hasProAccess } from "@/lib/auth/plan"
import { ReportButton } from "@/components/common/report-button"
import { Toaster } from "@/components/ui/toaster"

// ============================================
// 숫자 포맷터 — 2_400_000_000 → "2.4B"
// ============================================
function formatBigNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—"
  const abs = Math.abs(n)
  if (abs >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B"
  if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
  if (abs >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K"
  return n.toLocaleString()
}

interface ChartItem {
  rank: number
  artist_id: string
  name: string
  name_ko: string | null
  thumbnail_url: string | null
  youtube_total_views: number | null
  youtube_weekly_views: number | null
  lastfm_listeners: number | null
  rank_change: number | null
}

interface TrendingItem {
  rank: number
  artist_id: string
  name: string
  name_ko: string | null
  thumbnail_url: string | null
  views_delta: number
  total_views: number
}

interface ArtistDetail {
  id: string
  name: string
  name_ko: string | null
  debut_year: number | null
  thumbnail_url: string | null
  has_youtube: boolean
  has_lastfm: boolean
}

interface DailyStats {
  date: string
  youtube_subscribers: number | null
  youtube_total_views: number | null
  youtube_weekly_views: number | null
  lastfm_listeners: number | null
  lastfm_playcount: number | null
}

type PlanType = "free" | "monthly" | "annual"

export default function KpopStatsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [chart, setChart] = useState<ChartItem[]>([])
  const [chartLoading, setChartLoading] = useState(true)
  const [trending, setTrending] = useState<TrendingItem[]>([])
  const [trendingLoading, setTrendingLoading] = useState(true)
  const [spotlightId, setSpotlightId] = useState<string | null>(null)
  const [spotlight, setSpotlight] = useState<{
    artist: ArtistDetail
    latest: DailyStats | null
    history: DailyStats[]
  } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [planType, setPlanType] = useState<PlanType>("free")
  const [isPro, setIsPro] = useState(false)                 // monthly/annual/admin 통합 판별

  // 인증 + plan_type + is_admin 로드 — 노출 개수 분기용
  useEffect(() => {
    let cancelled = false
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled) return
      if (!user) {
        setAuthChecked(true)
        return
      }
      setIsLoggedIn(true)
      const { data: profile } = await supabase
        .from("users")
        .select("plan_type, is_admin")
        .eq("id", user.id)
        .single()
      if (cancelled) return
      const row = profile as { plan_type?: string; is_admin?: boolean } | null
      const pt = row?.plan_type
      setPlanType(pt === "monthly" || pt === "annual" ? pt : "free")
      setIsPro(hasProAccess({ planType: pt, isAdmin: row?.is_admin }))
      setAuthChecked(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // 차트 로드
  useEffect(() => {
    setChartLoading(true)
    fetch("/api/kpop/charts?limit=20")
      .then((r) => (r.ok ? r.json() : { chart: [] }))
      .then((data: { chart?: ChartItem[] }) => {
        const list = data.chart ?? []
        setChart(list)
        // 기본 spotlight = 1위 아티스트
        if (list.length > 0 && spotlightId === null) {
          setSpotlightId(list[0].artist_id)
        }
      })
      .catch((err) => {
        console.error("[kpop] chart fetch 실패:", err)
        setChart([])
      })
      .finally(() => setChartLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Trending Top 5 로드 — kpop_stats_daily today vs yesterday delta
  useEffect(() => {
    setTrendingLoading(true)
    fetch("/api/kpop/charts/trending?limit=5")
      .then((r) => (r.ok ? r.json() : { trending: [] }))
      .then((data: { trending?: TrendingItem[] }) => {
        setTrending(data.trending ?? [])
      })
      .catch((err) => {
        console.error("[kpop] trending fetch 실패:", err)
        setTrending([])
      })
      .finally(() => setTrendingLoading(false))
  }, [])

  // spotlight 상세 로드
  useEffect(() => {
    if (!spotlightId) return
    fetch(`/api/kpop/artists/${spotlightId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setSpotlight(data ?? null))
      .catch((err) => {
        console.error("[kpop] spotlight fetch 실패:", err)
        setSpotlight(null)
      })
  }, [spotlightId])

  // 노출 개수 분기
  const visibleLimit = !authChecked
    ? 5
    : isPro
    ? 20
    : isLoggedIn
    ? 10
    : 5

  const filteredChart = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const list = q
      ? chart.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.name_ko ?? "").toLowerCase().includes(q)
        )
      : chart
    return list.slice(0, visibleLimit)
  }, [chart, searchQuery, visibleLimit])

  // 트렌드 그래프용 좌표 — youtube_weekly_views 시계열
  const trendPath = useMemo(() => {
    if (!spotlight) return null
    const points = spotlight.history
      .map((h, i) => ({ i, value: h.youtube_weekly_views }))
      .filter((p): p is { i: number; value: number } => p.value !== null)
    if (points.length < 2) return null
    const max = Math.max(...points.map((p) => p.value))
    const min = Math.min(...points.map((p) => p.value))
    const range = Math.max(1, max - min)
    const width = 400
    const height = 80
    const stepX = points.length > 1 ? width / (points.length - 1) : 0
    const coords = points.map((p, idx) => {
      const x = idx * stepX
      const y = height - ((p.value - min) / range) * height
      return { x, y, value: p.value }
    })
    const linePath = coords
      .map((c, i) => (i === 0 ? `M${c.x},${c.y}` : `L${c.x},${c.y}`))
      .join(" ")
    const areaPath = `${linePath} L${width},${height} L0,${height} Z`
    return { coords, linePath, areaPath, width, height }
  }, [spotlight])

  // Last.fm 청취자 7일 증감률 — spotlight.history 에서 클라이언트 계산.
  // 정책: 7일치 미만 / 변동률 0.0% 면 null 반환 (=문구 미표시).
  const lastfmTrend = useMemo(() => {
    if (!spotlight) return null
    type WithListeners = DailyStats & { lastfm_listeners: number }
    const points = spotlight.history.filter(
      (h): h is WithListeners =>
        typeof h.lastfm_listeners === "number" && h.lastfm_listeners > 0
    )
    if (points.length < 2) return null

    const latest = points[points.length - 1]
    const latestTs = new Date(latest.date + "T00:00:00Z").getTime()
    const sevenDaysAgoTs = latestTs - 7 * 24 * 60 * 60 * 1000

    // 최신 기준으로 7일 또는 그 이전인 가장 최근 시점 — 데이터 부족 시 null
    let pastPoint: WithListeners | null = null
    for (let i = points.length - 1; i >= 0; i--) {
      const ts = new Date(points[i].date + "T00:00:00Z").getTime()
      if (ts <= sevenDaysAgoTs) {
        pastPoint = points[i]
        break
      }
    }
    if (!pastPoint) return null

    const percent = ((latest.lastfm_listeners - pastPoint.lastfm_listeners) / pastPoint.lastfm_listeners) * 100
    const rounded = Math.round(percent * 10) / 10
    if (rounded === 0) return null

    return {
      direction: rounded > 0 ? ("up" as const) : ("down" as const),
      percent: Math.abs(rounded).toFixed(1),
    }
  }, [spotlight])

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0d0d0f" }}>
      <main className="max-w-[1200px] mx-auto px-6 py-12">
        {/* Page Header */}
        <section className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            KpopStats
          </h1>
          <p className="text-muted-foreground text-lg mb-8">
            Real-time global charts & streaming data
          </p>

          {/* Search Bar */}
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search artist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-border/30 rounded-full py-3 pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
        </section>

        {/* Today's Trending Top 5 — kpop_stats_daily today vs yesterday delta.
            데이터 부족 (2일치 미만) 시 "Coming soon" placeholder. */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
            <Flame className="w-6 h-6" style={{ color: "#FF4B6E" }} />
            Today&apos;s Trending Top 5
          </h2>
          {trendingLoading ? (
            <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : trending.length === 0 ? (
            <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center">
              <p className="text-foreground font-medium mb-1">Coming soon</p>
              <p className="text-muted-foreground text-sm">
                Daily comparison needs at least 2 days of data.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {trending.map((item) => (
                <button
                  key={item.artist_id}
                  type="button"
                  onClick={() => setSpotlightId(item.artist_id)}
                  className="bg-[#1a1a1a] border border-border/30 rounded-xl p-4 flex flex-col items-center text-center cursor-pointer hover:bg-[#2a2a2c] hover:border-primary/40 transition-colors"
                >
                  {/* Rank badge — 좌상단 absolute 대신 상단 inline */}
                  <span
                    className={`text-xs font-bold mb-2 ${
                      item.rank === 1 ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    #{item.rank}
                  </span>
                  {item.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnail_url}
                      alt={item.name}
                      className="w-16 h-16 rounded-full object-cover bg-[#252525] mb-2"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[#252525] mb-2" />
                  )}
                  <p className="text-foreground font-medium text-sm truncate w-full">
                    {item.name}
                  </p>
                  <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "#22c55e" }}>
                    <TrendingUp className="w-3 h-3" />
                    +{formatBigNumber(item.views_delta)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Global Chart */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-6">
            Global Chart — Top {visibleLimit} this week
          </h2>

          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-border/30 text-sm text-muted-foreground font-medium">
              <div className="col-span-1">Rank</div>
              <div className="col-span-4">Artist</div>
              <div className="col-span-3 text-right">YouTube Views</div>
              <div className="col-span-2 text-right">Last.fm Listeners</div>
              <div className="col-span-2 text-right">Change</div>
            </div>

            {/* Table Rows */}
            {chartLoading ? (
              <div className="px-6 py-10 text-center text-muted-foreground text-sm">
                Loading...
              </div>
            ) : filteredChart.length === 0 ? (
              <div className="px-6 py-10 text-center text-muted-foreground text-sm">
                {searchQuery ? "No artists match your search." : "No data yet — stats are collected daily."}
              </div>
            ) : (
              filteredChart.map((item) => (
                <button
                  key={item.artist_id}
                  type="button"
                  onClick={() => setSpotlightId(item.artist_id)}
                  className="w-full grid grid-cols-12 gap-4 px-6 py-4 border-b border-border/20 last:border-b-0 cursor-pointer hover:bg-[#2a2a2c] transition-colors text-left"
                >
                  {/* Rank Badge */}
                  <div className="col-span-1 flex items-center">
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                        item.rank === 1
                          ? "bg-primary/20 text-primary"
                          : "bg-[#252525] text-foreground"
                      }`}
                    >
                      #{item.rank}
                    </span>
                  </div>

                  {/* Artist Avatar + Name */}
                  <div className="col-span-4 flex items-center gap-3">
                    {/* 원형 프로필 — YouTube 채널 썸네일 fallback 으로 회색 placeholder */}
                    {item.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnail_url}
                        alt={item.name}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0 bg-[#252525]"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#252525] flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <span className="text-foreground font-medium">{item.name}</span>
                      {item.name_ko && (
                        <span className="text-muted-foreground text-xs ml-2">{item.name_ko}</span>
                      )}
                    </div>
                  </div>

                  {/* YouTube Views */}
                  <div className="col-span-3 flex items-center justify-end">
                    <span className="text-foreground">{formatBigNumber(item.youtube_total_views)}</span>
                  </div>

                  {/* Last.fm Listeners */}
                  <div className="col-span-2 flex items-center justify-end">
                    <span className="text-foreground">{formatBigNumber(item.lastfm_listeners)}</span>
                  </div>

                  {/* Change */}
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    {item.rank_change === null ? (
                      <>
                        <Minus className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">—</span>
                      </>
                    ) : item.rank_change > 0 ? (
                      <>
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        <span className="text-green-500 font-medium">+{item.rank_change}</span>
                      </>
                    ) : item.rank_change < 0 ? (
                      <>
                        <TrendingDown className="w-4 h-4 text-red-500" />
                        <span className="text-red-500 font-medium">{item.rank_change}</span>
                      </>
                    ) : (
                      <>
                        <Minus className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">0</span>
                      </>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* 비회원·Free 유저용 업그레이드 안내 */}
          {authChecked && planType === "free" && chart.length > visibleLimit && (
            <div className="mt-4 text-center">
              <Link
                href={isLoggedIn ? "/mypage/subscription" : "/"}
                className="text-sm font-medium hover:underline"
                style={{ color: "#FF4B6E" }}
              >
                {isLoggedIn ? "Upgrade to see full chart →" : "Sign in to see Top 10 →"}
              </Link>
            </div>
          )}
        </section>

        {/* Artist Spotlight */}
        {spotlight && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-white mb-6">
              Artist Spotlight
            </h2>

            <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-6 md:p-8">
              {/* Artist Header */}
              <div className="flex items-start justify-between mb-6 gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  {/* 원형 프로필 — 차트 행과 동일 소스 */}
                  {spotlight.artist.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={spotlight.artist.thumbnail_url}
                      alt={spotlight.artist.name}
                      className="w-16 h-16 rounded-full object-cover flex-shrink-0 bg-[#252525]"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[#252525] flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <h3 className="text-2xl font-bold text-white mb-2">
                      {spotlight.artist.name}
                      {spotlight.artist.name_ko && (
                        <span className="text-muted-foreground text-base font-normal ml-2">
                          {spotlight.artist.name_ko}
                        </span>
                      )}
                    </h3>
                    <div className="flex gap-2 flex-wrap">
                      <span className="px-3 py-1 rounded-full bg-[#252525] text-muted-foreground text-xs">K-pop</span>
                      {spotlight.artist.debut_year && (
                        <span className="px-3 py-1 rounded-full bg-[#252525] text-muted-foreground text-xs">
                          Debut {spotlight.artist.debut_year}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {!isLoggedIn && (
                  <Link href="/" className="flex-shrink-0">
                    <Button
                      className="px-6 py-2 rounded-full font-medium text-white whitespace-nowrap"
                      style={{ backgroundColor: "#FF4B6E" }}
                    >
                      Track this artist
                    </Button>
                  </Link>
                )}
              </div>

              {/* Stats Boxes */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-[#141416] rounded-xl p-4 text-center">
                  <p className="text-muted-foreground text-sm mb-1">YouTube Subscribers</p>
                  <p className="text-2xl font-bold text-white">
                    {formatBigNumber(spotlight.latest?.youtube_subscribers)}
                  </p>
                </div>
                <div className="bg-[#141416] rounded-xl p-4 text-center">
                  <p className="text-muted-foreground text-sm mb-1">Weekly Views</p>
                  <p className="text-2xl font-bold text-white">
                    {formatBigNumber(spotlight.latest?.youtube_weekly_views)}
                  </p>
                </div>
                <div className="bg-[#141416] rounded-xl p-4 text-center">
                  <p className="text-muted-foreground text-sm mb-1">Last.fm Listeners</p>
                  <p className="text-2xl font-bold text-white">
                    {formatBigNumber(spotlight.latest?.lastfm_listeners)}
                  </p>
                  {/* 7일 증감 트렌드 — 데이터 충분 + 변동 있을 때만 노출.
                      up: 그린 (positive 톤) / down: muted-foreground (절제). */}
                  {lastfmTrend && (
                    <p
                      className={
                        lastfmTrend.direction === "up"
                          ? "text-xs mt-1"
                          : "text-xs mt-1 text-muted-foreground"
                      }
                      style={
                        lastfmTrend.direction === "up" ? { color: "#22c55e" } : undefined
                      }
                    >
                      Listeners {lastfmTrend.direction} {lastfmTrend.percent}% this week
                    </p>
                  )}
                </div>
              </div>

              {/* 30일 트렌드 그래프 — 데이터 없으면 안내 메시지 */}
              <div className="bg-[#141416] rounded-xl p-6 h-48 relative overflow-hidden">
                <p className="text-muted-foreground text-sm mb-4">30-Day Trend (weekly views)</p>
                {trendPath ? (
                  <svg
                    className="w-full h-32"
                    viewBox={`0 0 ${trendPath.width} ${trendPath.height}`}
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#FF4B6E" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#FF4B6E" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={trendPath.areaPath} fill="url(#lineGradient)" />
                    <path d={trendPath.linePath} fill="none" stroke="#FF4B6E" strokeWidth="2" />
                    {trendPath.coords.map((c, i) => (
                      <circle key={i} cx={c.x} cy={c.y} r={3} fill="#FF4B6E" />
                    ))}
                  </svg>
                ) : (
                  <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                    Not enough data yet — check back soon.
                  </div>
                )}
              </div>

              {/* Report incorrect info — Spotlight 상세 하단 우측. HallyuCalendar 이벤트 모달 패턴 동일.
                  contentType='artist', contentId=spotlight.artist.id. */}
              <div className="mt-6 pt-4 border-t border-border/20 flex justify-end">
                <ReportButton contentType="artist" contentId={spotlight.artist.id} />
              </div>
            </div>
          </section>
        )}

        {/* Artist Comparison — Pro Feature (v0 그대로 유지) */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-white mb-6">
            Artist Comparison <span className="text-muted-foreground text-base font-normal">(Pro)</span>
          </h2>

          <div className="relative">
            {/* Blurred Cards — isPro 면 블러 해제 */}
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${isPro ? "" : "blur-[4px] pointer-events-none"}`}>
              {/* Card 1 */}
              <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#252525]" />
                  <div>
                    <h4 className="text-white font-medium">BTS</h4>
                    <p className="text-muted-foreground text-sm">75M subscribers</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">YouTube Views</span>
                    <span className="text-white">2.4B</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">Monthly Listeners</span>
                    <span className="text-white">8.2M</span>
                  </div>
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#252525]" />
                  <div>
                    <h4 className="text-white font-medium">BLACKPINK</h4>
                    <p className="text-muted-foreground text-sm">92M subscribers</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">YouTube Views</span>
                    <span className="text-white">1.9B</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">Monthly Listeners</span>
                    <span className="text-white">6.1M</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Overlay */}
            {!isPro && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-[#1a1a1a] border border-border/50 rounded-xl p-6 text-center shadow-xl">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
                  >
                    <Lock className="w-6 h-6" style={{ color: "#FF4B6E" }} />
                  </div>
                  <p className="text-foreground font-medium mb-4">
                    Unlock comparisons with Hallyu Pass
                  </p>
                  <Link href={isLoggedIn ? "/mypage/subscription" : "/"}>
                    <Button
                      className="px-6 py-2 rounded-full font-medium text-white"
                      style={{ backgroundColor: "#FF4B6E" }}
                    >
                      Upgrade — $15/month
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* 토스트 컨테이너 — root layout 에 미마운트라 페이지 레벨에서 로컬 마운트.
          ReportButton 의 submit/error 토스트가 silent no-op 되는 것 방지 (CLAUDE.md §10). */}
      <Toaster />

      <FooterSection />
    </div>
  )
}
