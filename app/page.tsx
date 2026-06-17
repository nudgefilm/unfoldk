import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { HeroSection } from "@/components/hero-section"
import { FloatingCalendarWidget } from "@/components/floating-calendar-widget"
import { BentoSection, type ServiceStats } from "@/components/bento-section"
import { FooterSection } from "@/components/footer-section"
import { AnimatedSection } from "@/components/animated-section"
import { UnauthorizedToast } from "@/components/unauthorized-toast"
import { KpopTop30Chart, type Top30Artist } from "@/components/home/kpop-top30-chart"
import {
  ThisMonthHallyu,
  type ThisMonthHallyuData,
  type MonthEvent,
} from "@/components/home/this-month-hallyu"
import {
  GlobalHallyuPulse,
  type RisingArtist,
  type CountryTopArtist,
  type TopDrama,
} from "@/components/home/global-hallyu-pulse"
import {
  HallyuThisWeek,
  type WeekEvent,
  type WeekDrama,
  type WeekPhrase,
  type WeekRecipe,
} from "@/components/home/hallyu-this-week"
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

interface RawServiceStats {
  calendarEventsThisWeek: number
  dramasCount: number
  phrasesCount: number
  recipesCount: number
  filmingSpotsCount: number
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function parseNewsPreview(summary: string | null): string | null {
  if (!summary) return null
  try { return (JSON.parse(summary) as { p1?: string }).p1 ?? null } catch { return null }
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
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

// ISO week string (e.g. "2026-W25") for food_recipes.featured_week
function getISOWeekString(): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`
}

// ── 데이터 페치 함수 ──────────────────────────────────────────────────────────

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

// ── 섹션 A: THIS MONTH IN HALLYU ─────────────────────────────────────────────

async function fetchThisMonthHallyu(): Promise<ThisMonthHallyuData> {
  const admin = createSupabaseAdminClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" })

  const { data, error } = await admin
    .from("hallyu_calendar_events")
    .select("id, title, type, event_date, artist_or_drama, venue_city, venue_country_code")
    .gte("event_date", monthStart)
    .lte("event_date", monthEnd)
    .order("event_date", { ascending: true })
    .limit(100)

  if (error || !data) {
    return { countryCount: 0, cityCount: 0, topCities: [], comebacks: [], dramaEvents: [], monthLabel }
  }

  const rows = data as {
    id: string; title: string; type: string | null; event_date: string;
    artist_or_drama: string | null; venue_city: string | null; venue_country_code: string | null
  }[]

  const countryCodes = new Set<string>()
  const cities = new Set<string>()
  const cityCounts = new Map<string, number>()

  for (const r of rows) {
    if (r.venue_country_code) countryCodes.add(r.venue_country_code)
    if (r.venue_city) {
      cities.add(r.venue_city)
      cityCounts.set(r.venue_city, (cityCounts.get(r.venue_city) ?? 0) + 1)
    }
  }

  const topCities = [...cityCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([city]) => city)

  const toMonthEvent = (r: typeof rows[number]): MonthEvent => ({
    id: r.id,
    title: r.title,
    artist_or_drama: r.artist_or_drama ?? r.title,
    event_date: r.event_date,
  })

  const dramaEvents = rows.filter(r => r.type === "drama").slice(0, 4).map(toMonthEvent)

  // Comebacks: 이번 달에 없으면 60일 앞까지 upcoming 검색
  const monthComebacks = rows.filter(r => r.type === "comeback").slice(0, 4).map(toMonthEvent)
  let comebacks = monthComebacks
  if (comebacks.length === 0) {
    const sixtyDaysLater = new Date(now.getTime() + 60 * 86400_000).toISOString()
    const { data: upcomingData } = await admin
      .from("hallyu_calendar_events")
      .select("id, title, artist_or_drama, event_date")
      .eq("type", "comeback")
      .gte("event_date", now.toISOString())
      .lte("event_date", sixtyDaysLater)
      .order("event_date", { ascending: true })
      .limit(4)
    type ComingRow = { id: string; title: string; artist_or_drama: string | null; event_date: string }
    comebacks = ((upcomingData ?? []) as ComingRow[]).map(r => ({
      id: r.id,
      title: r.title,
      artist_or_drama: r.artist_or_drama ?? r.title,
      event_date: r.event_date,
    }))
  }

  return {
    countryCount: countryCodes.size,
    cityCount: cities.size,
    topCities,
    comebacks,
    dramaEvents,
    monthLabel,
  }
}

// ── 섹션 B: GLOBAL HALLYU PULSE ──────────────────────────────────────────────

async function fetchRisingArtists(): Promise<RisingArtist[]> {
  const admin = createSupabaseAdminClient()

  const { data: latestRow } = await admin
    .from("kpop_stats_daily")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!latestRow) return []
  const latestDate = (latestRow as { date: string }).date

  // 최신 날짜 상위 30개
  const { data: current } = await admin
    .from("kpop_stats_daily")
    .select("artist_id, lastfm_listeners")
    .eq("date", latestDate)
    .not("lastfm_listeners", "is", null)
    .order("lastfm_listeners", { ascending: false })
    .limit(30)
  if (!current || current.length === 0) return []

  const currentRows = current as { artist_id: string; lastfm_listeners: number }[]
  const artistIds = currentRows.map(r => r.artist_id)

  // 7일 전 청취자 수
  const sevenDaysAgo = new Date(latestDate)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const pastDate = sevenDaysAgo.toISOString().split("T")[0]
  const pastDateMinus2 = new Date(sevenDaysAgo.getTime() - 2 * 86400_000).toISOString().split("T")[0]

  const { data: past } = await admin
    .from("kpop_stats_daily")
    .select("artist_id, lastfm_listeners")
    .in("artist_id", artistIds)
    .lte("date", pastDate)
    .gte("date", pastDateMinus2)
    .not("lastfm_listeners", "is", null)

  const pastMap = new Map<string, number>()
  for (const r of (past ?? []) as { artist_id: string; lastfm_listeners: number }[]) {
    const prev = pastMap.get(r.artist_id)
    if (!prev || r.lastfm_listeners > prev) pastMap.set(r.artist_id, r.lastfm_listeners)
  }

  // 아티스트 이름·이미지 (thumbnail_url: kpop_artists 실제 컬럼명)
  const { data: artists } = await admin
    .from("kpop_artists")
    .select("id, name, thumbnail_url")
    .in("id", artistIds)

  const artistMap = new Map(
    ((artists ?? []) as { id: string; name: string; thumbnail_url: string | null }[])
      .map(a => [a.id, a])
  )

  // 증가량 계산 후 상위 5개
  return currentRows
    .map(r => {
      const pastListeners = pastMap.get(r.artist_id) ?? r.lastfm_listeners
      const change = r.lastfm_listeners - pastListeners
      const artist = artistMap.get(r.artist_id)
      return {
        id: r.artist_id,
        name_en: artist?.name ?? "—",
        image_url: artist?.thumbnail_url ?? null,
        listeners_7d: r.lastfm_listeners,
        listeners_change: change,
      }
    })
    .filter(a => a.listeners_change > 0)
    .sort((a, b) => b.listeners_change - a.listeners_change)
    .slice(0, 5)
}

async function fetchCountryTopArtists(): Promise<CountryTopArtist[]> {
  const admin = createSupabaseAdminClient()

  const { data: latestRow } = await admin
    .from("kpop_country_charts")
    .select("week_start")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!latestRow) return []
  const latestWeek = (latestRow as { week_start: string }).week_start

  const { data, error } = await admin
    .from("kpop_country_charts")
    .select("country_code, artist_name, listeners")
    .eq("week_start", latestWeek)
    .eq("rank", 1)
    .not("artist_name", "is", null)
    .order("listeners", { ascending: false })
    .limit(20)  // dedup 전 여유 확보
  if (error || !data) return []

  // 같은 아티스트가 여러 국가에서 1위일 경우 청취자 수 최대인 국가 하나만 노출
  const seenArtists = new Set<string>()
  return (data as CountryTopArtist[])
    .filter(r => r.artist_name)
    .filter(r => {
      const key = r.artist_name.toLowerCase()
      if (seenArtists.has(key)) return false
      seenArtists.add(key)
      return true
    })
    .slice(0, 10)
}

async function fetchTopDramas(): Promise<TopDrama[]> {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from("dramas")
    .select("id, title, poster_url, year, popularity")
    .eq("is_active", true)
    .not("popularity", "is", null)
    .order("popularity", { ascending: false })
    .limit(5)
  if (error) return []
  return ((data ?? []) as TopDrama[])
}

// ── 섹션 C: HALLYU THIS WEEK ─────────────────────────────────────────────────

async function fetchUpcomingEvents(): Promise<WeekEvent[]> {
  const admin = createSupabaseAdminClient()
  const now = new Date().toISOString()
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await admin
    .from("hallyu_calendar_events")
    .select("id, title, type, event_date, artist_or_drama, venue_city, venue_country_code")
    .eq("is_premium", false)
    .gte("event_date", now)
    .lte("event_date", sevenDaysLater)
    .order("event_date", { ascending: true })
    .limit(5)
  if (error) return []
  return (data ?? []).map(r => ({
    id: (r as { id: string }).id,
    title: (r as { title: string }).title,
    type: (r as { type: string | null }).type ?? "event",
    event_date: (r as { event_date: string }).event_date,
    artist_or_drama: (r as { artist_or_drama: string | null }).artist_or_drama ?? "",
    venue_city: (r as { venue_city: string | null }).venue_city ?? null,
    venue_country_code: (r as { venue_country_code: string | null }).venue_country_code ?? null,
  }))
}

async function fetchThisWeekDramas(): Promise<WeekDrama[]> {
  const admin = createSupabaseAdminClient()
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const { data, error } = await admin
    .from("hallyu_calendar_events")
    .select("id, title, artist_or_drama, event_date")
    .eq("type", "drama")
    .gte("event_date", monday.toISOString())
    .lte("event_date", sunday.toISOString())
    .order("event_date", { ascending: true })
    .limit(5)
  if (error || !data) return []

  return (data as { id: string; title: string; artist_or_drama: string | null; event_date: string }[])
    .map(r => ({
      id: r.id,
      title: r.artist_or_drama ?? r.title,
      event_date: r.event_date,
    }))
}

async function fetchWeeklyPhrase(): Promise<WeekPhrase | null> {
  const admin = createSupabaseAdminClient()
  const seoulNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const today = seoulNow.toISOString().split("T")[0]

  const { data: featured } = await admin
    .from("korean_phrases")
    .select("korean, romanization, english, drama_name")
    .eq("featured_date", today)
    .maybeSingle()
  if (featured) return featured as WeekPhrase

  const { data: latest } = await admin
    .from("korean_phrases")
    .select("korean, romanization, english, drama_name")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return latest ? (latest as WeekPhrase) : null
}

async function fetchWeeklyRecipe(): Promise<WeekRecipe | null> {
  const admin = createSupabaseAdminClient()
  const weekStr = getISOWeekString()

  const { data } = await admin
    .from("food_recipes")
    .select("id, title_en, drama_title")
    .eq("featured_week", weekStr)
    .limit(1)
    .maybeSingle()
  if (data) return data as WeekRecipe

  // 최신 레시피로 폴백
  const { data: latest } = await admin
    .from("food_recipes")
    .select("id, title_en, drama_title")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return latest ? (latest as WeekRecipe) : null
}

// ── 페이지 ────────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  const [
    newsRes,
    svcStatsRes,
    top30Res,
    thisMonthRes,
    risingRes,
    countryTopRes,
    topDramasRes,
    upcomingRes,
    weekDramasRes,
    phraseRes,
    weekRecipeRes,
  ] = await Promise.allSettled([
    fetchLatestGeneratedNews(),
    fetchServiceStats(),
    fetchKpopTop30(),
    fetchThisMonthHallyu(),
    fetchRisingArtists(),
    fetchCountryTopArtists(),
    fetchTopDramas(),
    fetchUpcomingEvents(),
    fetchThisWeekDramas(),
    fetchWeeklyPhrase(),
    fetchWeeklyRecipe(),
  ])

  const news          = newsRes.status        === "fulfilled" ? newsRes.value        : []
  const rawSvc        = svcStatsRes.status    === "fulfilled" ? svcStatsRes.value    : null
  const top30         = top30Res.status       === "fulfilled" ? top30Res.value       : []
  const thisMonth     = thisMonthRes.status   === "fulfilled" ? thisMonthRes.value   : null
  const risingArtists = risingRes.status      === "fulfilled" ? risingRes.value      : []
  const countryTop    = countryTopRes.status  === "fulfilled" ? countryTopRes.value  : []
  const topDramas     = topDramasRes.status   === "fulfilled" ? topDramasRes.value   : []
  const upcoming      = upcomingRes.status    === "fulfilled" ? upcomingRes.value    : []
  const weekDramas    = weekDramasRes.status  === "fulfilled" ? weekDramasRes.value  : []
  const phrase        = phraseRes.status      === "fulfilled" ? phraseRes.value      : null
  const weekRecipe    = weekRecipeRes.status  === "fulfilled" ? weekRecipeRes.value  : null

  const serviceStats: ServiceStats | undefined = rawSvc
    ? {
        calendarEventsThisWeek: rawSvc.calendarEventsThisWeek,
        kpopTopArtist: risingArtists[0]?.name_en ?? null,
        dramasCount: rawSvc.dramasCount,
        phrasesCount: rawSvc.phrasesCount,
        recipesCount: rawSvc.recipesCount,
        filmingSpotsCount: rawSvc.filmingSpotsCount,
      }
    : undefined

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

          {/* ── 섹션 A: THIS MONTH IN HALLYU ─────────────────────────────── */}
          {thisMonth && (
            <AnimatedSection className="relative z-10 max-w-[1320px] mx-auto mt-10 md:mt-14 px-5" delay={0.1}>
              <ThisMonthHallyu {...thisMonth} />
            </AnimatedSection>
          )}

          {/* ── 섹션 B: GLOBAL HALLYU PULSE ──────────────────────────────── */}
          <AnimatedSection className="relative z-10 max-w-[1320px] mx-auto mt-10 md:mt-14 px-5" delay={0.15}>
            <GlobalHallyuPulse
              risingArtists={risingArtists}
              countryTopArtists={countryTop}
              topDramas={topDramas}
            />
          </AnimatedSection>

          {/* ── 섹션 C: HALLYU THIS WEEK ─────────────────────────────────── */}
          <AnimatedSection className="relative z-10 max-w-[1320px] mx-auto mt-10 md:mt-14 px-5" delay={0.15}>
            <HallyuThisWeek
              upcomingEvents={upcoming}
              weeklyDramas={weekDramas}
              phrase={phrase}
              weeklyRecipe={weekRecipe}
            />
          </AnimatedSection>

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

          {/* ── Hallyu Feed 미리보기 ──────────────────────────────────────── */}
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

          <AnimatedSection className="relative z-10 max-w-[1320px] mx-auto mt-4 md:mt-8" delay={0.2}>
            <FooterSection />
          </AnimatedSection>

        </div>
      </div>
    </>
  )
}
