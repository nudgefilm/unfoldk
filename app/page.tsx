import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { HeroSection } from "@/components/hero-section"
import { FloatingCalendarWidget } from "@/components/floating-calendar-widget"
import { BentoSection, type ServiceStats } from "@/components/bento-section"
import { FooterSection } from "@/components/footer-section"
import { AnimatedSection } from "@/components/animated-section"
import { UnauthorizedToast } from "@/components/unauthorized-toast"
import { YoutubeVideoSection } from "@/components/shared/youtube-video-section"
import { HomePhraseCard, type PhraseData } from "@/components/home/home-phrase-card"
import { HomeCTASection } from "@/components/home/home-cta-section"
import { KpopTop30Chart, type Top30Artist } from "@/components/home/kpop-top30-chart"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "UnfoldK — Your Pass to Korean Culture | K-pop, K-drama & More",
  description:
    "The all-in-one platform for Hallyu fans. Track K-pop charts, discover K-dramas, learn Korean, and explore Korean food — all in one place.",
  alternates: { canonical: "https://www.unfoldk.com" },
  openGraph: {
    title: "UnfoldK — Your Pass to Korean Culture | K-pop, K-drama & More",
    description:
      "The all-in-one platform for Hallyu fans. Track K-pop charts, discover K-dramas, learn Korean, and explore Korean food — all in one place.",
    url: "https://www.unfoldk.com",
  },
}

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface NewsPreview {
  id: string
  title: string
  category: string | null
  summary: string | null
  published_at: string | null
}

interface KpopChartItem {
  rank: number
  name: string
  listeners: number | null
  rankChange: number | null
}

interface EventPreview {
  id: string
  title: string
  type: string | null
  event_date: string
  artist_or_drama: string | null
}

interface DramaPreview {
  id: string
  title: string
  poster_url: string | null
  genre: string | null
}

interface KpopCountryItem {
  countryCode: string
  totalListeners: number
}

interface TopDramaItem {
  id: string
  title: string
  poster_url: string | null
  genre: string | null
  popularity: number | null
}

interface RawServiceStats {
  calendarEventsThisWeek: number
  dramasCount: number
  phrasesCount: number
  recipesCount: number
  filmingSpotsCount: number
}

// ── 데이터 페치 함수 ──────────────────────────────────────────────────────────

function parseNewsPreview(summary: string | null): string | null {
  if (!summary) return null
  try { return (JSON.parse(summary) as { p1?: string }).p1 ?? null } catch { return null }
}

async function fetchLatestGeneratedNews(): Promise<NewsPreview[]> {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from("hallyu_news")
    .select("id, title, category, summary, published_at")
    .eq("content_type", "generated")
    .order("published_at", { ascending: false })
    .limit(3)
  if (error) return []
  return (data ?? []) as NewsPreview[]
}

async function fetchKpopTop5(): Promise<KpopChartItem[]> {
  const admin = createSupabaseAdminClient()

  const { data: latestRow } = await admin
    .from("kpop_stats_daily")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!latestRow) return []
  const latestDate = (latestRow as { date: string }).date

  const { data: current } = await admin
    .from("kpop_stats_daily")
    .select("artist_id, lastfm_listeners")
    .eq("date", latestDate)
    .order("lastfm_listeners", { ascending: false })
    .limit(20)
  if (!current || current.length === 0) return []

  const artistIds = (current as { artist_id: string }[]).map(r => r.artist_id)
  const { data: artists } = await admin
    .from("kpop_artists")
    .select("id, name")
    .in("id", artistIds)

  const nameMap = new Map(
    ((artists ?? []) as { id: string; name: string }[]).map(a => [a.id, a.name])
  )

  const cutoff = new Date(latestDate)
  cutoff.setDate(cutoff.getDate() - 7)
  const cutoffEnd = cutoff.toISOString().split("T")[0]
  const cutoffStart = new Date(cutoff.getTime() - 3 * 86400_000).toISOString().split("T")[0]

  const { data: oldStats } = await admin
    .from("kpop_stats_daily")
    .select("artist_id, lastfm_listeners")
    .lte("date", cutoffEnd)
    .gte("date", cutoffStart)
    .order("lastfm_listeners", { ascending: false })
    .limit(30)

  const oldSorted = ((oldStats ?? []) as { artist_id: string; lastfm_listeners: number | null }[])
    .slice()
    .sort((a, b) => (b.lastfm_listeners ?? 0) - (a.lastfm_listeners ?? 0))
  const oldRankMap = new Map(oldSorted.map((r, i) => [r.artist_id, i + 1]))

  return (current as { artist_id: string; lastfm_listeners: number | null }[])
    .slice(0, 5)
    .map((r, i) => {
      const currentRank = i + 1
      const oldRank = oldRankMap.get(r.artist_id)
      return {
        rank: currentRank,
        name: nameMap.get(r.artist_id) ?? "—",
        listeners: r.lastfm_listeners,
        rankChange: oldRank != null ? oldRank - currentRank : null,
      }
    })
}

