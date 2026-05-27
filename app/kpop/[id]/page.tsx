import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ChevronLeft, TrendingUp, Calendar as CalendarIcon, Youtube, Users } from "lucide-react"
import { FooterSection } from "@/components/footer-section"
import { Toaster } from "@/components/ui/toaster"
import { ReportButton } from "@/components/common/report-button"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { getEventTypeColor, getEventTypeColorAlpha } from "@/lib/calendar/event-type-colors"
import { TrackArtistButton } from "./track-artist-button"
import { ArtistTrendChart } from "@/components/kpop/artist-trend-chart"

// /kpop/[id] — 아티스트 상세 페이지 (Server Component)
// 차트 행 / Trending 카드에서 navigation. SEO 친화 + 첫 로드 빠른 SSR.
// ReportButton 만 client island.

const TYPE_TO_DISPLAY = {
  comeback: "K-pop",
  drama: "K-drama",
  concert: "Concert",
  fanmeet: "Fan Meet",
} as const

// 2_400_000_000 → "2.4B" — 차트/Spotlight 와 동일 포맷터
function formatBigNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—"
  const abs = Math.abs(n)
  if (abs >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B"
  if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
  if (abs >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K"
  return n.toLocaleString()
}

interface ArtistRow {
  id: string
  name: string
  name_ko: string | null
  debut_year: number | null
  thumbnail_url: string | null
  youtube_channel_id: string | null
  lastfm_name: string | null
  is_active: boolean
  member_count: number | null
}

interface DailyStatsRow {
  date: string
  youtube_subscribers: number | null
  youtube_total_views: number | null
  youtube_weekly_views: number | null
  youtube_video_count: number | null
  lastfm_listeners: number | null
  lastfm_playcount: number | null
  lastfm_weekly_rank: number | null
}

interface UpcomingEventRow {
  id: string
  type: string
  title: string
  artist_or_drama: string
  event_date: string
  event_time_label: string | null
  is_premium: boolean
  thumbnail_url: string | null
}


// generateMetadata — 아티스트별 OG 태그 + 페이지 타이틀.
// 비활성/미존재 아티스트는 기본 fallback.
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("kpop_artists")
    .select("name, name_ko, thumbnail_url, is_active")
    .eq("id", id)
    .maybeSingle()
  const row = data as Pick<ArtistRow, "name" | "name_ko" | "thumbnail_url" | "is_active"> | null
  if (!row || !row.is_active) {
    return { title: "Artist — KpopStats" }
  }
  const title = row.name_ko ? `${row.name} (${row.name_ko}) — KpopStats` : `${row.name} — KpopStats`
  return {
    title,
    description: `${row.name} stats, YouTube subscribers, Last.fm listeners and upcoming events on Unfold K.`,
    openGraph: row.thumbnail_url
      ? { title, images: [{ url: row.thumbnail_url, alt: row.name }] }
      : { title },
  }
}

