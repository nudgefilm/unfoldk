import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Sparkles, Flower2 } from "lucide-react"
import { HeroSection } from "@/components/hero-section"
import { FloatingCalendarWidget } from "@/components/floating-calendar-widget"
import { BentoSection, type ServiceStats } from "@/components/bento-section"
import { FooterSection } from "@/components/footer-section"
import { AnimatedSection } from "@/components/animated-section"
import { UnauthorizedToast } from "@/components/unauthorized-toast"
import { MaintenanceModal } from "@/components/maintenance-modal"
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

async function fetchServiceStats(): Promise<ServiceStats | null> {
  const admin = createSupabaseAdminClient()
  const now = new Date().toISOString()
  const sevenDaysLater = new Date(Date.now() + 7 * 86400_000).toISOString()

  const [eventsRes, dramasRes, phrasesRes, recipesRes, spotsRes, topArtistRes] = await Promise.allSettled([
    admin.from("hallyu_calendar_events").select("id", { count: "exact", head: true })
      .gte("event_date", now).lte("event_date", sevenDaysLater),
    admin.from("dramas").select("id", { count: "exact", head: true }),
    admin.from("korean_phrases").select("id", { count: "exact", head: true }),
    admin.from("food_recipes").select("id", { count: "exact", head: true }),
    admin.from("filming_spots").select("id", { count: "exact", head: true }).eq("status", "confirmed"),
    // kpop 상위 1명 아티스트명 (BentoSection KpopStats 카드 liveData용)
    admin.from("kpop_stats_daily")
      .select("date")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  let kpopTopArtist: string | null = null
  if (topArtistRes.status === "fulfilled" && topArtistRes.value.data) {
    const latestDate = (topArtistRes.value.data as { date: string }).date
    const { data: top1 } = await admin
      .from("kpop_stats_daily")
      .select("artist_id")
      .eq("date", latestDate)
      .not("lastfm_listeners", "is", null)
      .order("lastfm_listeners", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (top1) {
      const { data: artist } = await admin
        .from("kpop_artists")
        .select("name")
        .eq("id", (top1 as { artist_id: string }).artist_id)
        .maybeSingle()
      kpopTopArtist = (artist as { name?: string } | null)?.name ?? null
    }
  }

  return {
    calendarEventsThisWeek: eventsRes.status === "fulfilled" ? (eventsRes.value.count ?? 0) : 0,
    kpopTopArtist,
    dramasCount:      dramasRes.status === "fulfilled"  ? (dramasRes.value.count  ?? 0) : 0,
    phrasesCount:     phrasesRes.status === "fulfilled" ? (phrasesRes.value.count ?? 0) : 0,
    recipesCount:     recipesRes.status === "fulfilled" ? (recipesRes.value.count ?? 0) : 0,
    filmingSpotsCount: spotsRes.status === "fulfilled"  ? (spotsRes.value.count   ?? 0) : 0,
  }
}

// ── 페이지 ────────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  const [newsRes, svcStatsRes] = await Promise.allSettled([
    fetchLatestGeneratedNews(),
    fetchServiceStats(),
  ])

  const news         = newsRes.status     === "fulfilled" ? newsRes.value     : []
  const serviceStats = svcStatsRes.status === "fulfilled" ? svcStatsRes.value ?? undefined : undefined

  return (
    <>
      <UnauthorizedToast />
      <MaintenanceModal />
      <div className="min-h-screen bg-background relative overflow-hidden pb-0">
        <FloatingCalendarWidget />
        <div className="relative z-10">

          {/* 히어로 — 수정 금지 */}
          <main className="max-w-[1320px] mx-auto relative">
            <HeroSection />
          </main>

          {/* ── 서비스 카드 그리드 (6개) ────────────────────────────────── */}
          <AnimatedSection id="features-section" className="relative z-10 max-w-[1320px] mx-auto mt-12 md:mt-20" delay={0.1}>
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

          {/* ── Quiz + Korean Name 카드 2개 ──────────────────────────────── */}
          <AnimatedSection className="relative z-10 max-w-[1320px] mx-auto mt-8 md:mt-12 px-5" delay={0.2}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Link
                href="/quiz"
                className="group block bg-[#1a1a1a] border border-white/20 rounded-2xl p-6 hover:border-primary/50 transition-all hover:scale-[1.02] hover:shadow-lg"
              >
                <Sparkles className="w-9 h-9 text-foreground/70 mb-3" />
                <h3 className="text-foreground text-xl font-semibold mb-2">
                  What&apos;s your K-drama type?
                </h3>
                <p className="text-muted-foreground text-base leading-relaxed">
                  7 questions. Find out which K-drama character you really are.
                </p>
              </Link>
              <Link
                href="/name"
                className="group block bg-[#1a1a1a] border border-white/20 rounded-2xl p-6 hover:border-primary/50 transition-all hover:scale-[1.02] hover:shadow-lg"
              >
                <Flower2 className="w-9 h-9 text-foreground/70 mb-3" />
                <h3 className="text-foreground text-xl font-semibold mb-2">
                  Get your Korean name
                </h3>
                <p className="text-muted-foreground text-base leading-relaxed">
                  Discover your Korean name based on your vibe.
                </p>
              </Link>
            </div>
          </AnimatedSection>

          <AnimatedSection className="relative z-10 max-w-[1320px] mx-auto mt-4 md:mt-8" delay={0.2}>
            <FooterSection />
          </AnimatedSection>

        </div>
      </div>
    </>
  )
}