async function fetchUpcomingEvents(): Promise<EventPreview[]> {
  const admin = createSupabaseAdminClient()
  const now = new Date().toISOString()
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await admin
    .from("hallyu_calendar_events")
    .select("id, title, type, event_date, artist_or_drama")
    .eq("is_premium", false)
    .gte("event_date", now)
    .lte("event_date", sevenDaysLater)
    .order("event_date", { ascending: true })
    .limit(5)
  if (error) return []
  return (data ?? []) as EventPreview[]
}

async function fetchTodayPhrase(): Promise<PhraseData | null> {
  const admin = createSupabaseAdminClient()
  const seoulNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const today = seoulNow.toISOString().split("T")[0]

  const { data: featured } = await admin
    .from("korean_phrases")
    .select("id, korean, romanization, english, drama_name")
    .eq("featured_date", today)
    .maybeSingle()
  if (featured) return featured as PhraseData

  const { data: latest } = await admin
    .from("korean_phrases")
    .select("id, korean, romanization, english, drama_name")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return latest ? (latest as PhraseData) : null
}

async function fetchLatestDramas(): Promise<DramaPreview[]> {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from("dramas")
    .select("id, title, poster_url, genre")
    .order("year", { ascending: false })
    .order("rating", { ascending: false })
    .limit(6)
  if (error) return []
  return (data ?? []) as DramaPreview[]
}

async function fetchServiceStats(): Promise<RawServiceStats | null> {
  const admin = createSupabaseAdminClient()
  const now = new Date().toISOString()
  const sevenDaysLater = new Date(Date.now() + 7 * 86400_000).toISOString()

  const [eventsRes, dramasRes, phrasesRes, recipesRes, spotsRes] = await Promise.allSettled([
    admin.from("hallyu_calendar_events").select("id", { count: "exact", head: true })
      .gte("event_date", now).lte("event_date", sevenDaysLater),
    admin.from("dramas").select("id", { count: "exact", head: true }),
    admin.from("korean_phrases").select("id", { count: "exact", head: true }),
    admin.from("food_recipes").select("id", { count: "exact", head: true }),
    admin.from("filming_spots").select("id", { count: "exact", head: true }).eq("status", "confirmed"),
  ])

  return {
    calendarEventsThisWeek: eventsRes.status === "fulfilled" ? (eventsRes.value.count ?? 0) : 0,
    dramasCount: dramasRes.status === "fulfilled" ? (dramasRes.value.count ?? 0) : 0,
    phrasesCount: phrasesRes.status === "fulfilled" ? (phrasesRes.value.count ?? 0) : 0,
    recipesCount: recipesRes.status === "fulfilled" ? (recipesRes.value.count ?? 0) : 0,
    filmingSpotsCount: spotsRes.status === "fulfilled" ? (spotsRes.value.count ?? 0) : 0,
  }
}

async function fetchKpopTop30(): Promise<Top30Artist[]> {
  const admin = createSupabaseAdminClient()

  const { data: latestRow } = await admin
    .from("kpop_stats_daily")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!latestRow) return []
  const latestDate = (latestRow as { date: string }).date

  const { data: stats } = await admin
    .from("kpop_stats_daily")
    .select("artist_id, lastfm_listeners")
    .eq("date", latestDate)
    .not("lastfm_listeners", "is", null)
    .order("lastfm_listeners", { ascending: false })
    .limit(30)
  if (!stats || stats.length === 0) return []

  const artistIds = (stats as { artist_id: string }[]).map(r => r.artist_id)
  const { data: artists } = await admin
    .from("kpop_artists")
    .select("id, name")
    .in("id", artistIds)

  const nameMap = new Map(
    ((artists ?? []) as { id: string; name: string }[]).map(a => [a.id, a.name])
  )

  return (stats as { artist_id: string; lastfm_listeners: number }[]).map((r, i) => ({
    id: r.artist_id,
    name: nameMap.get(r.artist_id) ?? "—",
    rank: i + 1,
    listeners: r.lastfm_listeners,
  }))
}