export default async function ArtistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  // 1) 아티스트 — anon select 정책 통과 (is_active = true 만 보임)
  const { data: artistData } = await supabase
    .from("kpop_artists")
    .select("id, name, name_ko, debut_year, thumbnail_url, youtube_channel_id, lastfm_name, is_active, member_count")
    .eq("id", id)
    .maybeSingle()

  const artist = artistData as ArtistRow | null
  if (!artist || !artist.is_active) {
    notFound()
  }

  // 2) 최근 30일 stats — service_role 로 안정 조회 (RLS 우회).
  //    /api/kpop/artists/[id] route 와 동일 패턴.
  const admin = createSupabaseAdminClient()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30)
  const cutoff = thirtyDaysAgo.toISOString().slice(0, 10)

  const { data: historyData } = await admin
    .from("kpop_stats_daily")
    .select("date, youtube_subscribers, youtube_total_views, youtube_weekly_views, youtube_video_count, lastfm_listeners, lastfm_playcount, lastfm_weekly_rank")
    .eq("artist_id", id)
    .gte("date", cutoff)
    .order("date", { ascending: true })

  const history = (historyData ?? []) as DailyStatsRow[]
  const latest = history[history.length - 1] ?? null

  // 3) 다가오는 이벤트 — artist_or_drama ILIKE name(_ko).
  //    RLS 가 premium 게이팅 자동 처리 (Free 는 non-premium 만, Pro 는 전체).
  //    KOPIS 는 캘린더 노출 정책에 맞춰 제외.
  const nowIso = new Date().toISOString()
  const orParts = [`artist_or_drama.ilike.%${artist.name}%`]
  if (artist.name_ko) orParts.push(`artist_or_drama.ilike.%${artist.name_ko}%`)
  const { data: eventsData } = await supabase
    .from("hallyu_calendar_events")
    .select("id, type, title, artist_or_drama, event_date, event_time_label, is_premium, thumbnail_url")
    .neq("source_api", "kopis")
    .gte("event_date", nowIso)
    .or(orParts.join(","))
    .order("event_date", { ascending: true })
    .limit(5)
  const upcoming = (eventsData ?? []) as UpcomingEventRow[]

  // Track this artist CTA 는 client island (track-artist-button.tsx) 가 자체적으로
  // auth 상태를 fetch — 서버 측에서 isLoggedIn 분기 불필요.

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0d0d0f" }}>
      <main className="max-w-[1200px] mx-auto px-6 py-12">
        {/* Back link */}
        <Link
          href="/kpop"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm mb-8"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Charts
        </Link>

        {/* Artist Header */}
        <section className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-6 md:p-8 mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-5 min-w-0">
              {/* 원형 프로필 — 차트/Spotlight 와 동일 소스. fallback 회색 placeholder. */}
              {artist.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={artist.thumbnail_url}
                  alt={artist.name}
                  className="w-24 h-24 rounded-full object-cover flex-shrink-0 bg-[#252525]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-[#252525] flex-shrink-0" />
              )}
              <div className="min-w-0">
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                  {artist.name}
                  {artist.name_ko && (
                    <span className="text-muted-foreground text-lg font-normal ml-3">
                      {artist.name_ko}
                    </span>
                  )}
                </h1>
                <div className="flex gap-2 flex-wrap">
                  {/* 장르 — kpop_artists 에 genre 컬럼이 없어 "K-pop" 고정. 향후 컬럼 추가 시 확장. */}
                  <span className="px-3 py-1 rounded-full bg-[#252525] text-muted-foreground text-xs">
                    K-pop
                  </span>
                  {artist.debut_year && (
                    <span className="px-3 py-1 rounded-full bg-[#252525] text-muted-foreground text-xs">
                      Debut {artist.debut_year}
                    </span>
                  )}
                  {/* Solo / N members — kpop_artists.member_count.
                      NULL 은 미분류 (어드민 backfill 대기) — chip 자체 미노출. */}
                  {artist.member_count !== null && (
                    <span className="px-3 py-1 rounded-full bg-[#252525] text-muted-foreground text-xs inline-flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {artist.member_count === 1
                        ? "Solo"
                        : `${artist.member_count} members`}
                    </span>
                  )}
                  {/* 주간 K-pop 차트 순위 — Last.fm tag.getTopArtists 매핑.
                      rank null 이면 chip 미노출. 브랜드 컬러로 강조. */}
                  {latest?.lastfm_weekly_rank != null && (
                    <span
                      className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: "rgba(255, 75, 110, 0.15)",
                        color: "#FF4B6E",
                      }}
                    >
                      #{latest.lastfm_weekly_rank} K-pop this week
                    </span>
                  )}
                </div>
                {/* YouTube 채널 외부 링크 — youtube_channel_id 있을 때만.
                    채널 URL 패턴: youtube.com/channel/<UCxxx>. */}
                {artist.youtube_channel_id && (
                  <a
                    href={`https://www.youtube.com/channel/${artist.youtube_channel_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-xs font-medium border border-border/40 bg-[#1a1a1a] hover:border-border/70 transition-colors text-foreground"
                  >
                    <Youtube className="w-3.5 h-3.5" style={{ color: "#FF4B6E" }} />
                    Watch on YouTube
                  </a>
                )}
              </div>
            </div>
            {/* Track this artist — client island.
                비로그인=StartModal, 미구독=POST(일괄 구독), 구독중=DELETE(일괄 해제).
                매칭 로직은 아래 Upcoming Events 와 동일 (artist_or_drama ILIKE). */}
            <TrackArtistButton artistId={artist.id} artistName={artist.name} />
          </div>
        </section>

        {/* Stats Boxes — YouTube 3개 + Last.fm 2개 = 5개.
            grid-cols 단계 변동: 모바일 2 → md 3 → lg 5 (한 줄). */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-5">
              <p className="text-muted-foreground text-sm mb-1">YouTube Subscribers</p>
              <p className="text-2xl font-bold text-white">
                {formatBigNumber(latest?.youtube_subscribers)}
              </p>
            </div>
            <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-5">
              <p className="text-muted-foreground text-sm mb-1">YouTube Total Views</p>
              <p className="text-2xl font-bold text-white">
                {formatBigNumber(latest?.youtube_total_views)}
              </p>
            </div>
            <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-5">
              <p className="text-muted-foreground text-sm mb-1">Total Videos</p>
              <p className="text-2xl font-bold text-white">
                {formatBigNumber(latest?.youtube_video_count)}
              </p>
            </div>
            <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-5">
              <p className="text-muted-foreground text-sm mb-1">Last.fm Listeners</p>
              <p className="text-2xl font-bold text-white">
                {formatBigNumber(latest?.lastfm_listeners)}
              </p>
            </div>
            <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-5">
              <p className="text-muted-foreground text-sm mb-1">Last.fm Plays</p>
              <p className="text-2xl font-bold text-white">
                {formatBigNumber(latest?.lastfm_playcount)}
              </p>
            </div>
          </div>
        </section>

        {/* 30-Day Trend */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" style={{ color: "#FF4B6E" }} />
            30-Day Trend (weekly views)
          </h2>
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-6">
            <ArtistTrendChart history={history} />
          </div>
        </section>

        {/* Upcoming Events — HallyuCalendar 연계.
            artist_or_drama 가 catalog 와 분리된 string field 라 ILIKE 매칭.
            결과 0건이면 안내 + 캘린더로 보내는 링크. */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" style={{ color: "#FF4B6E" }} />
            Upcoming Events
          </h2>
          {upcoming.length === 0 ? (
            <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-8 text-center">
              <p className="text-foreground font-medium mb-1">No upcoming events</p>
              <p className="text-muted-foreground text-sm">
                Nothing scheduled for {artist.name} right now.{" "}
                <Link href="/calendar" className="hover:underline" style={{ color: "#FF4B6E" }}>
                  Browse the calendar →
                </Link>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((ev) => {
                const displayType = TYPE_TO_DISPLAY[ev.type as keyof typeof TYPE_TO_DISPLAY] ?? "K-pop"
                const eventDate = new Date(ev.event_date)
                const dateLabel = eventDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                })
                return (
                  <Link
                    key={ev.id}
                    href="/calendar"
                    className="block bg-[#1a1a1a] border border-border/30 rounded-xl p-4 hover:bg-[#2a2a2c] hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {/* Date block — 타입 컬러 톤으로 강조 */}
                      <div
                        className="flex-shrink-0 w-16 h-16 rounded-lg flex flex-col items-center justify-center"
                        style={{
                          backgroundColor: getEventTypeColorAlpha(displayType, 0.15),
                          color: getEventTypeColor(displayType),
                        }}
                      >
                        <span className="text-xs font-medium uppercase">
                          {eventDate.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}
                        </span>
                        <span className="text-xl font-bold">{eventDate.getUTCDate()}</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: getEventTypeColorAlpha(displayType, 0.15),
                              color: getEventTypeColor(displayType),
                            }}
                          >
                            {displayType}
                          </span>
                          {ev.is_premium && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#252525] text-muted-foreground">
                              Pro
                            </span>
                          )}
                        </div>
                        <p className="text-foreground font-medium truncate">{ev.title}</p>
                        <p className="text-muted-foreground text-xs mt-0.5">
                          {dateLabel}
                          {ev.event_time_label ? ` · ${ev.event_time_label}` : ""}
                        </p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* Report incorrect info — Spotlight 패턴 동일. contentType='artist'. */}
        <div className="mt-8 pt-4 border-t border-border/20 flex justify-end">
          <ReportButton contentType="artist" contentId={artist.id} />
        </div>
      </main>

      {/* Toaster — root layout 미마운트 (CLAUDE.md §7). ReportButton 토스트 살리려 페이지 마운트. */}
      <Toaster />

      <FooterSection />
    </div>
  )
}
