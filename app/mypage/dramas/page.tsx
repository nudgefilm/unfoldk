"use client"

// /mypage/dramas — 내 K드라마 시청 목록
//
// 탭: 볼 것 (want_to_watch) / 보는 중 (watching) / 완료 (completed)
// 카드: 포스터 + 제목 + 장르·연도·플랫폼 뱃지 + 에피소드 진행 바 (보는 중만)
//       + 별점 0~5 (0.5 단위, 완료/보는 중만 의미 있음) + 한줄평 ≤500자 + 삭제.
// 데이터: /api/dramas/watchlist (GET/PATCH/DELETE)
// 진입 가드 + 사이드바: MypageShell 공용.

import { useEffect, useState } from "react"
import Link from "next/link"
import { MypageShell } from "@/components/mypage/mypage-shell"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/components/ui/use-toast"
import { Film, Star, Trash2, Sparkles, Pencil, Save, X } from "lucide-react"

type WatchStatus = "want_to_watch" | "watching" | "completed"

interface DramaJoin {
  id: string
  tmdb_id: number | null
  title: string
  title_ko: string | null
  genre: string | null
  year: number | null
  platform: string | null
  poster_url: string | null
  rating: number | null
  episode_count: number | null
  status: string | null
}

interface WatchItem {
  id: string
  status: WatchStatus
  current_episode: number
  rating: number | null
  review: string | null
  created_at: string
  updated_at: string
  drama: DramaJoin | null
}

const TAB_LABELS: Record<WatchStatus, string> = {
  want_to_watch: "Want to watch",
  watching: "Watching",
  completed: "Completed",
}

export default function MyDramasPage() {
  return (
    <MypageShell activeLabel="My Dramas">
      <MyDramasBody />
      <Toaster />
    </MypageShell>
  )
}

