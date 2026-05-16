"use client"

// KdramaMatch (M+2) — Phase 1 개편
// 데이터·로직만 확장, 톤은 기존 다크테마 유지. UI v0 톤 보존.
//
// 섹션:
//   1. Hero — 카피 + 게이팅 안내 (anon 3 / free 5 / paid 30)
//   2. Taste onboarding 카드 (장르·분위기·플랫폼·연도·상태·에피소드 수) → Get my recommendations
//   3. Top picks (recommend API 응답)
//   4. 지금 인기 (trending API — 최근 7일 watchlist 추가 Top 5 + 완주율)
//   5. Browse all (필터 확장: 장르·플랫폼·연도·상태)
//   6. AI Drama Summary — Pro 잠금 + 유사 드라마 추천 카드 추가
//   7. /mypage/dramas 유도 — 인라인 watchlist 섹션 제거

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import { Star, Plus, Play, Lock, TrendingUp, Sparkles, ListChecks } from "lucide-react"
import Link from "next/link"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { hasProAccess } from "@/lib/auth/plan"

// 필터 칩 옵션 (Hero 설문) — 정적 큐레이션
const GENRES = ["Romance", "Thriller", "Comedy", "Fantasy", "Historical"]
const MOODS = ["Heartwarming", "Intense", "Light", "Emotional"]
const PLATFORMS = ["Netflix", "Viki", "Disney+"]

// Browse 전용 추가 필터
const STATUS_FILTERS: { label: string; value: "ongoing" | "completed" }[] = [
  { label: "On Air", value: "ongoing" },
  { label: "Ended", value: "completed" },
]

// API 응답 타입
interface ApiDrama {
  id: string
  tmdb_id?: number
  title: string
  title_ko: string | null
  genre: string | null
  year: number | null
  platform: string | null
  poster_url: string | null
  rating: number | null
  overview: string | null
  episode_count: number | null
  status: "ongoing" | "completed" | null
}

interface ApiRecommendDrama extends ApiDrama {
  reason?: string
}

