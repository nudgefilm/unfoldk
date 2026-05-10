"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import { Star, Plus, Play, Lock } from "lucide-react"
import Link from "next/link"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { hasProAccess } from "@/lib/auth/plan"

// ============================================================
// KdramaMatch (M+2) — UI 무변경. Mock 데이터 → 실제 API 연동.
// API:
//   GET  /api/dramas                     — 목록 (plan-based limit)
//   POST /api/dramas/recommend           — Claude Haiku 취향 추천
//   GET  /api/dramas/watchlist?status=…  — 본인 시청 목록
//   POST /api/dramas/watchlist           — 등록/상태 변경
// ============================================================

// 필터 칩 옵션 — UI 변경 금지 (§15)
const genres = ["Romance", "Thriller", "Comedy", "Fantasy", "Historical"]
const moods = ["Heartwarming", "Intense", "Light", "Emotional"]
const platforms = ["Netflix", "Viki", "Disney+"]

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

interface ApiWatchlistItem {
  id: string
  status: "watching" | "want_to_watch" | "completed"
  current_episode: number
  drama: ApiDrama
}

type WatchlistTabKey = "watching" | "wantToWatch" | "completed"

// API status 키 ↔ UI 탭 키 매핑
const TAB_TO_STATUS: Record<WatchlistTabKey, "watching" | "want_to_watch" | "completed"> = {
  watching: "watching",
  wantToWatch: "want_to_watch",
  completed: "completed",
}

// Chip — 기존 컴포넌트 그대로
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