function MyDramasBody() {
  const { toast } = useToast()
  const [tab, setTab] = useState<WatchStatus>("watching")
  const [items, setItems] = useState<WatchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState<Record<WatchStatus, number>>({
    want_to_watch: 0,
    watching: 0,
    completed: 0,
  })

  // 마운트 시 전체 fetch (탭별 count 계산 위해 한 번에). 이후 탭 전환은 메모리 필터.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch("/api/dramas/watchlist", { cache: "no-store" })
        if (!res.ok) {
          if (!cancelled) {
            setItems([])
            setLoading(false)
          }
          return
        }
        const json = (await res.json()) as { items: WatchItem[] }
        const rows = json.items ?? []
        if (cancelled) return

        const c: Record<WatchStatus, number> = {
          want_to_watch: 0,
          watching: 0,
          completed: 0,
        }
        for (const it of rows) {
          if (it.status === "want_to_watch") c.want_to_watch++
          else if (it.status === "watching") c.watching++
          else if (it.status === "completed") c.completed++
        }
        setCounts(c)
        setItems(rows)
      } catch (err) {
        console.error("[mypage/dramas] fetch 실패:", err)
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = items.filter((it) => it.status === tab)

  // PATCH (현재 에피소드 / rating / review / status)
  const patchItem = async (
    dramaId: string,
    patch: Partial<Pick<WatchItem, "status" | "current_episode" | "rating" | "review">>
  ) => {
    try {
      const res = await fetch("/api/dramas/watchlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drama_id: dramaId, ...patch }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        toast({ title: "Update failed", description: data.error ?? "Try again." })
        return false
      }
      // 메모리 상 항목 반영
      setItems((prev) => {
        const next = prev.map((it) =>
          it.drama?.id === dramaId ? { ...it, ...patch } as WatchItem : it
        )
        // status 가 바뀌면 카운트 재계산
        if (patch.status) {
          const c: Record<WatchStatus, number> = {
            want_to_watch: 0,
            watching: 0,
            completed: 0,
          }
          for (const it of next) {
            if (it.status === "want_to_watch") c.want_to_watch++
            else if (it.status === "watching") c.watching++
            else if (it.status === "completed") c.completed++
          }
          setCounts(c)
        }
        return next
      })
      return true
    } catch (err) {
      console.error("[mypage/dramas] PATCH 예외:", err)
      toast({ title: "Network error", description: "Please try again." })
      return false
    }
  }

  const removeItem = async (dramaId: string) => {
    if (!confirm("Remove from your watch list?")) return
    try {
      const res = await fetch(
        `/api/dramas/watchlist?drama_id=${encodeURIComponent(dramaId)}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        toast({ title: "Delete failed", description: "Try again." })
        return
      }
      setItems((prev) => {
        const next = prev.filter((it) => it.drama?.id !== dramaId)
        const c: Record<WatchStatus, number> = {
          want_to_watch: 0,
          watching: 0,
          completed: 0,
        }
        for (const it of next) {
          if (it.status === "want_to_watch") c.want_to_watch++
          else if (it.status === "watching") c.watching++
          else if (it.status === "completed") c.completed++
        }
        setCounts(c)
        return next
      })
    } catch (err) {
      console.error("[mypage/dramas] DELETE 예외:", err)
      toast({ title: "Network error", description: "Please try again." })
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">My Dramas</h1>
          <p className="text-muted-foreground text-sm">
            Track what you&apos;re watching, rate finished shows, and never lose your spot.
          </p>
        </div>
        <Link
          href="/drama"
          className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium px-4 h-10 rounded-full text-white whitespace-nowrap flex-shrink-0"
          style={{ backgroundColor: "#FF4B6E" }}
        >
          <Sparkles className="w-4 h-4" />
          UnfoldK recommendations
        </Link>
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-2 mb-6 border-b border-border/30 overflow-x-auto">
        {(["want_to_watch", "watching", "completed"] as const).map((s) => {
          const isActive = tab === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => setTab(s)}
              className={`relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {TAB_LABELS[s]}{" "}
              <span className="text-muted-foreground/70 ml-1">({counts[s]})</span>
              {isActive && (
                <span
                  className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                  style={{ backgroundColor: "#FF4B6E" }}
                />
              )}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center text-muted-foreground text-sm">
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <ul className="space-y-3">
          {filtered.map((item) => (
            <WatchCard
              key={item.id}
              item={item}
              onPatch={patchItem}
              onRemove={removeItem}
            />
          ))}
        </ul>
      )}

      <div className="sm:hidden mt-8">
        <Link
          href="/drama"
          className="inline-flex items-center gap-1.5 text-sm font-medium px-4 h-10 rounded-full text-white"
          style={{ backgroundColor: "#FF4B6E" }}
        >
          <Sparkles className="w-4 h-4" />
          UnfoldK recommendations
        </Link>
      </div>
    </div>
  )
}

function EmptyState({ tab }: { tab: WatchStatus }) {
  return (
    <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-12 text-center">
      <Film className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
      <p className="text-foreground font-medium mb-1">
        {tab === "want_to_watch"
          ? "Nothing on your wishlist yet"
          : tab === "watching"
            ? "You're not watching anything"
            : "No completed dramas yet"}
      </p>
      <p className="text-muted-foreground text-sm mb-5 max-w-md mx-auto">
        Browse our catalog or get UnfoldK recommendations to start filling this in.
      </p>
      <Link
        href="/drama"
        className="inline-flex items-center gap-1.5 text-sm font-medium px-5 h-10 rounded-full text-white"
        style={{ backgroundColor: "#FF4B6E" }}
      >
        <Sparkles className="w-4 h-4" />
        Browse dramas
      </Link>
    </div>
  )
}

