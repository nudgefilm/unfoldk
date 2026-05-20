"use client"

// /mypage/calendar — 내 캘린더
//
// 분기:
//   mode = "subscribed" → 본인이 알림 설정한 이벤트만 (upcoming + past)
//   mode = "fallback"   → 구독 0건이면 이번 달 전체 이벤트
//
// 데이터: /api/mypage/calendar
// 사이드바·전체 레이아웃은 /mypage/page.tsx 패턴 그대로 재사용

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FooterSection } from "@/components/footer-section"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import {
  Home,
  Calendar,
  Music,
  Film,
  Languages,
  UtensilsCrossed,
  CreditCard,
  Settings,
  PartyPopper,
  ExternalLink,
  Bell,
  CalendarDays,
} from "lucide-react"

const sidebarLinks = [
  { icon: Home, label: "Dashboard", href: "/mypage" },
  { icon: Calendar, label: "My Calendar", href: "/mypage/calendar" },
  { icon: Music, label: "My Artists", href: "/mypage/artists" },
  { icon: Film, label: "My Dramas", href: "/mypage/dramas" },
  { icon: Languages, label: "Learning Progress", href: "/mypage/learning" },
  { icon: UtensilsCrossed, label: "Saved Recipes", href: "/mypage/recipes" },
  { icon: PartyPopper, label: "My Fan Events", href: "/mypage/fan-events" },
  { icon: CreditCard, label: "Subscription", href: "/mypage/subscription" },
  { icon: Settings, label: "Settings", href: "/mypage/settings" },
]

interface CalendarEvent {
  id: string
  title: string
  artist: string | null
  event_date: string
  date: number
  month: string
  type: string
  time: string | null
  description: string | null
  isPremium: boolean
  thumbnailUrl: string | null
  url: string | null
}

type ApiResponse =
  | {
      mode: "subscribed"
      upcoming: CalendarEvent[]
      past: CalendarEvent[]
    }
  | {
      mode: "fallback"
      monthLabel: string
      events: CalendarEvent[]
    }