async function fetchKpopByCountry(): Promise<KpopCountryItem[]> {
  const admin = createSupabaseAdminClient()

  // 최신 week_start 조회
  const { data: latestRow } = await admin
    .from("kpop_country_charts")
    .select("week_start")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!latestRow) return []
  const latestWeek = (latestRow as { week_start: string }).week_start

  // 해당 주 전체 행 조회
  const { data, error } = await admin
    .from("kpop_country_charts")
    .select("country_code, listeners")
    .eq("week_start", latestWeek)
  if (error || !data) return []

  // 국가별 리스너 합산
  const countryMap = new Map<string, number>()
  for (const row of (data as { country_code: string; listeners: number | null }[])) {
    if (!row.listeners || row.listeners <= 0) continue
    countryMap.set(row.country_code, (countryMap.get(row.country_code) ?? 0) + row.listeners)
  }

  return [...countryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([countryCode, totalListeners]) => ({ countryCode, totalListeners }))
}

async function fetchTopDramas(): Promise<TopDramaItem[]> {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from("dramas")
    .select("id, title, poster_url, genre, popularity")
    .eq("is_active", true)
    .not("popularity", "is", null)
    .order("popularity", { ascending: false })
    .limit(5)
  if (error) return []
  return (data ?? []) as TopDramaItem[]
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function toFlag(code: string): string {
  return [...code.toUpperCase()].map(c =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  ).join("")
}

const COUNTRY_NAMES: Record<string, string> = {
  KR: "South Korea", US: "United States", JP: "Japan", CN: "China",
  TH: "Thailand", PH: "Philippines", ID: "Indonesia", MY: "Malaysia",
  VN: "Vietnam", TW: "Taiwan", GB: "United Kingdom", CA: "Canada",
  AU: "Australia", FR: "France", DE: "Germany", BR: "Brazil",
  MX: "Mexico", SG: "Singapore", IN: "India", PL: "Poland",
  IT: "Italy", ES: "Spain", RU: "Russia", AR: "Argentina",
  CL: "Chile", PE: "Peru", CO: "Colombia", NL: "Netherlands",
  SE: "Sweden", NO: "Norway", FI: "Finland", DK: "Denmark",
}

function getCountryName(code: string): string {
  return COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase()
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  comeback: "Comeback", drama: "Drama", concert: "Concert", fanmeet: "Fan Meet",
}

const CATEGORY_BADGE: Record<string, string> = {
  kpop:    "bg-purple-500/20 text-purple-300",
  kdrama:  "bg-blue-500/20 text-blue-300",
  kbeauty: "bg-pink-500/20 text-pink-300",
  general: "bg-zinc-500/20 text-zinc-300",
}
const CATEGORY_LABEL: Record<string, string> = {
  kpop: "K-Pop", kdrama: "K-Drama", kbeauty: "K-Beauty", general: "General",
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ── 페이지 ────────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  const [newsRes, kpopRes, eventsRes, phraseRes, dramasRes, svcStatsRes, countryRes, topDramasRes, top30Res] =
    await Promise.allSettled([
      fetchLatestGeneratedNews(),
      fetchKpopTop5(),
      fetchUpcomingEvents(),
      fetchTodayPhrase(),
      fetchLatestDramas(),
      fetchServiceStats(),
      fetchKpopByCountry(),
      fetchTopDramas(),
      fetchKpopTop30(),
    ])

  const news         = newsRes.status       === "fulfilled" ? newsRes.value       : []
  const kpop         = kpopRes.status       === "fulfilled" ? kpopRes.value       : []
  const events       = eventsRes.status     === "fulfilled" ? eventsRes.value     : []
  const phrase       = phraseRes.status     === "fulfilled" ? phraseRes.value     : null
  const dramas       = dramasRes.status     === "fulfilled" ? dramasRes.value     : []
  const rawSvc       = svcStatsRes.status   === "fulfilled" ? svcStatsRes.value   : null
  const countryCharts = countryRes.status   === "fulfilled" ? countryRes.value    : []
  const topDramas    = topDramasRes.status  === "fulfilled" ? topDramasRes.value  : []
  const top30        = top30Res.status      === "fulfilled" ? top30Res.value      : []

  const serviceStats: ServiceStats | undefined = rawSvc
    ? {
        calendarEventsThisWeek: rawSvc.calendarEventsThisWeek,
        kpopTopArtist: kpop[0]?.name ?? null,
        dramasCount: rawSvc.dramasCount,
        phrasesCount: rawSvc.phrasesCount,
        recipesCount: rawSvc.recipesCount,
        filmingSpotsCount: rawSvc.filmingSpotsCount,
      }
    : undefined

  const showDataHub = kpop.length > 0 || events.length > 0
  const showPulse   = countryCharts.length > 0 || topDramas.length > 0

  return (
    <>
      <UnauthorizedToast />
      <div className="min-h-screen bg-background relative overflow-hidden pb-0">
        <FloatingCalendarWidget />
        <div className="relative z-10">

          {/* 히어로 — 수정 금지 */}
          <main className="max-w-[1320px] mx-auto relative">
            <HeroSection />
          </main>

          {/* ── K-pop TOP 30 막대 차트 ──────────────────────────────────── */}
          {top30.length > 0 && (
            <AnimatedSection className="relative z-10 max-w-[1320px] mx-auto mt-10 md:mt-14 px-5" delay={0.15}>
              <KpopTop30Chart artists={top30} />
            </AnimatedSection>
          )}

          {/* ── 서비스 카드 그리드 ──────────────────────────────────────── */}
          <AnimatedSection id="features-section" className="relative z-10 max-w-[1320px] mx-auto mt-12 md:mt-20" delay={0.2}>
            <BentoSection serviceStats={serviceStats} />
          </AnimatedSection>

          {/* ── 섹션 A: Hallyu Feed 미리보기 ─────────────────────────────── */}
          {news.length > 0 && (
            <AnimatedSection className="relative z-10 max-w-[1320px] mx-auto mt-10 md:mt-16 px-5" delay={0.2}>
              <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                  What&apos;s Happening in Hallyu
                </h2>
                <Link
                  href="/hallyu-feed"
                  className="flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ color: "#FF4B6E" }}
                >
                  Read more on Hallyu Feed <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-3">
                {/* featured */}
                {(() => {
                  const item = news[0]
                  if (!item) return null
                  const preview = parseNewsPreview(item.summary)
                  return (
                    <Link
                      href={`/hallyu-feed/${item.id}`}
                      className="group block bg-[#1a1a1a] border border-border/30 rounded-2xl p-6 hover:border-[#FF4B6E]/40 transition-all hover:shadow-[0_0_0_1px_rgba(255,75,110,0.15)] h-full"
                    >
                      <div className="flex flex-col gap-3 h-full">
                        {item.category && (
                          <span className={`self-start text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${CATEGORY_BADGE[item.category] ?? CATEGORY_BADGE.general}`}>
                            {CATEGORY_LABEL[item.category] ?? item.category}
                          </span>
                        )}
                        <p className="text-foreground text-base font-semibold leading-snug line-clamp-2 group-hover:text-[#FF4B6E] transition-colors flex-1">
                          {item.title}
                        </p>
                        {preview && (
                          <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3">
                            {preview}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground/60 pt-2 border-t border-border/20 mt-auto">
                          {item.published_at ? formatShortDate(item.published_at) : ""}
                        </p>
                      </div>
                    </Link>
                  )
                })()}

                {/* 소형 카드 2개 */}
                <div className="flex flex-col gap-3">
                  {news.slice(1, 3).map(item => (
                    <Link
                      key={item.id}
                      href={`/hallyu-feed/${item.id}`}
                      className="group block bg-[#1a1a1a] border border-border/30 rounded-2xl p-5 hover:border-[#FF4B6E]/40 transition-all hover:shadow-[0_0_0_1px_rgba(255,75,110,0.15)] flex-1"
                    >
                      <div className="flex flex-col gap-2 h-full">
                        {item.category && (
                          <span className={`self-start text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${CATEGORY_BADGE[item.category] ?? CATEGORY_BADGE.general}`}>
                            {CATEGORY_LABEL[item.category] ?? item.category}
                          </span>
                        )}
                        <p className="text-foreground text-sm font-semibold leading-snug line-clamp-2 group-hover:text-[#FF4B6E] transition-colors flex-1">
                          {item.title}
                        </p>
                        <p className="text-xs text-muted-foreground/60 pt-2 border-t border-border/20 mt-auto">
                          {item.published_at ? formatShortDate(item.published_at) : ""}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </AnimatedSection>
          )}

          {/* ── 섹션 B: 실시간 데이터 허브 ───────────────────────────────── */}
          {showDataHub && (
            <AnimatedSection className="relative z-10 max-w-[1320px] mx-auto mt-10 md:mt-16 px-5" delay={0.2}>
              <div className="rounded-2xl bg-white/[0.03] border border-border/20 overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2">
                  <div className="p-6 md:border-r border-border/20">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-foreground">This Week&apos;s Global K-pop Chart</h3>
                      <Link href="/kpop" className="text-xs font-medium transition-opacity hover:opacity-80 shrink-0" style={{ color: "#FF4B6E" }}>
                        View full chart →
                      </Link>
                    </div>
                    {kpop.length > 0 ? (
                      <div className="divide-y divide-border/10">
                        {kpop.map(item => (
                          <div key={item.rank} className="flex items-center gap-3 py-2">
                            <span className="w-5 text-center text-xs font-bold text-muted-foreground/60 shrink-0">{item.rank}</span>
                            <span className="flex-1 text-sm font-medium text-foreground truncate">{item.name}</span>
                            {item.rankChange !== null && (
                              <span className={`text-xs font-semibold shrink-0 tabular-nums ${item.rankChange > 0 ? "text-green-400" : item.rankChange < 0 ? "text-red-400" : "text-muted-foreground/40"}`}>
                                {item.rankChange > 0 ? `↑${item.rankChange}` : item.rankChange < 0 ? `↓${Math.abs(item.rankChange)}` : "—"}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/50 py-4">Chart data unavailable</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/40 mt-3">Based on global streaming data</p>
                  </div>

                  <div className="p-6 border-t md:border-t-0">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-foreground">Don&apos;t Miss This Week</h3>
                      <Link href="/calendar" className="text-xs font-medium transition-opacity hover:opacity-80 shrink-0" style={{ color: "#FF4B6E" }}>
                        View full calendar →
                      </Link>
                    </div>
                    {events.length > 0 ? (
                      <div className="divide-y divide-border/10">
                        {events.map(evt => (
                          <div key={evt.id} className="flex items-start gap-3 py-2">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: "rgba(255,75,110,0.10)", color: "#FF4B6E" }}>
                              {EVENT_TYPE_LABEL[evt.type ?? ""] ?? evt.type ?? "Event"}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{evt.title}</p>
                              <p className="text-xs text-muted-foreground/60 mt-0.5">
                                {formatShortDate(evt.event_date)}
                                {evt.artist_or_drama && ` · ${evt.artist_or_drama}`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/50 py-4">No events this week</p>
                    )}
                  </div>
                </div>
              </div>
            </AnimatedSection>
          )}

          {/* ── 섹션 C: Latest K-pop Videos ──────────────────────────────── */}
          <AnimatedSection className="relative z-10 max-w-[1320px] mx-auto mt-10 md:mt-16 px-5" delay={0.2}>
            <YoutubeVideoSection service="kpop" title="Latest K-pop Videos" />
          </AnimatedSection>

          {/* ── 섹션 D: 오늘의 한국어 표현 ──────────────────────────────── */}
          {phrase && (
            <AnimatedSection className="relative z-10 max-w-[1320px] mx-auto mt-10 md:mt-16" delay={0.2}>
              <HomePhraseCard phrase={phrase} />
            </AnimatedSection>
          )}

          {/* ── 섹션 E: K-dramas You Might Love ─────────────────────────── */}
          {dramas.length > 0 && (
            <AnimatedSection className="relative z-10 max-w-[1320px] mx-auto mt-10 md:mt-16 px-5" delay={0.2}>
              <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                  K-dramas You Might Love
                </h2>
                <Link href="/drama" className="flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-80" style={{ color: "#FF4B6E" }}>
                  Find your next K-drama <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {dramas.map(drama => (
                  <Link key={drama.id} href="/drama" className="group relative block rounded-xl overflow-hidden border border-border/30 hover:border-[#FF4B6E]/40 transition-all bg-[#1a1a1a]">
                    <div className="relative aspect-[2/3]">
                      {drama.poster_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={drama.poster_url} alt={drama.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#252528] flex items-center justify-center">
                          <span className="text-muted-foreground/30 text-[10px]">No image</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-3">
                        <div>
                          <p className="text-white text-[11px] font-semibold line-clamp-2">{drama.title}</p>
                          {drama.genre && <p className="text-white/60 text-[9px] mt-0.5">{drama.genre}</p>}
                        </div>
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="text-foreground text-[11px] font-medium line-clamp-1">{drama.title}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </AnimatedSection>
          )}

          {/* ── 섹션 F: Global Hallyu Pulse ──────────────────────────────── */}
          {showPulse && (
            <AnimatedSection className="relative z-10 max-w-[1320px] mx-auto mt-10 md:mt-16 px-5" delay={0.2}>
              <div className="mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">Global Hallyu Pulse</h2>
                <p className="text-sm text-muted-foreground mt-1">Real-time data from Hallyu fans around the world</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* 왼쪽 — K-pop by Country */}
                {countryCharts.length > 0 && (
                  <div className="bg-[#141418] border border-border/30 rounded-2xl p-6">
                    <div className="mb-4">
                      <h3 className="text-sm font-bold text-foreground">K-pop by Country</h3>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">Top countries by K-pop listeners this week</p>
                    </div>
                    <div className="space-y-2.5">
                      {countryCharts.map((item, i) => {
                        const maxListeners = countryCharts[0].totalListeners
                        const barPct = maxListeners > 0 ? (item.totalListeners / maxListeners) * 100 : 0
                        const opacity = Math.max(0.22, 1 - i * 0.086)
                        return (
                          <div key={item.countryCode} className="flex items-center gap-2">
                            <span className="text-base shrink-0 w-6 text-center leading-none">{toFlag(item.countryCode)}</span>
                            <span className="text-xs text-foreground/80 w-24 shrink-0 truncate">{getCountryName(item.countryCode)}</span>
                            <div className="flex-1 flex items-center gap-2 min-w-0">
                              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${barPct}%`,
                                    backgroundColor: `rgba(255,75,110,${opacity})`,
                                  }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground/50 w-14 text-right shrink-0 tabular-nums">
                                {item.totalListeners >= 1_000_000
                                  ? `${(item.totalListeners / 1_000_000).toFixed(1)}M`
                                  : item.totalListeners >= 1_000
                                    ? `${(item.totalListeners / 1_000).toFixed(0)}K`
                                    : item.totalListeners.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground/40 mt-4">Powered by Last.fm</p>
                  </div>
                )}

                {/* 오른쪽 — K-drama Buzz */}
                {topDramas.length > 0 && (
                  <div className="bg-[#141418] border border-border/30 rounded-2xl p-6">
                    <div className="mb-4">
                      <h3 className="text-sm font-bold text-foreground">K-dramas The World Is Watching</h3>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">Most popular right now</p>
                    </div>
                    <div className="divide-y divide-border/10">
                      {topDramas.map((drama, i) => (
                        <Link
                          key={drama.id}
                          href="/drama"
                          className="group flex items-center gap-3 py-2 hover:opacity-80 transition-opacity"
                        >
                          <span
                            className="text-sm font-bold w-5 text-center shrink-0 tabular-nums"
                            style={{ color: "#FF4B6E" }}
                          >
                            {i + 1}
                          </span>
                          {drama.poster_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={drama.poster_url}
                              alt={drama.title}
                              className="w-8 h-12 object-cover rounded shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-12 bg-[#252528] rounded shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate group-hover:text-[#FF4B6E] transition-colors">
                              {drama.title}
                            </p>
                            {drama.genre && (
                              <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground/70">
                                {drama.genre}
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground/40 mt-4">Powered by TMDB</p>
                  </div>
                )}
              </div>
            </AnimatedSection>
          )}

          {/* ── 섹션 G: 하단 CTA ─────────────────────────────────────────── */}
          <AnimatedSection className="relative z-10 max-w-[1320px] mx-auto mt-10 md:mt-16" delay={0.2}>
            <HomeCTASection />
          </AnimatedSection>

          <AnimatedSection className="relative z-10 max-w-[1320px] mx-auto mt-4 md:mt-8" delay={0.2}>
            <FooterSection />
          </AnimatedSection>

        </div>
      </div>
    </>
  )
}
