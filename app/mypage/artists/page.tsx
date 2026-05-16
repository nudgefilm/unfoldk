"use client"

// /mypage/artists — 내 아티스트
//
// 즐겨찾기 인프라(user_artist_favorites)는 아직 없음.
// 현재는 활성 아티스트 전체를 리스너순으로 표시 (CLAUDE.md §6 노출 원칙).
// 추후 즐겨찾기가 추가되면 본 페이지가 본인 즐겨찾기 → fallback 전체 순으로 분기.
//
// 데이터: /api/kpop/artists?sort=listeners&type=&page=N&pageSize=30
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
  ChevronLeft,
  ChevronRight,
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

const PAGE_SIZE = 30

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

interface ApiResponse {
  items: ArtistListItem[]
  total: number
  page: number
  pageSize: number
}

type TypeFilter = "all" | "group" | "solo"

function formatBigNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—"
  const abs = Math.abs(n)
  if (abs >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B"
  if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
  if (abs >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K"
  return n.toLocaleString()
}

export default function MyArtistsPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [userName, setUserName] = useState("")
  const [userInitial, setUserInitial] = useState("")
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [userPlan, setUserPlan] = useState("Free")

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<ArtistListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // 진입 가드 + 프로필 로드
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
    }

    load()
    return () => {
      cancelled = true
    }
  }, [router])

  // 아티스트 목록 fetch
  useEffect(() => {
    if (!authChecked) return
    setLoading(true)
    const params = new URLSearchParams({
      sort: "listeners",
      page: String(page),
      pageSize: String(PAGE_SIZE),
    })
    if (typeFilter !== "all") params.set("type", typeFilter)

    fetch(`/api/kpop/artists?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ApiResponse | null) => {
        if (data) {
          setItems(data.items)
          setTotal(data.total)
        } else {
          setItems([])
          setTotal(0)
        }
      })
      .catch((err) => {
        console.error("[mypage/artists] fetch 실패:", err)
        setItems([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [authChecked, typeFilter, page])

  const handleTypeChange = (v: TypeFilter) => {
    setTypeFilter(v)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

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
              const isActive = link.label === "My Artists"
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
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-2">My Artists</h1>
            <p className="text-muted-foreground text-sm">
              Browse all K-pop artists tracked on Unfold K, sorted by Last.fm listeners.
            </p>
          </div>

          {/* Filter / Total */}
          <section className="mb-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Type:</span>
              {(["all", "group", "solo"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeChange(t)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    typeFilter === t
                      ? "bg-[#FF4B6E] border-[#FF4B6E] text-white"
                      : "bg-[#1a1a1a] border-border/30 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "all" ? "All" : t === "group" ? "Group" : "Solo"}
                </button>
              ))}
            </div>

            <div className="ml-auto text-muted-foreground text-sm">
              {loading ? "Loading..." : `${total.toLocaleString()} artists`}
            </div>
          </section>

          {/* 아티스트 카드 그리드 */}
          <section className="mb-8">
            {loading ? (
              <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center text-muted-foreground text-sm">
                Loading...
              </div>
            ) : items.length === 0 ? (
              <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center text-muted-foreground text-sm">
                No artists match the current filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map((a) => (
                  <Link
                    key={a.id}
                    href={`/kpop/${a.id}`}
                    className="bg-[#1a1a1a] border border-border/30 rounded-xl p-4 flex items-center gap-3 hover:bg-[#2a2a2c] hover:border-primary/40 transition-colors"
                  >
                    {a.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.thumbnail_url}
                        alt={a.name}
                        className="w-12 h-12 rounded-full object-cover flex-shrink-0 bg-[#252525]"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#252525] flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-foreground font-medium truncate">{a.name}</p>
                        <TypeBadge memberCount={a.member_count} />
                      </div>
                      {a.name_ko && (
                        <p className="text-muted-foreground text-xs truncate">{a.name_ko}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        <span className="text-muted-foreground">
                          <span className="text-foreground">
                            {formatBigNumber(a.latest_listeners)}
                          </span>{" "}
                          listeners
                        </span>
                        {a.has_youtube ? (
                          <span className="text-muted-foreground">
                            <span className="text-foreground">
                              {formatBigNumber(a.latest_subscribers)}
                            </span>{" "}
                            subs
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">YouTube coming soon</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <nav
              className="flex items-center justify-center gap-2 mb-12"
              aria-label="Pagination"
            >
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="p-2 rounded-lg bg-[#1a1a1a] border border-border/30 text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#2a2a2c]"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-muted-foreground text-sm px-4">
                Page <span className="text-foreground font-medium">{page}</span> /{" "}
                {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="p-2 rounded-lg bg-[#1a1a1a] border border-border/30 text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#2a2a2c]"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </nav>
          )}
        </main>
      </div>

      <FooterSection />
    </div>
  )
}

// 그룹/솔로 뱃지 — member_count: null=미분류(미노출) / 1=Solo / 2+=Group
function TypeBadge({ memberCount }: { memberCount: number | null }) {
  if (memberCount === null) return null
  const isSolo = memberCount === 1
  return (
    <span
      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
      style={
        isSolo
          ? { backgroundColor: "rgba(168, 85, 247, 0.15)", color: "#a855f7" }
          : { backgroundColor: "rgba(255, 75, 110, 0.15)", color: "#FF4B6E" }
      }
    >
      {isSolo ? "Solo" : "Group"}
    </span>
  )
}