export default function MyCalendarPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [userName, setUserName] = useState("")
  const [userInitial, setUserInitial] = useState("")
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [userPlan, setUserPlan] = useState("Free")

  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // 진입 가드 + 프로필 + 캘린더 데이터 로드
  useEffect(() => {
    let cancelled = false
    const supabase = createSupabaseBrowserClient()

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace("/")
        return
      }
      if (cancelled) return

      const meta = (user.user_metadata ?? {}) as { full_name?: string; avatar_url?: string }
      const fallbackName = user.email?.split("@")[0] ?? "User"
      const name = meta.full_name?.trim() || fallbackName
      setUserName(name)
      setUserInitial(name.charAt(0).toUpperCase() || "U")
      setUserAvatar(meta.avatar_url ?? null)

      const { data: profile } = await supabase
        .from("users")
        .select("plan_type")
        .eq("id", user.id)
        .single()
      if (!cancelled) {
        const pt = (profile as { plan_type?: string } | null)?.plan_type
        setUserPlan(pt === "monthly" || pt === "annual" ? "Hallyu Pass" : "Free")
        setAuthChecked(true)
      }

      try {
        const res = await fetch("/api/mypage/calendar")
        if (!res.ok) {
          if (!cancelled) setData(null)
          return
        }
        const json = (await res.json()) as ApiResponse
        if (!cancelled) setData(json)
      } catch (err) {
        console.error("[mypage/calendar] fetch 실패:", err)
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [router])

  if (!authChecked) return null

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0d0d0f" }}>
      <div className="flex-1 flex max-w-7xl mx-auto w-full px-4 md:px-6 py-8 gap-8">
        {/* Left Sidebar */}
        <aside className="hidden md:flex flex-col w-[240px] flex-shrink-0">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              {userAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
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

          <nav className="flex flex-col gap-1">
            {sidebarLinks.map((link) => {
              const isActive = link.label === "My Calendar"
              return (
                <Link
                  key={link.label}
                  href={link.href}
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
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">My Calendar</h1>
              <p className="text-muted-foreground text-sm">
                {data?.mode === "subscribed"
                  ? "Events you've subscribed to for reminders."
                  : "You haven't subscribed to any events yet — showing this month's lineup."}
              </p>
            </div>
            <Link
              href="/calendar"
              className="text-sm font-medium hover:underline whitespace-nowrap flex-shrink-0"
              style={{ color: "#FF4B6E" }}
            >
              Browse all →
            </Link>
          </div>

          {loading ? (
            <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : !data ? (
            <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center text-muted-foreground text-sm">
              Failed to load events. Please refresh.
            </div>
          ) : data.mode === "subscribed" ? (
            <SubscribedView upcoming={data.upcoming} past={data.past} />
          ) : (
            <FallbackView monthLabel={data.monthLabel} events={data.events} />
          )}
        </main>
      </div>

      <FooterSection />
    </div>
  )
}

// 구독 모드 — Upcoming + Past 섹션
function SubscribedView({
  upcoming,
  past,
}: {
  upcoming: CalendarEvent[]
  past: CalendarEvent[]
}) {
  if (upcoming.length === 0 && past.length === 0) {
    return <EmptyState />
  }

  return (
    <>
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4" style={{ color: "#FF4B6E" }} />
          <h2 className="text-lg font-semibold text-foreground">Upcoming</h2>
          <span className="text-muted-foreground text-sm">({upcoming.length})</span>
        </div>
        {upcoming.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-8 text-center text-muted-foreground text-sm">
            No upcoming events. Browse{" "}
            <Link href="/calendar" className="hover:underline" style={{ color: "#FF4B6E" }}>
              HallyuCalendar
            </Link>{" "}
            to subscribe.
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Past</h2>
            <span className="text-muted-foreground text-sm">({past.length})</span>
          </div>
          <div className="space-y-3 opacity-70">
            {past.slice(0, 10).map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

// Fallback 모드 — 이번 달 전체
function FallbackView({
  monthLabel,
  events,
}: {
  monthLabel: string
  events: CalendarEvent[]
}) {
  if (events.length === 0) return <EmptyState />

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className="w-4 h-4" style={{ color: "#FF4B6E" }} />
        <h2 className="text-lg font-semibold text-foreground">{monthLabel}</h2>
        <span className="text-muted-foreground text-sm">({events.length})</span>
      </div>
      <div className="space-y-3">
        {events.map((ev) => (
          <EventCard key={ev.id} event={ev} />
        ))}
      </div>
    </section>
  )
}

function EventCard({ event }: { event: CalendarEvent }) {
  // /calendar 로 이동하되 ?event=<id>&month=<YYYY-MM> — calendar 페이지가 month 로 viewDate
  // 보정 후 events 로드되면 매칭 이벤트 모달 자동 오픈. month 가 다른 달이어도 자연스럽게 전환.
  const monthSlug = event.event_date.slice(0, 7)            // "2026-05"
  const href = `/calendar?event=${encodeURIComponent(event.id)}&month=${encodeURIComponent(monthSlug)}`
  return (
    <Link
      href={href}
      className="bg-[#1a1a1a] border border-border/30 rounded-xl p-4 flex items-start gap-4 hover:bg-[#2a2a2c] hover:border-primary/40 transition-colors"
    >
      <div
        className="w-14 h-14 rounded-xl flex flex-col items-center justify-center text-white flex-shrink-0"
        style={{ backgroundColor: "#FF4B6E" }}
      >
        <span className="text-[10px] font-medium">{event.month}</span>
        <span className="text-xl font-bold leading-none mt-0.5">{event.date}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h3 className="text-foreground font-medium truncate flex-1">{event.title}</h3>
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
            style={{
              backgroundColor: "rgba(255, 75, 110, 0.15)",
              color: "#FF4B6E",
            }}
          >
            {event.type}
          </span>
        </div>
        {event.artist && (
          <p className="text-muted-foreground text-xs mt-0.5 truncate">{event.artist}</p>
        )}
        {event.time && (
          <p className="text-muted-foreground text-xs mt-1">{event.time}</p>
        )}
        {event.url && (
          <span
            className="inline-flex items-center gap-1 text-xs mt-2"
            style={{ color: "#FF4B6E" }}
          >
            Tickets <ExternalLink className="w-3 h-3" />
          </span>
        )}
      </div>
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-12 text-center">
      <CalendarDays className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
      <p className="text-foreground font-medium mb-1">No events yet</p>
      <p className="text-muted-foreground text-sm">
        Browse{" "}
        <Link href="/calendar" className="hover:underline" style={{ color: "#FF4B6E" }}>
          HallyuCalendar
        </Link>{" "}
        and subscribe to events you don&apos;t want to miss.
      </p>
    </div>
  )
}
