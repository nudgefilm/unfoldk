"use client"

// /kpop — KpopStats 공개 페이지
// v0 디자인 유지 + /api/kpop/* 데이터 바인딩
// 메인 차트 전면 무료 개방 (비로그인 포함 Top 20 전체 열람)
// Artist Comparison — 로그인 유저 전체 개방 (결제 연동 전 임시)

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import { Search, TrendingUp, TrendingDown, Minus, Flame, BarChart2 } from "lucide-react"
import Link from "next/link"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { ReportButton } from "@/components/common/report-button"
import { Toaster } from "@/components/ui/toaster"
import { ArtistComparisonSection } from "@/components/kpop/artist-comparison"
import { ChartAttackTab } from "@/components/kpop/chart-attack-tab"
import { AuthGate } from "@/components/auth-gate"
import { StartModal } from "@/components/start-modal"
import { hasProAccess } from "@/lib/auth/plan"

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
  // null = 1일치 fallback (어제 데이터 없음, total_views 기준 정렬). number = 어제 대비 증가량.
  views_delta: number | null
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

// /api/kpop/artists 의 item 응답 (검색·More Artists 공용)
interface ArtistListItem {
  id: string
  name: string
  name_ko: string | null
  thumbnail_url: string | null
  member_count: number | null
  has_youtube: boolean
  latest_subscribers: number | null
  latest_total_views: number | null
  latest_listeners: number | null
}

type KpopTab = "charts" | "chart-attack"