interface TrendingItem {
  drama: ApiDrama
  recent_adds: number
  completion_rate: number | null
  sample_size: number
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
        selected
          ? "text-white"
          : "bg-[#1a1a1a] text-muted-foreground hover:text-foreground border border-border/30"
      }`}
      style={selected ? { backgroundColor: "#FF4B6E" } : {}}
    >
      {label}
    </button>
  )
}

function StatusPill({ status }: { status: ApiDrama["status"] }) {
  if (!status) return null
  const map = {
    ongoing: { label: "On Air", bg: "rgba(34, 197, 94, 0.15)", color: "#22c55e" },
    completed: { label: "Ended", bg: "rgba(136, 136, 136, 0.18)", color: "#aaa" },
  } as const
  const conf = map[status]
  return (
    <span
      className="text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: conf.bg, color: conf.color }}
    >
      {conf.label}
    </span>
  )
}

// Drama Card — 뱃지·에피소드 표시 보강. UI 톤은 기존 v0 유지.
function DramaCard({
  drama,
  onAdd,
}: {
  drama: ApiDrama
  onAdd: (dramaId: string) => void
}) {
  return (
    <div className="bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/50 transition-colors group">
      <div className="w-full aspect-[2/3] bg-[#252525] flex items-center justify-center relative">
        {drama.poster_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={drama.poster_url}
            alt={drama.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <span className="text-muted-foreground text-sm">Poster</span>
        )}
        {/* 좌상단 상태 뱃지 */}
        {drama.status && (
          <div className="absolute top-2 left-2">
            <StatusPill status={drama.status} />
          </div>
        )}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Play className="w-12 h-12 text-white" fill="white" />
        </div>
      </div>

      <div className="p-4">
        <h3 className="text-foreground font-semibold text-sm mb-2 line-clamp-1">
          {drama.title}
        </h3>

        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "rgba(255, 75, 110, 0.15)", color: "#FF4B6E" }}
          >
            {drama.genre ?? "Drama"}
          </span>
          <span className="text-muted-foreground text-xs">{drama.year ?? "—"}</span>
          {drama.episode_count && (
            <span className="text-muted-foreground text-xs">· {drama.episode_count} eps</span>
          )}
        </div>

        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-muted-foreground bg-[#252525] px-2 py-1 rounded">
            {drama.platform ?? "—"}
          </span>
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3" style={{ color: "#FF4B6E" }} fill="#FF4B6E" />
            <span className="text-foreground text-xs font-medium">
              {drama.rating != null ? drama.rating.toFixed(1) : "—"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Link
            href="/mypage/dramas"
            className="text-xs font-medium flex items-center gap-1 hover:underline"
            style={{ color: "#FF4B6E" }}
          >
            <Play className="w-3 h-3" /> Track
          </Link>
          <button
            type="button"
            onClick={() => onAdd(drama.id)}
            className="p-1.5 rounded-lg hover:bg-[#252525] transition-colors"
            aria-label="Add to watchlist"
          >
            <Plus className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Trending 카드 — 가로 스크롤. 완주율 표시.
function TrendingCard({ item, onAdd }: { item: TrendingItem; onAdd: (id: string) => void }) {
  const d = item.drama
  return (
    <div className="flex-shrink-0 w-[180px] bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/50 transition-colors">
      <div className="w-full aspect-[2/3] bg-[#252525] relative">
        {d.poster_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={d.poster_url}
            alt={d.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
            Poster
          </div>
        )}
        {d.status && (
          <div className="absolute top-2 left-2">
            <StatusPill status={d.status} />
          </div>
        )}
        <div className="absolute bottom-2 right-2">
          <button
            type="button"
            onClick={() => onAdd(d.id)}
            className="w-7 h-7 rounded-full bg-black/70 hover:bg-black flex items-center justify-center"
            aria-label="Add to watchlist"
          >
            <Plus className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
      <div className="p-3">
        <h4 className="text-foreground font-medium text-sm line-clamp-1">{d.title}</h4>
        <p className="text-muted-foreground text-xs mt-1">
          {d.genre ?? "Drama"} · {d.year ?? "—"}
        </p>
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">
            +<span className="text-foreground font-medium">{item.recent_adds}</span> this week
          </span>
          <span className="text-muted-foreground">
            {item.completion_rate !== null ? (
              <>
                <span className="text-foreground font-medium">{item.completion_rate}%</span>{" "}
                done
              </>
            ) : (
              "—"
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function KdramaMatchPage() {
  const router = useRouter()

  // Hero 설문 상태
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [selectedMoods, setSelectedMoods] = useState<string[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [showRecommendations, setShowRecommendations] = useState(false)

  // 추천 결과
  const [recommendations, setRecommendations] = useState<ApiRecommendDrama[]>([])
  const [recommendLoading, setRecommendLoading] = useState(false)
  const [recommendError, setRecommendError] = useState<string | null>(null)

  // 인증·플랜
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isPro, setIsPro] = useState(false)

  // Browse all — 필터 + 데이터
  const [browseGenres, setBrowseGenres] = useState<string[]>([])
  const [browseStatus, setBrowseStatus] = useState<("ongoing" | "completed")[]>([])
  const [browseYear, setBrowseYear] = useState<string>("all") // "all" | "2024" 등
  const [browseAll, setBrowseAll] = useState<ApiDrama[]>([])
  const [browseLoading, setBrowseLoading] = useState(true)

  // Trending
  const [trending, setTrending] = useState<TrendingItem[]>([])

  // 1. 인증 + 플랜
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setIsAuthenticated(!!user)
      if (!user) return
      const { data: profile } = await supabase
        .from("users")
        .select("plan_type, is_admin")
        .eq("id", user.id)
        .single()
      const row = profile as { plan_type?: string; is_admin?: boolean } | null
      setIsPro(hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin }))
    })
  }, [])

  // 2. Browse all fetch — 필터 변경 시 재조회
  useEffect(() => {
    const ctrl = new AbortController()
    const params = new URLSearchParams()
    for (const g of browseGenres) params.append("genre", g)
    for (const s of browseStatus) params.append("status", s)
    if (browseYear !== "all") params.append("year", browseYear)

    setBrowseLoading(true)
    fetch(`/api/dramas?${params.toString()}`, { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { dramas: ApiDrama[] }) => setBrowseAll(body.dramas ?? []))
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return
        console.error("[drama] browse fetch 실패:", err)
        setBrowseAll([])
      })
      .finally(() => setBrowseLoading(false))
    return () => ctrl.abort()
  }, [browseGenres, browseStatus, browseYear])

  // 3. Trending fetch — 1회
  useEffect(() => {
    fetch("/api/dramas/trending")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { trending: TrendingItem[] }) => setTrending(body.trending ?? []))
      .catch((err) => {
        console.error("[drama] trending fetch 실패:", err)
        setTrending([])
      })
  }, [])

  // Year 옵션 — Browse 전체에서 등장한 연도 집합 (기본 5건만 노출)
  const yearOptions = useMemo(() => {
    const years = new Set<number>()
    for (const d of browseAll) if (d.year) years.add(d.year)
    return Array.from(years).sort((a, b) => b - a).slice(0, 8)
  }, [browseAll])

  const toggleSelection = (
    item: string,
    selected: string[],
    setSelected: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (selected.includes(item)) setSelected(selected.filter((i) => i !== item))
    else setSelected([...selected, item])
  }

  const toggleBrowseStatus = (s: "ongoing" | "completed") => {
    setBrowseStatus((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    )
  }

  // Get my recommendations
  const handleGetRecommendations = useCallback(async () => {
    setRecommendError(null)
    setRecommendLoading(true)
    setShowRecommendations(true)

    try {
      const res = await fetch("/api/dramas/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genres: selectedGenres,
          moods: selectedMoods,
          platforms: selectedPlatforms,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const body = (await res.json()) as { recommendations: ApiRecommendDrama[] }
      setRecommendations(body.recommendations)
    } catch (err) {
      console.error("[drama] recommend 실패:", err)
      setRecommendError(err instanceof Error ? err.message : "추천 요청 실패")
      setRecommendations([])
    } finally {
      setRecommendLoading(false)
    }
  }, [selectedGenres, selectedMoods, selectedPlatforms])

  // Watchlist 추가 — 비로그인은 /login 으로
  const handleAddToWatchlist = useCallback(
    async (dramaId: string) => {
      if (!isAuthenticated) {
        router.push("/login?redirect=/drama")
        return
      }
      try {
        const res = await fetch("/api/dramas/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ drama_id: dramaId, status: "want_to_watch" }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      } catch (err) {
        console.error("[drama] watchlist add 실패:", err)
      }
    },
    [isAuthenticated, router]
  )

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-[1320px] mx-auto px-6 py-12">
        {/* ─── 1. Hero ────────────────────────────────────────── */}
        <section className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">KdramaMatch</h1>
          <p className="text-muted-foreground text-lg">
            AI-powered K-drama recommendations, just for you
          </p>
          {/* 게이팅 안내 — anon 3 / free 5 / paid 30 (recommend route 기준) */}
          <p className="text-muted-foreground/70 text-xs mt-3">
            {isAuthenticated === false
              ? "Guests: 3 picks per request · sign in for 5"
              : "5 AI picks per request — free during preview"}
          </p>
        </section>

        {/* ─── 2. Taste onboarding ─────────────────────────────── */}
        {!showRecommendations && (
          <section className="mb-16 flex justify-center">
            <div className="w-full max-w-[640px] bg-[#141418] border border-border/30 rounded-2xl p-8">
              <h2 className="text-xl font-semibold text-foreground text-center mb-6">
                What&apos;s your K-drama style?
              </h2>

              <div className="mb-6">
                <p className="text-muted-foreground text-sm mb-3">Genre</p>
                <div className="flex flex-wrap gap-2">
                  {GENRES.map((g) => (
                    <Chip
                      key={g}
                      label={g}
                      selected={selectedGenres.includes(g)}
                      onClick={() => toggleSelection(g, selectedGenres, setSelectedGenres)}
                    />
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <p className="text-muted-foreground text-sm mb-3">Mood</p>
                <div className="flex flex-wrap gap-2">
                  {MOODS.map((m) => (
                    <Chip
                      key={m}
                      label={m}
                      selected={selectedMoods.includes(m)}
                      onClick={() => toggleSelection(m, selectedMoods, setSelectedMoods)}
                    />
                  ))}
                </div>
              </div>

              <div className="mb-8">
                <p className="text-muted-foreground text-sm mb-3">Platform</p>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => (
                    <Chip
                      key={p}
                      label={p}
                      selected={selectedPlatforms.includes(p)}
                      onClick={() =>
                        toggleSelection(p, selectedPlatforms, setSelectedPlatforms)
                      }
                    />
                  ))}
                </div>
              </div>

              <Button
                onClick={handleGetRecommendations}
                disabled={recommendLoading}
                className="w-full py-3 rounded-xl font-medium text-white"
                style={{ backgroundColor: "#FF4B6E" }}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {recommendLoading ? "Finding matches..." : "Get AI Recommendations"}
              </Button>
            </div>
          </section>
        )}

        {/* ─── 3. Top picks (AI 추천) ──────────────────────────── */}
        {showRecommendations && (
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-foreground mb-6">Top picks for you</h2>
            {recommendError && (
              <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-400 mb-6">
                <p className="text-sm font-medium mb-1">추천 요청 실패</p>
                <p className="text-xs opacity-80 break-all">{recommendError}</p>
              </div>
            )}
            {recommendLoading ? (
              <p className="text-muted-foreground text-sm">Loading recommendations...</p>
            ) : recommendations.length === 0 && !recommendError ? (
              <p className="text-muted-foreground text-sm">
                No matches found — try fewer filters.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {recommendations.map((d) => (
                  <DramaCard key={d.id} drama={d} onAdd={handleAddToWatchlist} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ─── 4. 지금 인기 (Trending) ─────────────────────────── */}
        {trending.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5" style={{ color: "#FF4B6E" }} />
              <h2 className="text-2xl font-semibold text-foreground">Trending now</h2>
              <span className="text-muted-foreground text-sm">
                · Most added to watchlists this week
              </span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-6 px-6">
              {trending.map((item) => (
                <TrendingCard key={item.drama.id} item={item} onAdd={handleAddToWatchlist} />
              ))}
            </div>
          </section>
        )}

        {/* ─── 5. Browse all ──────────────────────────────────── */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Browse all dramas</h2>

          {/* 필터 — 장르 / 상태 / 연도 */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-muted-foreground text-xs uppercase tracking-wider w-16 flex-shrink-0">
                Genre
              </span>
              {GENRES.map((g) => (
                <Chip
                  key={g}
                  label={g}
                  selected={browseGenres.includes(g)}
                  onClick={() => toggleSelection(g, browseGenres, setBrowseGenres)}
                />
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-muted-foreground text-xs uppercase tracking-wider w-16 flex-shrink-0">
                Status
              </span>
              {STATUS_FILTERS.map((s) => (
                <Chip
                  key={s.value}
                  label={s.label}
                  selected={browseStatus.includes(s.value)}
                  onClick={() => toggleBrowseStatus(s.value)}
                />
              ))}
            </div>
            {yearOptions.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-muted-foreground text-xs uppercase tracking-wider w-16 flex-shrink-0">
                  Year
                </span>
                <Chip
                  label="All years"
                  selected={browseYear === "all"}
                  onClick={() => setBrowseYear("all")}
                />
                {yearOptions.map((y) => (
                  <Chip
                    key={y}
                    label={String(y)}
                    selected={browseYear === String(y)}
                    onClick={() => setBrowseYear(String(y))}
                  />
                ))}
              </div>
            )}
          </div>

          {browseLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : browseAll.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No dramas match the current filters.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {browseAll.map((d) => (
                <DramaCard key={d.id} drama={d} onAdd={handleAddToWatchlist} />
              ))}
            </div>
          )}
        </section>

        {/* ─── 6. AI Drama Summary (Pro) ──────────────────────── */}
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-2xl font-semibold text-foreground">AI Drama Summary</h2>
            <span
              className="text-xs px-2 py-1 rounded-full font-medium"
              style={{ backgroundColor: "rgba(255, 75, 110, 0.15)", color: "#FF4B6E" }}
            >
              Pro
            </span>
          </div>

          <div className="relative">
            <div
              className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${
                isPro ? "" : "blur-[4px] pointer-events-none"
              }`}
            >
              <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6">
                <h3 className="text-foreground font-semibold mb-2">Episode Analysis</h3>
                <p className="text-muted-foreground text-sm">
                  AI-generated summaries of key plot points, character development, and emotional
                  moments — episode by episode.
                </p>
              </div>
              <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6">
                <h3 className="text-foreground font-semibold mb-2">Relationship Map</h3>
                <p className="text-muted-foreground text-sm">
                  Interactive visualization of character connections, family ties, and romantic
                  arcs across the series.
                </p>
              </div>
              <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6">
                <h3 className="text-foreground font-semibold mb-2">Similar dramas</h3>
                <p className="text-muted-foreground text-sm">
                  &ldquo;If you liked this, try…&rdquo; AI matches based on tone, themes, and
                  pacing — not just genre tags.
                </p>
              </div>
            </div>

            {!isPro && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-[#1a1a1a] border border-border/50 rounded-xl p-6 text-center shadow-xl max-w-sm">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
                  >
                    <Lock className="w-6 h-6" style={{ color: "#FF4B6E" }} />
                  </div>
                  <p className="text-foreground font-medium mb-2">
                    Coming with Hallyu Pass
                  </p>
                  <p className="text-muted-foreground text-xs mb-4">
                    Episode breakdowns, relationship maps, and similar-drama matches arrive at launch.
                  </p>
                  <Link href="/signup">
                    <Button
                      className="px-6 py-2 rounded-full font-medium text-white"
                      style={{ backgroundColor: "#FF4B6E" }}
                    >
                      Notify me at launch
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ─── 7. /mypage/dramas 유도 ──────────────────────────── */}
        <section className="mb-16">
          <div className="bg-[#141418] border border-border/30 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ListChecks className="w-5 h-5" style={{ color: "#FF4B6E" }} />
                <h3 className="text-foreground font-semibold text-lg">Your watch list</h3>
              </div>
              <p className="text-muted-foreground text-sm max-w-md">
                Track progress, rate finished shows, and write a one-line take on every drama —
                all in one place.
              </p>
            </div>
            <Link
              href={isAuthenticated === false ? "/login?redirect=/mypage/dramas" : "/mypage/dramas"}
              className="inline-flex items-center justify-center gap-1.5 text-sm font-medium px-5 h-11 rounded-full text-white whitespace-nowrap"
              style={{ backgroundColor: "#FF4B6E" }}
            >
              {isAuthenticated === false ? "Sign in to track" : "Manage my dramas →"}
            </Link>
          </div>
        </section>
      </main>

      <FooterSection />
    </div>
  )
}
