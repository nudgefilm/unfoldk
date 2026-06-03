"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import {
  Home,
  Calendar,
  Music,
  Film,
  Languages,
  UtensilsCrossed,
  MapPin,
  CreditCard,
  Settings,
  ChevronLeft,
  ChevronRight,
  Flame,
  PartyPopper,
  Newspaper,
} from "lucide-react"

const sidebarLinks = [
  { icon: Home, label: "Dashboard", href: "/mypage", active: true },
  { icon: Calendar, label: "My Calendar", href: "/mypage/calendar", active: false },
  { icon: Music, label: "My Artists", href: "/mypage/artists", active: false },
  { icon: Film, label: "My Dramas", href: "/mypage/dramas", active: false },
  { icon: Languages, label: "Learning Progress", href: "/mypage/learning-progress", active: false },
  { icon: UtensilsCrossed, label: "Saved Recipes", href: "/mypage/recipes", active: false },
  { icon: MapPin, label: "My Curation", href: "/mypage/curation", active: false },
  { icon: PartyPopper, label: "My Fan Events", href: "/mypage/fan-events", active: false },
  { icon: Newspaper, label: "Weekly Reports", href: "/mypage/reports", active: false },
  { icon: CreditCard, label: "Subscription", href: "/mypage/subscription", active: false },
  { icon: Settings, label: "Settings", href: "/mypage/settings", active: false },
]

// 대시보드 4 stat — 모두 실데이터 (`/api/mypage/stats` 1 round-trip)
// 로딩 중 "—" / 0건이면 "0".
interface MyStats {
  artistsTracking: number
  eventsUpcoming: number
  streakDays: number
  savedRecipes: number
  masteredPhrases: number
}

interface UpcomingEvent {
  id: string
  title: string
  event_date: string
  type: string
  artist_or_drama: string | null
}

interface NextPhrase {
  id: string
  korean: string
  english: string
  drama_name: string | null
}

// DB plan_type 값 → 사이드바 배지 표시명 매핑
function planLabel(planType: string | null | undefined): string {
  if (planType === "monthly" || planType === "annual") return "Hallyu Pass"
  return "Free"
}