export default function KpopStatsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<KpopTab>("charts")
  const tabBarRef = useRef<HTMLDivElement>(null)

  const handleTabChange = (tab: KpopTab) => {
    setActiveTab(tab)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const [kpopStartOpen, setKpopStartOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [chart, setChart] = useState<ChartItem[]>([])
  const [chartLoading, setChartLoading] = useState(true)
  const [trending, setTrending] = useState<TrendingItem[]>([])
  const [trendingLoading, setTrendingLoading] = useState(true)
  // Spotlight 는 차트 #1 자동 표시용 preview. 차트 행/Trending 클릭은 /kpop/[id] 로 navigation.
  const [spotlightId, setSpotlightId] = useState<string | null>(null)
  const [spotlight, setSpotlight] = useState<{
    artist: ArtistDetail
    latest: DailyStats | null
    history: DailyStats[]
  } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isPro, setIsPro] = useState(false)

  // 검색·More Artists 상태 — /api/kpop/artists 로 DB 기반 데이터 (Top 20 외 아티스트 노출용)
  // searchResults === null → 검색 비활성. null 이외이면 검색 결과 모드.
  const [searchResults, setSearchResults] = useState<ArtistListItem[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [moreArtists, setMoreArtists] = useState<ArtistListItem[]>([])

  // 인증 체크 — 로그인 여부 + Pro 플랜 확인 (Chart Attack isPro 분기 포함)
  useEffect(() => {
    let cancelled = false
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return
      if (user) {
        setIsLoggedIn(true)
        supabase
          .from("users")
          .select("plan_type, is_admin, trial_ends_at")
          .eq("id", user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (cancelled) return
            const row = data as { plan_type?: string; is_admin?: boolean; trial_ends_at?: string | null } | null
            setIsPro(hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin, trialEndsAt: row?.trial_ends_at }))
          })
      }
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

  // 검색 — 300ms debounce. 빈 쿼리면 결과 초기화 (= 차트 모드 복귀).
  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length === 0) {
      setSearchResults(null)
      setSearchLoading(false)
      return
    }
    setSearchLoading(true)
    const handle = setTimeout(() => {
      fetch(`/api/kpop/artists?q=${encodeURIComponent(q)}&pageSize=30`)
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((data: { items?: ArtistListItem[] }) => {
          setSearchResults(data.items ?? [])
        })
        .catch((err) => {
          console.error("[kpop] artist search 실패:", err)
          setSearchResults([])
        })
        .finally(() => setSearchLoading(false))
    }, 300)
    return () => clearTimeout(handle)
  }, [searchQuery])

  // More Artists 섹션 데이터 — 차트 로드 후 chart top 외 아티스트를 listeners 순으로.
  // pageSize 50 받아 chart artist_id 제외하고 20명까지.
  useEffect(() => {
    if (chart.length === 0) return
    fetch("/api/kpop/artists?sort=listeners&pageSize=50")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items?: ArtistListItem[] }) => {
        const chartIds = new Set(chart.map((c) => c.artist_id))
        const rest = (data.items ?? []).filter((a) => !chartIds.has(a.id)).slice(0, 21)
        setMoreArtists(rest)
      })
      .catch((err) => {
        console.error("[kpop] more artists fetch 실패:", err)
        setMoreArtists([])
      })
  }, [chart])

  // ─── 주간 KpopStats 스토리텔링 데이터 ──────────────────────
  const [weeklyReport, setWeeklyReport] = useState<string | null>(null)
  const [weeklyInsights, setWeeklyInsights] = useState<
    Array<{ artist_id: string; artist_name: string; insight_text: string }>
  >([])
  const [countryCharts, setCountryCharts] = useState<
    Array<{
      country_code: string
      total_listeners: number
      artists: Array<{ artist_id: string | null; artist_name: string; rank: number; listeners: number | null }>
    }>
  >([])

  useEffect(() => {
    fetch("/api/kpop/weekly-report")
      .then((r) => (r.ok ? r.json() : { report: null }))
      .then((d: { report?: { report_text: string } | null }) => setWeeklyReport(d.report?.report_text ?? null))
      .catch(() => setWeeklyReport(null))
  }, [])

  useEffect(() => {
    fetch("/api/kpop/weekly-insights")
      .then((r) => (r.ok ? r.json() : { insights: [] }))
      .then((d: { insights?: typeof weeklyInsights }) => setWeeklyInsights(d.insights ?? []))
      .catch(() => setWeeklyInsights([]))
  }, [])

  useEffect(() => {
    fetch("/api/kpop/country-charts")
      .then((r) => (r.ok ? r.json() : { charts: [] }))
      .then((d: { charts?: typeof countryCharts }) => setCountryCharts(d.charts ?? []))
      .catch(() => setCountryCharts([]))
  }, [])

  // 국가 풀네임 매핑 — ISO 3166-1 alpha-2 → 표시명 (40개 후보국 + 기타 전체 커버)
  const COUNTRY_NAMES: Record<string, string> = {
    // 아시아
    KR: "South Korea",
    JP: "Japan",
    TW: "Taiwan",
    PH: "Philippines",
    TH: "Thailand",
    ID: "Indonesia",
    MY: "Malaysia",
    SG: "Singapore",
    VN: "Vietnam",
    IN: "India",
    HK: "Hong Kong",
    MN: "Mongolia",
    // 북미
    US: "United States",
    CA: "Canada",
    MX: "Mexico",
    // 남미
    BR: "Brazil",
    AR: "Argentina",
    CL: "Chile",
    CO: "Colombia",
    PE: "Peru",
    // 유럽
    GB: "United Kingdom",
    FR: "France",
    DE: "Germany",
    IT: "Italy",
    ES: "Spain",
    NL: "Netherlands",
    SE: "Sweden",
    NO: "Norway",
    PL: "Poland",
    PT: "Portugal",
    FI: "Finland",
    RU: "Russia",
    CZ: "Czech Republic",
    HU: "Hungary",
    RO: "Romania",
    // 오세아니아
    AU: "Australia",
    NZ: "New Zealand",
    // 중동
    TR: "Turkey",
    SA: "Saudi Arabia",
    AE: "UAE",
    // 기타
    ZA: "South Africa",
    UA: "Ukraine",
    KZ: "Kazakhstan",
    BE: "Belgium",
    AT: "Austria",
    DK: "Denmark",
    IE: "Ireland",
  }

  // 차트 노출 행 — 전면 무료 개방. API 가 already Top 20 반환. 검색 활성 시 차트 섹션 hide.
  const filteredChart = chart

  // 급상승 아티스트 — rank_change > 0 인 아티스트 중 상승폭 기준 상위 3명
  const topMovers = useMemo(
    () =>
      chart
        .filter((c) => c.rank_change !== null && c.rank_change > 0)
        .sort((a, b) => (b.rank_change ?? 0) - (a.rank_change ?? 0))
        .slice(0, 3),
    [chart]
  )

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
      <main className="max-w-[1200px] mx-auto px-6 pt-28 pb-12">
        {/* Page Header */}
        <section className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            KpopStats
          </h1>
          <p className="text-muted-foreground text-lg mb-8">
            Real-time global charts & streaming data
          </p>

          {/* Search Bar — Charts 탭에서만 표시 */}
          {activeTab === "charts" && (
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
          )}
        </section>

        {/* 탭 네비게이션 */}
        <div ref={tabBarRef} className="flex gap-2 mb-8 sticky top-[72px] z-10 bg-[#0d0d0f] py-3">
          <button
            onClick={() => handleTabChange("charts")}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border transition-colors"
            style={
              activeTab === "charts"
                ? { backgroundColor: "#FF4B6E", borderColor: "#FF4B6E", color: "#fff" }
                : { backgroundColor: "#1a1a1a", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }
            }
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Charts
          </button>
          <button
            onClick={() => handleTabChange("chart-attack")}
            className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border transition-colors"
            style={
              activeTab === "chart-attack"
                ? { backgroundColor: "#FF4B6E", borderColor: "#FF4B6E", color: "#fff" }
                : { backgroundColor: "#1a1a1a", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }
            }
          >
            <Flame className="w-3.5 h-3.5" />
            Chart Attack
            {activeTab !== "chart-attack" && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* Chart Attack 탭 */}
        {activeTab === "chart-attack" && (
          <ChartAttackTab isLoggedIn={isLoggedIn} isPro={isPro} onSignUp={() => setKpopStartOpen(true)} />
        )}

        {/* 검색 모드 — searchResults !== null 일 때 차트/Trending 대신 검색 결과만 노출.
            CLAUDE.md §6 KpopStats 노출 원칙: Top 20 외 아티스트 검색 가능해야 함. */}
        {activeTab === "charts" && searchResults !== null && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-white mb-6">
              Search results
              <span className="text-muted-foreground text-base font-normal ml-2">
                ({searchResults.length})
              </span>
            </h2>
            {searchLoading ? (
              <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center text-muted-foreground text-sm">
                Searching...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center text-muted-foreground text-sm">
                No artists match &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {searchResults.map((a) => (
                  <AuthGate key={a.id} isLoggedIn={isLoggedIn}>
                    <ArtistCard item={a} />
                  </AuthGate>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 검색 비활성 — 기본 모드 (Trending / Chart / More Artists / Spotlight / Comparison) */}
        {activeTab === "charts" && searchResults === null && (
        <>
        {/* UnfoldK 주간 K팝 리포트 */}
        {weeklyReport && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-white mb-3">
              This Week in K-pop — UnfoldK Weekly Report
            </h2>
            <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-5">
              <p className="text-sm text-muted-foreground leading-relaxed">{weeklyReport}</p>
            </div>
          </section>
        )}
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
                <AuthGate key={item.artist_id} isLoggedIn={isLoggedIn}>
                <Link
                  href={`/kpop/${item.artist_id}`}
                  className="flex flex-col items-center text-center bg-[#1a1a1a] border border-border/30 rounded-xl p-4 cursor-pointer hover:bg-[#2a2a2c] hover:border-primary/40 transition-colors"
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
                  {/* 2일치 있으면 +delta 초록색, 1일치만 있으면 현재 누적 조회수 회색 표시 */}
                  {item.views_delta !== null ? (
                    <p
                      className="text-xs mt-1 flex items-center gap-1"
                      style={{ color: "#22c55e" }}
                    >
                      <TrendingUp className="w-3 h-3" />
                      +{formatBigNumber(item.views_delta)}
                    </p>
                  ) : (
                    <p className="text-xs mt-1 text-muted-foreground">
                      {formatBigNumber(item.total_views)} views
                    </p>
                  )}
                </Link>
                </AuthGate>
              ))}
            </div>
          )}
        </section>

        {/* This Week's Top Movers — rank_change 상위 3명 자동 선정 */}
        {!chartLoading && topMovers.length > 0 && (
        <section className="mb-12">
          <div className="mb-5">
            <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-green-500" />
              This Week&apos;s Top Movers
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Ranked by biggest rank gain vs. last week
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topMovers.map((item) => {
              const isRocket = (item.rank_change ?? 0) >= 10
              const insight = isRocket
                ? `↑${item.rank_change} Surging this week`
                : `↑${item.rank_change} Rising this week`
              return (
                <AuthGate key={item.artist_id} isLoggedIn={isLoggedIn}>
                <Link
                  href={`/kpop/${item.artist_id}`}
                  className="flex items-center gap-4 bg-[#1a1a1a] border border-border/30 rounded-xl p-4 hover:bg-[#2a2a2c] hover:border-green-500/40 transition-colors"
                >
                  {/* 상승폭 배지 */}
                  <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-green-500/10 flex flex-col items-center justify-center gap-0.5">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span className="text-green-500 font-bold text-sm leading-none">
                      +{item.rank_change}
                    </span>
                  </div>
                  {/* 아티스트 정보 */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
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
                      <p className="text-foreground font-medium truncate">{item.name}</p>
                      {item.name_ko && (
                        <p className="text-muted-foreground text-xs truncate">{item.name_ko}</p>
                      )}
                      <p className="text-green-500 text-xs mt-0.5">{insight}</p>
                    </div>
                  </div>
                </Link>
                </AuthGate>
              )
            })}
          </div>
        </section>
        )}

        {/* Global Chart */}
        <section className="mb-12">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-white">
              Global Chart — Top 20 this week
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Ranked by weekly YouTube view growth
            </p>
          </div>

          {/* 이번 주 아티스트 동향 인사이트 */}
          {weeklyInsights.length > 0 && (
            <div className="mb-4 flex flex-col gap-1.5">
              {weeklyInsights.map((insight) => (
                <p key={insight.artist_id} className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{insight.artist_name}</span>
                  {" — "}
                  {insight.insight_text}
                </p>
              ))}
            </div>
          )}

          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl overflow-hidden overflow-x-auto">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-border/30 text-sm text-muted-foreground font-medium min-w-[640px]">
              <div className="col-span-1">Rank</div>
              <div className="col-span-6">Artist</div>
              <div className="col-span-3 text-right">Last.fm Listeners</div>
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
                <AuthGate key={item.artist_id} isLoggedIn={isLoggedIn} tooltipInside className="w-full border-b border-border/20 last:border-b-0">
                <Link
                  href={`/kpop/${item.artist_id}`}
                  className="w-full grid grid-cols-12 gap-4 px-6 py-4 cursor-pointer hover:bg-[#2a2a2c] transition-colors text-left min-w-[640px]"
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
                  <div className="col-span-6 flex items-center gap-3">
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

                  {/* Last.fm Listeners */}
                  <div className="col-span-3 flex items-center justify-end">
                    <span className="text-foreground">{formatBigNumber(item.lastfm_listeners)}</span>
                  </div>

                  {/* Change */}
                  <div className="col-span-2 flex items-center justify-end">
                    {item.rank_change === null ? (
                      <span className="text-xs font-semibold bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full">NEW</span>
                    ) : item.rank_change >= 10 ? (
                      <span className="text-green-400 font-medium text-sm">↑{item.rank_change} Surging</span>
                    ) : item.rank_change > 0 ? (
                      <span className="text-green-400 font-medium text-sm">↑{item.rank_change} Rising</span>
                    ) : item.rank_change <= -10 ? (
                      <span className="text-red-400 font-medium text-sm">↓{Math.abs(item.rank_change)} Falling fast</span>
                    ) : item.rank_change < 0 ? (
                      <span className="text-red-400 font-medium text-sm">↓{Math.abs(item.rank_change)} Falling</span>
                    ) : null}
                  </div>
                </Link>
                </AuthGate>
              ))
            )}
          </div>

        </section>

        {/* More Artists — Top 20 외 아티스트. listeners 순으로 21명. CLAUDE.md §6 노출 원칙. */}
        {moreArtists.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-white mb-6">More Artists</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {moreArtists.map((a) => (
                <AuthGate key={a.id} isLoggedIn={isLoggedIn}>
                  <ArtistCard item={a} />
                </AuthGate>
              ))}
            </div>
            <div className="flex justify-center mt-6">
              <AuthGate isLoggedIn={isLoggedIn}>
                <Link href="/kpop/artists">
                  <Button variant="outline" className="rounded-full px-6">
                    View all artists
                  </Button>
                </Link>
              </AuthGate>
            </div>
          </section>
        )}

        {/* Artist Spotlight — 차트 #1 자동 preview. 클릭 navigation 은 /kpop/[id] 로 분리. */}
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
                {!isLoggedIn ? (
                  <Button
                    onClick={() => setKpopStartOpen(true)}
                    className="flex-shrink-0 px-6 py-2 rounded-full font-medium text-white whitespace-nowrap"
                    style={{ backgroundColor: "#FF4B6E" }}
                  >
                    Track this artist
                  </Button>
                ) : !isPro ? (
                  <Link
                    href="/pricing"
                    className="flex-shrink-0 px-6 py-2 rounded-full font-medium text-white whitespace-nowrap text-sm"
                    style={{ backgroundColor: "#FF4B6E" }}
                  >
                    Get notified with Hallyu Pass
                  </Link>
                ) : null}
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

        {/* K-pop Around the World — K팝 청취자 합산 상위 20개국 자동 선정, 내림차순 정렬 */}
        {countryCharts.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-white">K-pop Around the World</h2>
              <span className="text-xs text-muted-foreground">Top 20 countries by K-pop listeners</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {countryCharts.map((country) => (
                <div
                  key={country.country_code}
                  className="bg-[#1a1a1a] border border-border/30 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    {/* flag-icons CSS 라이브러리 — fi fi-xx 패턴 (ISO alpha-2 소문자) */}
                    <span
                      className={`fi fi-${country.country_code.toLowerCase()} flex-shrink-0`}
                      style={{ width: "1.33em", height: "1em", fontSize: "1.25rem" }}
                      aria-label={COUNTRY_NAMES[country.country_code] ?? country.country_code}
                    />
                    <span className="text-sm font-medium text-foreground leading-tight">
                      {COUNTRY_NAMES[country.country_code] ?? country.country_code}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {country.artists.map((a) => (
                      <p key={a.rank} className="text-xs text-muted-foreground truncate">
                        <span className="text-foreground font-medium">{a.rank}.</span>{" "}
                        {a.artist_name}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Artist Comparison — 로그인 유저 전체 개방 (2026-05-16 임시 정책) */}
        <ArtistComparisonSection isLoggedIn={isLoggedIn} authChecked={authChecked} />
        </>
        )}
      </main>

      {/* 토스트 컨테이너 — root layout 에 미마운트라 페이지 레벨에서 로컬 마운트.
          ReportButton 의 submit/error 토스트가 silent no-op 되는 것 방지 (CLAUDE.md §10). */}
      <StartModal open={kpopStartOpen} onOpenChange={setKpopStartOpen} next="/kpop" />
      <Toaster />

      <FooterSection />
    </div>
  )
}

// ============================================
// ArtistCard — 검색·More Artists 공용 카드
// Last.fm listeners + YouTube subscribers 표시. YouTube 채널 없으면 "Coming soon".
// CLAUDE.md §6 KpopStats 노출 원칙: YouTube NULL 아티스트는 Last.fm 만 표시.
// ============================================
function ArtistCard({ item }: { item: ArtistListItem }) {
  return (
    <Link
      href={`/kpop/${item.id}`}
      className="bg-[#1a1a1a] border border-border/30 rounded-xl p-4 flex items-center gap-3 hover:bg-[#2a2a2c] hover:border-primary/40 transition-colors"
    >
      {item.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.thumbnail_url}
          alt={item.name}
          className="w-12 h-12 rounded-full object-cover flex-shrink-0 bg-[#252525]"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-[#252525] flex-shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-foreground font-medium truncate">{item.name}</p>
        {item.name_ko && (
          <p className="text-muted-foreground text-xs truncate">{item.name_ko}</p>
        )}
        <div className="flex items-center gap-3 mt-1 text-xs">
          <span className="text-muted-foreground">
            <span className="text-foreground">{formatBigNumber(item.latest_listeners)}</span> listeners
          </span>
          {item.has_youtube ? (
            <span className="text-muted-foreground">
              <span className="text-foreground">{formatBigNumber(item.latest_subscribers)}</span> subs
            </span>
          ) : (
            <span className="text-muted-foreground italic">YouTube coming soon</span>
          )}
        </div>
      </div>
    </Link>
  )
}