// Drama Card — UI 무변경. 포스터 이미지만 조건부 추가 (없으면 기존 Placeholder 유지)
function DramaCard({
  drama,
  onAdd,
}: {
  drama: ApiDrama
  onAdd: (dramaId: string) => void
}) {
  return (
    <div className="bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/50 transition-colors group">
      {/* Poster — TMDB poster_url 있으면 노출, 없으면 기존 placeholder */}
      <div className="w-full aspect-[2/3] bg-[#252525] flex items-center justify-center relative">
        {drama.poster_url ? (
          // next.config.mjs images.unoptimized=true 라 plain img 사용 (alt 보존)
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={drama.poster_url}
            alt={drama.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <span className="text-muted-foreground text-sm">Poster</span>
        )}
        {/* Play overlay on hover — 기존 그대로 */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Play className="w-12 h-12 text-white" fill="white" />
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-foreground font-semibold text-sm mb-2 line-clamp-1">{drama.title}</h3>

        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "rgba(255, 75, 110, 0.15)", color: "#FF4B6E" }}
          >
            {drama.genre ?? "Drama"}
          </span>
          <span className="text-muted-foreground text-xs">{drama.year ?? "—"}</span>
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
            href="#"
            className="text-xs font-medium flex items-center gap-1 hover:underline"
            style={{ color: "#FF4B6E" }}
          >
            <Play className="w-3 h-3" /> Start watching
          </Link>
          {/* Plus 버튼 — 클릭 시 watchlist 추가. 비로그인은 onAdd 안에서 /login 으로 redirect */}
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

// Watchlist Card — UI 무변경. drama 정보 + status 별 progress 라벨만 조립.
interface WatchlistCardData {
  id: string
  title: string
  genre: string
  progress: string
  poster_url: string | null
}

function WatchlistCard({ drama }: { drama: WatchlistCardData }) {
  return (
    <div className="flex-shrink-0 w-[200px] bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden">
      <div className="w-full aspect-[2/3] bg-[#252525] flex items-center justify-center relative">
        {drama.poster_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={drama.poster_url}
            alt={drama.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <span className="text-muted-foreground text-xs">Poster</span>
        )}
      </div>
      <div className="p-3">
        <h4 className="text-foreground font-medium text-sm mb-1 line-clamp-1">{drama.title}</h4>
        <p className="text-muted-foreground text-xs">{drama.progress || drama.genre}</p>
      </div>
    </div>
  )
}

export default function KdramaMatchPage() {
  const router = useRouter()

  // 필터 상태 — 기존 UI 그대로
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [selectedMoods, setSelectedMoods] = useState<string[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [showRecommendations, setShowRecommendations] = useState(false)
  const [activeWatchlistTab, setActiveWatchlistTab] = useState<WatchlistTabKey>("watching")

  // 데이터 상태
  const [recommendations, setRecommendations] = useState<ApiRecommendDrama[]>([])
  const [recommendLoading, setRecommendLoading] = useState(false)
  const [recommendError, setRecommendError] = useState<string | null>(null)

  // Browse all — 비로그인 포함 전 유저에게 카탈로그 전체 노출
  const [browseAll, setBrowseAll] = useState<ApiDrama[]>([])
  const [browseLoading, setBrowseLoading] = useState(true)

  // 시청 목록 — 탭별 캐시
  const [watchlist, setWatchlist] = useState<Record<WatchlistTabKey, WatchlistCardData[]>>({
    watching: [],
    wantToWatch: [],
    completed: [],
  })
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isPro, setIsPro] = useState(false)                                  // monthly/annual/admin 통합 판별

  // 1. 마운트 시 로그인 상태 + plan 권한 1회 확인 (watchlist · Pro 잠금 가드용)
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

  // 1.5. Browse all — 마운트 시 1회 fetch. 비로그인 포함 전체 공개라 인증 분기 없음.
  useEffect(() => {
    const ctrl = new AbortController()
    fetch("/api/dramas", { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { dramas: ApiDrama[] }) => {
        setBrowseAll(body.dramas ?? [])
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return
        console.error("[drama] browse-all fetch 실패:", err)
        setBrowseAll([])
      })
      .finally(() => setBrowseLoading(false))
    return () => ctrl.abort()
  }, [])

  // 2. 로그인 사용자의 활성 탭 시청 목록 fetch
  //    AbortController 로 빠른 탭 전환 시 stale 응답 덮어쓰기 방지
  const watchlistAbortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    if (!isAuthenticated) return

    watchlistAbortRef.current?.abort()
    const ctrl = new AbortController()
    watchlistAbortRef.current = ctrl

    const status = TAB_TO_STATUS[activeWatchlistTab]
    fetch(`/api/dramas/watchlist?status=${status}`, { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { items: ApiWatchlistItem[] }) => {
        const cards: WatchlistCardData[] = body.items.map((item) => ({
          id: item.id,
          title: item.drama?.title ?? "",
          genre: item.drama?.genre ?? "",
          progress:
            item.status === "completed"
              ? "Completed"
              : item.status === "watching"
                ? `Ep ${item.current_episode}/${item.drama?.episode_count ?? "?"}`
                : "",
          poster_url: item.drama?.poster_url ?? null,
        }))
        setWatchlist((prev) => ({ ...prev, [activeWatchlistTab]: cards }))
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return
        console.error("[drama] watchlist fetch 실패:", err)
      })

    return () => ctrl.abort()
  }, [isAuthenticated, activeWatchlistTab])

  // 3. 칩 토글 헬퍼 — 기존 그대로
  const toggleSelection = (
    item: string,
    selected: string[],
    setSelected: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (selected.includes(item)) {
      setSelected(selected.filter((i) => i !== item))
    } else {
      setSelected([...selected, item])
    }
  }

  // 4. "Get my recommendations" — POST /api/dramas/recommend
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

  // 5. 카드 + 버튼 → watchlist 등록
  //    비로그인 시 /login 으로 redirect (UI 의 기존 /login 링크 동등 동작)
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
        // wantToWatch 탭이 보이는 중이면 즉시 갱신, 그 외엔 다음 탭 진입 시 fetch
        if (activeWatchlistTab === "wantToWatch") {
          // 단순 재조회로 캐시 갱신
          setActiveWatchlistTab("wantToWatch")
        }
      } catch (err) {
        console.error("[drama] watchlist add 실패:", err)
      }
    },
    [isAuthenticated, activeWatchlistTab, router]
  )

  const watchlistTabs = [
    { key: "watching" as const, label: "Watching" },
    { key: "wantToWatch" as const, label: "Want to Watch" },
    { key: "completed" as const, label: "Completed" },
  ]

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-[1320px] mx-auto px-6 py-12">
        {/* Page Header */}
        <section className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">KdramaMatch</h1>
          <p className="text-muted-foreground text-lg">AI-powered K-drama recommendations just for you</p>
        </section>

        {/* Taste Onboarding Card */}
        {!showRecommendations && (
          <section className="mb-16 flex justify-center">
            <div className="w-full max-w-[600px] bg-[#141418] border border-border/30 rounded-2xl p-8">
              <h2 className="text-xl font-semibold text-foreground text-center mb-6">
                What&apos;s your K-drama style?
              </h2>

              {/* Genre */}
              <div className="mb-6">
                <p className="text-muted-foreground text-sm mb-3">Genre</p>
                <div className="flex flex-wrap gap-2">
                  {genres.map((genre) => (
                    <Chip
                      key={genre}
                      label={genre}
                      selected={selectedGenres.includes(genre)}
                      onClick={() => toggleSelection(genre, selectedGenres, setSelectedGenres)}
                    />
                  ))}
                </div>
              </div>

              {/* Mood */}
              <div className="mb-6">
                <p className="text-muted-foreground text-sm mb-3">Mood</p>
                <div className="flex flex-wrap gap-2">
                  {moods.map((mood) => (
                    <Chip
                      key={mood}
                      label={mood}
                      selected={selectedMoods.includes(mood)}
                      onClick={() => toggleSelection(mood, selectedMoods, setSelectedMoods)}
                    />
                  ))}
                </div>
              </div>

              {/* Platform */}
              <div className="mb-8">
                <p className="text-muted-foreground text-sm mb-3">Platform</p>
                <div className="flex flex-wrap gap-2">
                  {platforms.map((platform) => (
                    <Chip
                      key={platform}
                      label={platform}
                      selected={selectedPlatforms.includes(platform)}
                      onClick={() =>
                        toggleSelection(platform, selectedPlatforms, setSelectedPlatforms)
                      }
                    />
                  ))}
                </div>
              </div>

              {/* Submit Button — 기존 Link 래핑 제거하고 직접 onClick (recommend API 호출) */}
              <Button
                onClick={handleGetRecommendations}
                disabled={recommendLoading}
                className="w-full py-3 rounded-xl font-medium text-white"
                style={{ backgroundColor: "#FF4B6E" }}
              >
                {recommendLoading ? "Finding matches..." : "Get my recommendations"}
              </Button>
            </div>
          </section>
        )}

        {/* Top picks (AI 추천) — 사용자가 "Get my recommendations" 클릭 시 노출.
            노출 한도: anon 3 / free 5 / paid 30. */}
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
              <p className="text-muted-foreground text-sm">No matches found — try fewer filters.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {recommendations.map((drama) => (
                  <DramaCard key={drama.id} drama={drama} onAdd={handleAddToWatchlist} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Browse all — 비로그인 포함 전체 공개. plan 무관 카탈로그 전체 노출.
            상단의 Top picks(큐레이션)와 별개로 항상 노출. */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-6">Browse all dramas</h2>
          {browseLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : browseAll.length === 0 ? (
            <p className="text-muted-foreground text-sm">No dramas yet.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {browseAll.map((drama) => (
                <DramaCard key={drama.id} drama={drama} onAdd={handleAddToWatchlist} />
              ))}
            </div>
          )}
        </section>

        {/* My Watch List */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-6">My Watch List</h2>

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-6 border-b border-border/30">
            {watchlistTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveWatchlistTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                  activeWatchlistTab === tab.key
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                {activeWatchlistTab === tab.key && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ backgroundColor: "#FF4B6E" }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Watchlist Cards — 비로그인 시 안내, 로그인 시 활성 탭 데이터 */}
          <div className="flex gap-4 overflow-x-auto pb-4">
            {isAuthenticated === false ? (
              <p className="text-muted-foreground text-sm">
                <Link href="/login?redirect=/drama" className="hover:underline" style={{ color: "#FF4B6E" }}>
                  Log in
                </Link>{" "}
                to start tracking your watchlist.
              </p>
            ) : watchlist[activeWatchlistTab].length === 0 ? (
              <p className="text-muted-foreground text-sm">No dramas in this list yet.</p>
            ) : (
              watchlist[activeWatchlistTab].map((drama) => (
                <WatchlistCard key={drama.id} drama={drama} />
              ))
            )}
          </div>
        </section>

        {/* AI Drama Summary (Pro) - Blurred — 기존 그대로 */}
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
            {/* Blurred Cards — isPro 면 블러 해제 */}
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${isPro ? "" : "blur-[4px] pointer-events-none"}`}>
              <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6">
                <h3 className="text-foreground font-semibold mb-2">Crash Landing on You - Episode Analysis</h3>
                <p className="text-muted-foreground text-sm">
                  A comprehensive AI-generated summary of key plot points, character development,
                  and emotional moments from each episode...
                </p>
              </div>
              <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6">
                <h3 className="text-foreground font-semibold mb-2">Character Relationship Map</h3>
                <p className="text-muted-foreground text-sm">
                  Interactive visualization of character connections, family ties,
                  and romantic relationships throughout the series...
                </p>
              </div>
            </div>

            {/* Upgrade Overlay — isPro 면 미노출 */}
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
                    Unlock AI Drama Summaries with Hallyu Pass
                  </p>
                  <Link href="/signup">
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

      <FooterSection />
    </div>
  )
}