export default function MyPage() {
  const [activeLink, setActiveLink] = useState("Dashboard")
  const [userName, setUserName] = useState<string>("")
  const [userInitial, setUserInitial] = useState<string>("")
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [userPlan, setUserPlan] = useState<string>("Free")
  const [rawPlanType, setRawPlanType] = useState<string | null>(null)
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)
  // 4 stat — null = 로딩 / MyStats = 채워짐. 실패 시 모두 0 으로.
  const [stats, setStats] = useState<MyStats | null>(null)
  // 다가오는 이벤트 + 다음 학습 표현
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([])
  const [nextPhrase, setNextPhrase] = useState<NextPhrase | null>(null)

  // Upcoming Events 가로 스크롤 (← → 화살표)
  const eventsScrollRef = useRef<HTMLDivElement>(null)
  const [eventsCanLeft, setEventsCanLeft] = useState(false)
  const [eventsCanRight, setEventsCanRight] = useState(false)

  const updateEventsScrollState = useCallback(() => {
    const el = eventsScrollRef.current
    if (!el) return
    setEventsCanLeft(el.scrollLeft > 0)
    setEventsCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  const scrollEvents = (dir: "left" | "right") => {
    const el = eventsScrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === "left" ? -el.clientWidth : el.clientWidth, behavior: "smooth" })
  }

  useEffect(() => {
    if (upcomingEvents.length === 0) return
    const raf = requestAnimationFrame(updateEventsScrollState)
    const el = eventsScrollRef.current
    if (!el) return () => cancelAnimationFrame(raf)
    el.addEventListener("scroll", updateEventsScrollState, { passive: true })
    const ro = new ResizeObserver(updateEventsScrollState)
    ro.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener("scroll", updateEventsScrollState)
      ro.disconnect()
    }
  }, [upcomingEvents, updateEventsScrollState])

  useEffect(() => {
    // Supabase 세션 로드 후 Google 프로필 + plan_type 동기화
    // ⚠️ 미로그인 가드는 middleware 가 서버 측에서 처리 — 여기서는 재검증 안 함
    //    (token refresh in-flight 시 false-positive 로 /login 으로 튕기는 문제 회피)
    let cancelled = false
    const supabase = createSupabaseBrowserClient()

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      // 표시 이름: Google full_name → 없으면 이메일 앞부분
      const meta = (user.user_metadata ?? {}) as { full_name?: string; avatar_url?: string }
      const fallbackName = user.email?.split("@")[0] ?? "User"
      const name = meta.full_name?.trim() || fallbackName
      const initial = name.charAt(0).toUpperCase() || "U"

      setUserName(name)
      setUserInitial(initial)
      setUserAvatar(meta.avatar_url ?? null)

      // public.users 의 plan_type + trial_ends_at 조회 (실패 시 Free 유지)
      const { data: profile } = await supabase
        .from("users")
        .select("plan_type, trial_ends_at")
        .eq("id", user.id)
        .single()

      if (!cancelled) {
        const pt = (profile as { plan_type?: string | null; trial_ends_at?: string | null } | null)?.plan_type ?? null
        const ta = (profile as { plan_type?: string | null; trial_ends_at?: string | null } | null)?.trial_ends_at ?? null
        setRawPlanType(pt)
        setTrialEndsAt(ta)
        setUserPlan(planLabel(pt))
      }

      // 4 stat 통합 fetch — /api/mypage/stats
      try {
        const res = await fetch("/api/mypage/stats", { cache: "no-store" })
        if (!res.ok) {
          if (!cancelled) {
            setStats({
              artistsTracking: 0,
              eventsUpcoming: 0,
              streakDays: 0,
              savedRecipes: 0,
              masteredPhrases: 0,
            })
          }
          return
        }
        const json = (await res.json().catch(() => null)) as MyStats | null
        if (!cancelled && json) {
          setStats(json)
        }
      } catch (err) {
        console.warn("[mypage] stats fetch 실패:", err)
        if (!cancelled) {
          setStats({
            artistsTracking: 0,
            eventsUpcoming: 0,
            streakDays: 0,
            savedRecipes: 0,
            masteredPhrases: 0,
          })
        }
      }
    }

    const loadUpcomingEvents = async () => {
      try {
        const res = await fetch("/api/mypage/upcoming-events", { cache: "no-store" })
        if (res.ok && !cancelled) {
          const json = (await res.json()) as { events?: UpcomingEvent[] }
          setUpcomingEvents(json.events ?? [])
        }
      } catch { /* silent — 빈 상태 유지 */ }
    }

    const loadNextPhrase = async () => {
      try {
        const res = await fetch("/api/korean/phrase-of-day", { cache: "no-store" })
        if (res.ok && !cancelled) {
          const json = (await res.json()) as { phrase?: { id: string; korean: string; english: string; dramaName?: string | null } }
          if (json.phrase) {
            setNextPhrase({
              id: json.phrase.id,
              korean: json.phrase.korean,
              english: json.phrase.english,
              drama_name: json.phrase.dramaName ?? null,
            })
          }
        }
      } catch { /* silent */ }
    }

    load()
    loadUpcomingEvents()
    loadNextPhrase()
    return () => {
      cancelled = true
    }
  }, [])

  // stats → 4 stat 카드 — 로딩 중 "—" / 채워지면 그 값.
  const showStat = (v: number | undefined) =>
    stats === null ? "—" : String(v ?? 0)

  const activityStats: Array<{
    label: string
    value: string
    href: string
    suffix?: string
    hasFlame?: boolean
  }> = [
    { label: "Artists Tracking", value: showStat(stats?.artistsTracking), href: "/mypage/artists" },
    { label: "Upcoming Events", value: showStat(stats?.eventsUpcoming), href: "/mypage/events" },
    { label: "Korean Lessons", value: showStat(stats?.masteredPhrases), href: "/mypage/learning-progress" },
    { label: "Saved Recipes", value: showStat(stats?.savedRecipes), href: "/mypage/recipes" },
  ]

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0d0d0f" }}>
      <div className="flex-1 flex max-w-7xl mx-auto w-full px-4 md:px-6 py-8 pb-24 md:pb-8 gap-8">
        {/* Left Sidebar */}
        <aside className="hidden md:flex flex-col w-[240px] flex-shrink-0">
          {/* User Profile */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              {/* Avatar — Google 프로필 사진이 있으면 <img>, 없으면 이니셜 */}
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt={userName}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
                  style={{ backgroundColor: "#FF4B6E" }}
                >
                  {userInitial || "U"}
                </div>
              )}
              <div>
                <p className="text-foreground font-medium">{userName || "—"}</p>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "rgba(255, 75, 110, 0.15)", color: "#FF4B6E" }}
                >
                  {userPlan}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1">
            {sidebarLinks.map((link) => {
              const isActive = link.label === activeLink
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setActiveLink(link.label)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative ${
                    isActive 
                      ? "bg-[#1a1a1a] text-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a]/50"
                  }`}
                >
                  {isActive && (
                    <span 
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                      style={{ backgroundColor: "#FF4B6E" }}
                    />
                  )}
                  <link.icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{link.label}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {/* Section 1: My Activity Stats */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">My Activity</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {activityStats.map((stat) => (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className="bg-[#1a1a1a] border border-border/30 rounded-xl p-4 hover:border-primary/50 transition-colors cursor-pointer block"
                >
                  <p className="text-muted-foreground text-sm mb-1">{stat.label}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-foreground">{stat.value}</span>
                    {stat.hasFlame && <Flame className="w-5 h-5" style={{ color: "#FF4B6E" }} />}
                  </div>
                  {stat.suffix && (
                    <p className="text-muted-foreground text-xs mt-1">{stat.suffix}</p>
                  )}
                </Link>
              ))}
            </div>
          </section>

          {/* Section 2: Upcoming Events */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">Upcoming Events</h2>
              <Link 
                href="/calendar" 
                className="text-sm font-medium flex items-center gap-1 hover:underline"
                style={{ color: "#FF4B6E" }}
              >
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            {upcomingEvents.length === 0 ? (
              <p className="text-muted-foreground text-sm py-2">No upcoming events. <Link href="/calendar" className="hover:underline" style={{ color: "#FF4B6E" }}>Browse calendar →</Link></p>
            ) : (
              <div className="relative">
                <div
                  ref={eventsScrollRef}
                  className="flex gap-4 overflow-x-auto [&::-webkit-scrollbar]:hidden"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  {upcomingEvents.map((event) => {
                    const d = new Date(event.event_date)
                    const dayNum = d.getUTCDate()
                    const monthStr = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase()
                    const monthParam = event.event_date.slice(0, 7)
                    return (
                      <Link
                        key={event.id}
                        href={`/calendar?event=${event.id}&month=${monthParam}`}
                        className="flex-shrink-0 w-[200px] bg-[#1a1a1a] border border-border/30 rounded-xl p-4 hover:border-primary/50 transition-colors cursor-pointer block"
                      >
                        <div
                          className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white mb-3"
                          style={{ backgroundColor: "#FF4B6E" }}
                        >
                          <span className="text-[10px] font-medium">{monthStr}</span>
                          <span className="text-lg font-bold">{dayNum}</span>
                        </div>
                        <h3 className="text-foreground font-medium text-sm mb-1 truncate">{event.title}</h3>
                        <span className="text-muted-foreground text-xs">{event.type}</span>
                      </Link>
                    )
                  })}
                </div>
                {eventsCanLeft && (
                  <button
                    type="button"
                    onClick={() => scrollEvents("left")}
                    aria-label="Scroll events left"
                    className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-[#1a1a1a]/90 backdrop-blur-sm border border-border/30 items-center justify-center text-foreground hover:bg-[#1a1a1a]"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                {eventsCanRight && (
                  <button
                    type="button"
                    onClick={() => scrollEvents("right")}
                    aria-label="Scroll events right"
                    className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-[#1a1a1a]/90 backdrop-blur-sm border border-border/30 items-center justify-center text-foreground hover:bg-[#1a1a1a]"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Section 3: Continue Learning */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">Continue Learning</h2>
            <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <p className="text-muted-foreground text-sm mb-2">Today&apos;s phrase</p>
                  <p className="text-2xl font-bold text-foreground mb-1">
                    {nextPhrase ? nextPhrase.korean : "—"}
                  </p>
                  <p className="text-muted-foreground">
                    {nextPhrase ? `"${nextPhrase.english}"` : ""}
                  </p>
                  {nextPhrase?.drama_name && (
                    <p className="text-sm mt-3">
                      <span className="text-muted-foreground">From: </span>
                      <span className="text-foreground">{nextPhrase.drama_name}</span>
                    </p>
                  )}

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">
                        Day {stats?.streakDays ?? 0} of streak
                      </span>
                      <span className="flex items-center gap-1" style={{ color: "#FF4B6E" }}>
                        <Flame className="w-4 h-4" /> {stats?.streakDays ?? 0}
                      </span>
                    </div>
                    <div className="h-2 bg-[#252525] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: "#FF4B6E",
                          width: `${Math.min(100, ((stats?.streakDays ?? 0) / 30) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <Link href={nextPhrase ? `/korean?phrase_id=${nextPhrase.id}` : "/korean"}>
                  <Button
                    className="px-6 py-2 rounded-full font-medium text-white md:self-end"
                    style={{ backgroundColor: "#FF4B6E" }}
                  >
                    Continue
                  </Button>
                </Link>
              </div>
            </div>
          </section>

          {/* Section 4: Subscription */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">Subscription</h2>
            <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  {rawPlanType === "monthly" || rawPlanType === "annual" ? (
                    <>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-foreground font-semibold text-lg">Hallyu Pass</span>
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: "rgba(34, 197, 94, 0.15)", color: "#22c55e" }}
                        >
                          Active
                        </span>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        {rawPlanType === "annual" ? "Annual plan · $6/month" : "Monthly plan · $9/month"}
                      </p>
                    </>
                  ) : trialEndsAt && new Date(trialEndsAt) > new Date() ? (
                    <>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-foreground font-semibold text-lg">Free Trial</span>
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: "rgba(251, 191, 36, 0.15)", color: "#fbbf24" }}
                        >
                          Trial
                        </span>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        Expires{" "}
                        <span className="text-foreground">
                          {new Date(trialEndsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-foreground font-semibold text-lg">Free Plan</span>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        Upgrade to unlock all 6 services.
                      </p>
                    </>
                  )}
                </div>

                <Link
                  href="/mypage/subscription"
                  className="text-sm font-medium hover:underline"
                  style={{ color: "#FF4B6E" }}
                >
                  {rawPlanType === "monthly" || rawPlanType === "annual" ? "Manage subscription" : "Upgrade to Hallyu Pass"}
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* 모바일 하단 탭 내비게이션 — md 이상에서 hidden */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0d0d0f] border-t border-border/30 flex items-center justify-around px-2 py-2">
        {sidebarLinks.slice(0, 5).map((link) => {
          const Icon = link.icon
          const isActive = link.href === "/mypage"
          return (
            <Link
              key={link.label}
              href={link.href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-tight">{link.label.split(" ")[0]}</span>
            </Link>
          )
        })}
        <Link
          href="/mypage/subscription"
          className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors text-muted-foreground"
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-tight">Plan</span>
        </Link>
      </nav>

      <FooterSection />
    </div>
  )
}