// ─── WatchCard ──────────────────────────────────────────────────
function WatchCard({
  item,
  onPatch,
  onRemove,
}: {
  item: WatchItem
  onPatch: (
    dramaId: string,
    patch: Partial<Pick<WatchItem, "status" | "current_episode" | "rating" | "review">>
  ) => Promise<boolean>
  onRemove: (dramaId: string) => void
}) {
  const drama = item.drama
  const dramaId = drama?.id ?? null
  const [editingReview, setEditingReview] = useState(false)
  const [reviewDraft, setReviewDraft] = useState(item.review ?? "")
  const [savingReview, setSavingReview] = useState(false)

  if (!drama || !dramaId) {
    return null
  }

  const episodeTotal = drama.episode_count ?? null
  const progress =
    episodeTotal && episodeTotal > 0
      ? Math.min(100, Math.round((item.current_episode / episodeTotal) * 100))
      : null

  const handleEpisodeChange = async (delta: number) => {
    const next = Math.max(
      0,
      Math.min(episodeTotal ?? 9999, item.current_episode + delta)
    )
    if (next === item.current_episode) return
    const ok = await onPatch(dramaId, { current_episode: next })
    if (ok && episodeTotal && next >= episodeTotal && item.status !== "completed") {
      // 마지막 화 도달 → completed 자동 전환
      await onPatch(dramaId, { status: "completed" })
    }
  }

  const handleRatingClick = async (value: number) => {
    // 같은 값 두 번 누르면 0.5 단위 토글 (별 한 칸 클릭 = 1.0, 다시 = 0.5, 다시 = null)
    const current = item.rating
    let next: number | null
    if (current === value) next = value - 0.5
    else if (current === value - 0.5) next = null
    else next = value
    await onPatch(dramaId, { rating: next })
  }

  const handleSaveReview = async () => {
    setSavingReview(true)
    const ok = await onPatch(dramaId, { review: reviewDraft.trim() || null })
    setSavingReview(false)
    if (ok) setEditingReview(false)
  }

  const handleStatusChange = async (newStatus: WatchStatus) => {
    if (newStatus === item.status) return
    await onPatch(dramaId, { status: newStatus })
  }

  return (
    <li className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-5">
      <div className="flex gap-4">
        {/* 포스터 */}
        <div className="flex-shrink-0">
          {drama.poster_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={drama.poster_url}
              alt={drama.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="w-20 h-28 sm:w-24 sm:h-36 object-cover rounded-lg bg-[#252525]"
            />
          ) : (
            <div className="w-20 h-28 sm:w-24 sm:h-36 rounded-lg bg-[#252525] flex items-center justify-center">
              <Film className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* 본문 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-foreground font-semibold leading-tight truncate">
                {drama.title}
              </h3>
              {drama.title_ko && (
                <p className="text-muted-foreground text-xs truncate">{drama.title_ko}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {drama.genre && <MetaPill text={drama.genre} />}
                {drama.year && <MetaPill text={String(drama.year)} />}
                {drama.platform && (
                  <MetaPill text={drama.platform} tone="brand" />
                )}
                {drama.status && <StatusPill status={drama.status} />}
                {episodeTotal && (
                  <MetaPill text={`${episodeTotal} eps`} />
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRemove(dramaId)}
              aria-label="Remove from watchlist"
              className="text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* 진행 바 — watching 또는 episode_count 가 있을 때 */}
          {item.status === "watching" && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>
                  Episode{" "}
                  <span className="text-foreground font-medium">
                    {item.current_episode}
                  </span>
                  {episodeTotal && (
                    <>
                      {" / "}
                      <span className="text-foreground">{episodeTotal}</span>
                    </>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleEpisodeChange(-1)}
                    disabled={item.current_episode <= 0}
                    aria-label="Previous episode"
                    className="w-6 h-6 rounded bg-[#252525] hover:bg-[#2a2a2c] text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEpisodeChange(1)}
                    disabled={episodeTotal !== null && item.current_episode >= episodeTotal}
                    aria-label="Next episode"
                    className="w-6 h-6 rounded bg-[#252525] hover:bg-[#2a2a2c] text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="h-1.5 bg-[#252525] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    backgroundColor: "#FF4B6E",
                    width: `${progress ?? 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* 별점 — 0.5 단위. completed 우선, watching 도 허용. */}
          {(item.status === "completed" || item.status === "watching") && (
            <div className="mt-3 flex items-center gap-2">
              <StarRow value={item.rating ?? 0} onClick={handleRatingClick} />
              <span className="text-xs text-muted-foreground">
                {item.rating !== null ? `${item.rating.toFixed(1)} / 5` : "Rate"}
              </span>
            </div>
          )}

          {/* 상태 빠른 전환 */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(["want_to_watch", "watching", "completed"] as const).map((s) => {
              const isActive = item.status === s
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStatusChange(s)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                    isActive
                      ? "border-[#FF4B6E] text-white"
                      : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                  style={isActive ? { backgroundColor: "#FF4B6E" } : {}}
                >
                  {TAB_LABELS[s]}
                </button>
              )
            })}
          </div>

          {/* 한줄평 */}
          <div className="mt-4">
            {editingReview ? (
              <div className="space-y-2">
                <Textarea
                  value={reviewDraft}
                  onChange={(e) => setReviewDraft(e.target.value)}
                  maxLength={500}
                  placeholder="Your one-line take..."
                  className="bg-[#0d0d0f] border-[#2a2a2a] rounded-lg text-foreground placeholder:text-muted-foreground min-h-[60px] resize-y text-sm"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground/70">
                    {reviewDraft.length}/500
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReviewDraft(item.review ?? "")
                        setEditingReview(false)
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Cancel
                    </button>
                    <Button
                      type="button"
                      onClick={handleSaveReview}
                      disabled={savingReview}
                      className="h-8 rounded-full text-xs px-3 text-white"
                      style={{ backgroundColor: "#FF4B6E" }}
                    >
                      <Save className="w-3 h-3 mr-1" />
                      {savingReview ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : item.review ? (
              <div className="flex items-start gap-2">
                <p className="text-foreground/85 text-sm leading-relaxed flex-1 italic">
                  &ldquo;{item.review}&rdquo;
                </p>
                <button
                  type="button"
                  onClick={() => setEditingReview(true)}
                  aria-label="Edit review"
                  className="text-muted-foreground hover:text-foreground flex-shrink-0"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingReview(true)}
                className="text-xs font-medium hover:underline inline-flex items-center gap-1"
                style={{ color: "#FF4B6E" }}
              >
                <Pencil className="w-3 h-3" /> Add a one-line review
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

function MetaPill({
  text,
  tone = "neutral",
}: {
  text: string
  tone?: "neutral" | "brand"
}) {
  const styles =
    tone === "brand"
      ? { backgroundColor: "rgba(255, 75, 110, 0.12)", color: "#FF4B6E" }
      : { backgroundColor: "rgba(255, 255, 255, 0.05)", color: "var(--muted-foreground)" }
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      style={styles}
    >
      {text}
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    ongoing: { label: "On Air", bg: "rgba(34, 197, 94, 0.15)", color: "#22c55e" },
    completed: { label: "Ended", bg: "rgba(136, 136, 136, 0.15)", color: "#888" },
  }
  const conf = map[status]
  if (!conf) return null
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: conf.bg, color: conf.color }}
    >
      {conf.label}
    </span>
  )
}

// 별점 0.5 단위. 한 별을 두 반쪽으로 나눠 클릭 위치별 다른 값 전달.
function StarRow({
  value,
  onClick,
}: {
  value: number
  onClick: (value: number) => void
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const fillFraction = Math.max(0, Math.min(1, value - (n - 1)))
        return (
          <div key={n} className="relative w-5 h-5">
            {/* 왼쪽 반 (n - 0.5) */}
            <button
              type="button"
              onClick={() => onClick(n - 0.5)}
              aria-label={`Rate ${n - 0.5}`}
              className="absolute inset-y-0 left-0 w-1/2 z-10"
            />
            {/* 오른쪽 반 (n) */}
            <button
              type="button"
              onClick={() => onClick(n)}
              aria-label={`Rate ${n}`}
              className="absolute inset-y-0 right-0 w-1/2 z-10"
            />
            <Star className="w-5 h-5 text-muted-foreground/40" strokeWidth={1.5} />
            <div
              className="absolute inset-0 overflow-hidden pointer-events-none"
              style={{ width: `${fillFraction * 100}%` }}
            >
              <Star
                className="w-5 h-5"
                style={{ color: "#FF4B6E", fill: "#FF4B6E" }}
                strokeWidth={1.5}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
