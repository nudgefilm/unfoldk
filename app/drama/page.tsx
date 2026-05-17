"use client"

// KdramaMatch (M+2) — Phase 2
// 데이터·로직 확장. UI 톤은 기존 v0 다크테마 유지.
//
// 섹션:
//   1. Hero
//   2. Now Airing — on_the_air D-Day 카운트다운 + Google Calendar 버튼 (NEW Phase 2)
//   3. Taste onboarding → Get my recommendations
//   4. Top picks (recommend API)
//   5. Trending (recent_adds Top 5)
//   6. Browse all
//   7. AI Drama Summary — Pro 잠금 (현행 유지)
//   8. /mypage/dramas 유도
//
// Phase 2 추가:
//   - 카드 클릭 → 상세 모달 (backdrop, original_name, cast, OTT, networks, episode, trailer, OST)
//   - API 응답 camelCase 적용

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import {
  Star,
  Plus,
  Play,
  Lock,
  TrendingUp,
  Sparkles,
  ListChecks,
  X as CloseIcon,
  CalendarPlus,
  ExternalLink,
} from "lucide-react"
import Link from "next/link"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { hasProAccess } from "@/lib/auth/plan"
import { ServiceComingSoonBanner } from "@/components/early-access/service-coming-soon-banner"
import type { DramaApi } from "@/lib/dramas/mapper"

// 필터 칩 옵션
const GENRES = ["Romance", "Thriller", "Comedy", "Fantasy", "Historical"]
const MOODS = ["Heartwarming", "Intense", "Light", "Emotional"]
const PLATFORMS = ["Netflix", "Viki", "Disney+"]

const STATUS_FILTERS: { label: string; value: "ongoing" | "completed" }[] = [
  { label: "On Air", value: "ongoing" },
  { label: "Ended", value: "completed" },
]

// API 응답 타입 — camelCase (Phase 2 mapper.ts 와 통일)
type ApiDrama = DramaApi

interface ApiRecommendDrama extends ApiDrama {
  reason?: string
}

interface TrendingItem {
  drama: ApiDrama
  recentAdds: number
  completionRate: number | null
  sampleSize: number
}

interface OstArtistApi {
  id: string
  name: string
  thumbnailUrl: string | null
  memberCount: number | null
}

// ──────────────────────────────────────────────────────────────
// Google Calendar URL 헬퍼 — app/calendar/page.tsx 의 buildGoogleCalendarUrl 패턴 재사용
// ──────────────────────────────────────────────────────────────
function buildGoogleCalendarUrlForDrama(
  dramaTitle: string,
  airDate: string, // YYYY-MM-DD
  description?: string
): string {
  // YYYY-MM-DD → YYYYMMDD 변환
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
  const start = new Date(airDate + "T00:00:00")
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${dramaTitle} — New episode`,
    dates: `${fmt(start)}/${fmt(end)}`,
    ...(description ? { details: description } : {}),
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

// next_episode_date → D-Day 라벨
function buildDDayLabel(nextEpisodeDate: string | null): string {
  if (!nextEpisodeDate) return "Check schedule"
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(nextEpisodeDate + "T00:00:00")
  const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays <= 0) return "New episode today!"
  if (diffDays === 1) return "New episode tomorrow"
  if (diffDays <= 6) return `New episode in ${diffDays} days`
  return target.toLocaleDateString("en-US", { month: "short", day: "numeric" })
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

// Drama Card — 클릭 시 상세 모달 오픈. 톤은 기존 v0 유지.
function DramaCard({
  drama,
  onAdd,
  onOpenDetail,
}: {
  drama: ApiDrama
  onAdd: (dramaId: string) => void
  onOpenDetail: (dramaId: string) => void
}) {
  return (
    <div className="bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/50 transition-colors group">
      <button
        type="button"
        onClick={() => onOpenDetail(drama.id)}
        className="w-full aspect-[2/3] bg-[#252525] flex items-center justify-center relative text-left"
      >
        {drama.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={drama.posterUrl}
            alt={drama.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <span className="text-muted-foreground text-sm">Poster</span>
        )}
        {drama.status && (
          <div className="absolute top-2 left-2">
            <StatusPill status={drama.status} />
          </div>
        )}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Play className="w-12 h-12 text-white" fill="white" />
        </div>
      </button>

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
          {drama.episodeCount && (
            <span className="text-muted-foreground text-xs">· {drama.episodeCount} eps</span>
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
          <button
            type="button"
            onClick={() => onOpenDetail(drama.id)}
            className="text-xs font-medium flex items-center gap-1 hover:underline"
            style={{ color: "#FF4B6E" }}
          >
            <Play className="w-3 h-3" /> Details
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onAdd(drama.id)
            }}
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

function TrendingCard({
  item,
  onAdd,
  onOpenDetail,
}: {
  item: TrendingItem
  onAdd: (id: string) => void
  onOpenDetail: (id: string) => void
}) {
  const d = item.drama
  return (
    <div className="flex-shrink-0 w-[180px] bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/50 transition-colors">
      <button
        type="button"
        onClick={() => onOpenDetail(d.id)}
        className="w-full aspect-[2/3] bg-[#252525] relative"
      >
        {d.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={d.posterUrl}
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
        <span
          onClick={(e) => {
            e.stopPropagation()
            onAdd(d.id)
          }}
          className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/70 hover:bg-black flex items-center justify-center cursor-pointer"
          aria-label="Add to watchlist"
        >
          <Plus className="w-4 h-4 text-white" />
        </span>
      </button>
      <div className="p-3">
        <h4 className="text-foreground font-medium text-sm line-clamp-1">{d.title}</h4>
        <p className="text-muted-foreground text-xs mt-1">
          {d.genre ?? "Drama"} · {d.year ?? "—"}
        </p>
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">
            +<span className="text-foreground font-medium">{item.recentAdds}</span> this week
          </span>
          <span className="text-muted-foreground">
            {item.completionRate !== null ? (
              <>
                <span className="text-foreground font-medium">{item.completionRate}%</span> done
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

// ──────────────────────────────────────────────────────────────
// Now Airing 카드 — D-Day + Google Calendar 버튼
// ──────────────────────────────────────────────────────────────
function NowAiringCard({
  drama,
  onOpenDetail,
}: {
  drama: ApiDrama
  onOpenDetail: (id: string) => void
}) {
  const dDayLabel = buildDDayLabel(drama.nextEpisodeDate)
  const canSchedule = drama.nextEpisodeDate != null

  const handleAddToCalendar = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!canSchedule) return
    const url = buildGoogleCalendarUrlForDrama(
      drama.title,
      drama.nextEpisodeDate!,
      drama.overview ?? undefined
    )
    window.open(url, "_blank", "noopener,noreferrer")
  }

  return (
    <div
      className="flex-shrink-0 w-[260px] bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/50 transition-colors"
    >
      <button
        type="button"
        onClick={() => onOpenDetail(drama.id)}
        className="w-full aspect-video bg-[#252525] relative"
      >
        {(drama.backdropPath || drama.posterUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={drama.backdropPath ?? drama.posterUrl!}
            alt={drama.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
            No backdrop
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute bottom-2 left-3 right-3 text-left">
          <p className="text-white text-sm font-semibold line-clamp-1">{drama.title}</p>
        </div>
      </button>
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "rgba(34, 197, 94, 0.15)", color: "#22c55e" }}
          >
            On Air
          </span>
          <span className="text-foreground text-xs font-medium">{dDayLabel}</span>
        </div>
        <button
          type="button"
          onClick={handleAddToCalendar}
          disabled={!canSchedule}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-[#252525] hover:bg-[#2f2f2f] text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <CalendarPlus className="w-3.5 h-3.5" />
          Add to Google Calendar
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Drama Detail Modal — Phase 2 신규
// ──────────────────────────────────────────────────────────────
function DramaDetailModal({
  dramaId,
  isPro,
  onClose,
  onAdd,
}: {
  dramaId: string | null
  isPro: boolean
  onClose: () => void
  onAdd: (id: string) => void
}) {
  const [drama, setDrama] = useState<ApiDrama | null>(null)
  const [ostArtists, setOstArtists] = useState<OstArtistApi[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pro 전용 AI 콘텐츠 — 모달 오픈 시 자동 fetch
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)
  const [aiCharacters, setAiCharacters] = useState<string | null>(null)
  const [aiCharactersLoading, setAiCharactersLoading] = useState(false)

  useEffect(() => {
    if (!dramaId) {
      setDrama(null)
      setOstArtists([])
      setAiSummary(null)
      setAiCharacters(null)
      return
    }
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    fetch(`/api/dramas/${dramaId}`, { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { drama: ApiDrama; ostArtists: OstArtistApi[] }) => {
        setDrama(body.drama)
        setOstArtists(body.ostArtists ?? [])
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return
        console.error("[drama-modal] fetch 실패:", err)
        setError("Failed to load drama details.")
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [dramaId])

  // Pro 전용 — summary / characters fetch (모달 열릴 때 한 번)
  useEffect(() => {
    if (!dramaId || !isPro) return
    const ctrl = new AbortController()

    setAiSummary(null)
    setAiSummaryLoading(true)
    fetch(`/api/dramas/${dramaId}/summary`, { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { summary: string }) => setAiSummary(body.summary))
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return
        // 시놉시스 부족 등 422 정상 — silently null
        setAiSummary(null)
      })
      .finally(() => setAiSummaryLoading(false))

    setAiCharacters(null)
    setAiCharactersLoading(true)
    fetch(`/api/dramas/${dramaId}/characters`, { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { content: string }) => setAiCharacters(body.content))
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return
        setAiCharacters(null)
      })
      .finally(() => setAiCharactersLoading(false))

    return () => ctrl.abort()
  }, [dramaId, isPro])

  // ESC 키 닫기
  useEffect(() => {
    if (!dramaId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [dramaId, onClose])

  if (!dramaId) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-[#141418] border border-border/30 rounded-2xl overflow-hidden max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <div className="relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center"
            aria-label="Close"
          >
            <CloseIcon className="w-4 h-4 text-white" />
          </button>

          {/* Backdrop */}
          <div className="w-full aspect-video bg-[#252525] relative">
            {drama && (drama.backdropPath || drama.posterUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={drama.backdropPath ?? drama.posterUrl!}
                alt={drama.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-[#141418] via-[#141418]/50 to-transparent" />
            {drama && (
              <div className="absolute bottom-4 left-6 right-6">
                <h2 className="text-white text-2xl font-bold mb-1">{drama.title}</h2>
                {drama.originalName && drama.originalName !== drama.title && (
                  <p className="text-white/70 text-sm">{drama.originalName}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-6">
          {loading && (
            <p className="text-muted-foreground text-sm">Loading...</p>
          )}
          {error && !loading && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          {drama && !loading && (
            <div className="space-y-6">
              {/* Meta row — status, year, episodes, seasons, rating, platform */}
              <div className="flex items-center gap-3 flex-wrap text-sm">
                {drama.status && <StatusPill status={drama.status} />}
                <span className="text-muted-foreground">{drama.year ?? "—"}</span>
                {drama.numberOfEpisodes != null && (
                  <span className="text-muted-foreground">
                    · {drama.numberOfEpisodes} eps
                  </span>
                )}
                {drama.numberOfSeasons != null && drama.numberOfSeasons > 1 && (
                  <span className="text-muted-foreground">
                    · {drama.numberOfSeasons} seasons
                  </span>
                )}
                {drama.lastAirDate && drama.status === "completed" && (
                  <span className="text-muted-foreground">
                    · Ended {new Date(drama.lastAirDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </span>
                )}
                <span className="flex items-center gap-1 ml-auto">
                  <Star className="w-3.5 h-3.5" style={{ color: "#FF4B6E" }} fill="#FF4B6E" />
                  <span className="text-foreground font-medium">
                    {drama.rating != null ? drama.rating.toFixed(1) : "—"}
                  </span>
                </span>
              </div>

              {/* Overview */}
              {drama.overview && (
                <p className="text-foreground/90 text-sm leading-relaxed">{drama.overview}</p>
              )}

              {/* CTA row — Add to watchlist + Trailer + Watch */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={() => onAdd(drama.id)}
                  className="rounded-full text-white"
                  style={{ backgroundColor: "#FF4B6E" }}
                >
                  <Plus className="w-4 h-4 mr-1" /> Add to watchlist
                </Button>
                {drama.trailerKey && (
                  <a
                    href={`https://www.youtube.com/watch?v=${drama.trailerKey}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 h-10 rounded-full text-sm font-medium bg-[#252525] hover:bg-[#2f2f2f] text-foreground transition-colors"
                  >
                    <Play className="w-4 h-4" /> Watch trailer
                  </a>
                )}
                {drama.watchProviders?.link && (
                  <a
                    href={drama.watchProviders.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 h-10 rounded-full text-sm font-medium bg-[#252525] hover:bg-[#2f2f2f] text-foreground transition-colors"
                  >
                    Where to watch <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* OTT providers */}
              {drama.watchProviders?.flatrate && drama.watchProviders.flatrate.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">
                    Streaming
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {drama.watchProviders.flatrate.map((p) => (
                      <span
                        key={p.provider_id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-border/30 text-xs text-foreground"
                      >
                        {p.logo_path && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.logo_path} alt="" className="w-4 h-4 rounded" />
                        )}
                        {p.provider_name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Networks */}
              {drama.networks && drama.networks.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">
                    Network
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {drama.networks.map((n) => (
                      <span
                        key={n.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-border/30 text-xs text-foreground"
                      >
                        {n.logo_path && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={n.logo_path} alt="" className="w-4 h-4 rounded" />
                        )}
                        {n.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Cast Top 5 */}
              {drama.castMembers && drama.castMembers.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-3">
                    Cast
                  </p>
                  <div className="grid grid-cols-5 gap-3">
                    {drama.castMembers.slice(0, 5).map((c, idx) => (
                      <div key={`${c.name}-${idx}`} className="text-center">
                        <div className="w-full aspect-square rounded-full bg-[#252525] overflow-hidden mb-1.5">
                          {c.profile_path ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.profile_path}
                              alt={c.name}
                              className="w-full h-full object-cover"
                            />
                          ) : null}
                        </div>
                        <p className="text-foreground text-xs font-medium line-clamp-1">{c.name}</p>
                        <p className="text-muted-foreground text-[10px] line-clamp-1">{c.character}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* OST Artists */}
              {ostArtists.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-3">
                    OST Artists
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    {ostArtists.map((a) => (
                      <Link
                        key={a.id}
                        href={`/kpop/${a.id}`}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-border/30 hover:border-primary/50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#252525] overflow-hidden">
                          {a.thumbnailUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={a.thumbnailUrl}
                              alt={a.name}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <span className="text-foreground text-sm font-medium">{a.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Pro 전용 — AI episode summary */}
              {isPro && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" style={{ color: "#FF4B6E" }} />
                    AI Episode Summary
                  </p>
                  {aiSummaryLoading ? (
                    <p className="text-muted-foreground text-sm">Generating...</p>
                  ) : aiSummary ? (
                    <p className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap">
                      {aiSummary}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Summary unavailable for this drama.
                    </p>
                  )}
                </div>
              )}

              {/* Pro 전용 — AI character map */}
              {isPro && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" style={{ color: "#FF4B6E" }} />
                    Character Map
                  </p>
                  {aiCharactersLoading ? (
                    <p className="text-muted-foreground text-sm">Generating...</p>
                  ) : aiCharacters ? (
                    <p className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap">
                      {aiCharacters}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Character map unavailable for this drama.
                    </p>
                  )}
                </div>
              )}

              {/* 비-Pro 잠금 안내 */}
              {!isPro && (
                <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-4 flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
                  >
                    <Lock className="w-4 h-4" style={{ color: "#FF4B6E" }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-foreground text-sm font-medium">
                      AI episode summary &amp; character map
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Coming with Hallyu Pass.
                    </p>
                  </div>
                  <Link
                    href="/signup"
                    className="text-xs font-medium px-3 py-1.5 rounded-full text-white whitespace-nowrap"
                    style={{ backgroundColor: "#FF4B6E" }}
                  >
                    Notify me at launch
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────
export default function KdramaMatchPage() {
  const router = useRouter()

  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [selectedMoods, setSelectedMoods] = useState<string[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [showRecommendations, setShowRecommendations] = useState(false)

  const [recommendations, setRecommendations] = useState<ApiRecommendDrama[]>([])
  const [recommendLoading, setRecommendLoading] = useState(false)
  const [recommendError, setRecommendError] = useState<string | null>(null)

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isPro, setIsPro] = useState(false)

  const [browseGenres, setBrowseGenres] = useState<string[]>([])
  const [browseStatus, setBrowseStatus] = useState<("ongoing" | "completed")[]>([])
  const [browseYear, setBrowseYear] = useState<string>("all")
  const [browseAll, setBrowseAll] = useState<ApiDrama[]>([])
  const [browseLoading, setBrowseLoading] = useState(true)

  const [trending, setTrending] = useState<TrendingItem[]>([])
  const [nowAiring, setNowAiring] = useState<ApiDrama[]>([])

  // Drama detail modal — 단일 modal 인스턴스 + 활성 drama_id
  const [modalDramaId, setModalDramaId] = useState<string | null>(null)
  const openModal = useCallback((id: string) => setModalDramaId(id), [])
  const closeModal = useCallback(() => setModalDramaId(null), [])

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

  // 2. Browse all fetch
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

  // 3. Trending fetch
  useEffect(() => {
    fetch("/api/dramas/trending")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { trending: TrendingItem[] }) => setTrending(body.trending ?? []))
      .catch((err) => {
        console.error("[drama] trending fetch 실패:", err)
        setTrending([])
      })
  }, [])

  // 4. Now Airing fetch — on_the_air=true, next_episode 정렬, Top 6
  useEffect(() => {
    fetch("/api/dramas?on_the_air=true&sort=next_episode")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { dramas: ApiDrama[] }) => setNowAiring((body.dramas ?? []).slice(0, 6)))
      .catch((err) => {
        console.error("[drama] now-airing fetch 실패:", err)
        setNowAiring([])
      })
  }, [])

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
      <ServiceComingSoonBanner
        serviceName="KdramaMatch"
        serviceLabel="KdramaMatch"
        source="drama-page"
      />
      <main className="max-w-[1320px] mx-auto px-6 py-12">
        {/* ─── 1. Hero ──────────────────────────────── */}
        <section className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">KdramaMatch</h1>
          <p className="text-muted-foreground text-lg">
            AI-powered K-drama recommendations, just for you
          </p>
          <p className="text-muted-foreground/70 text-xs mt-3">
            {isAuthenticated === false
              ? "Guests: 3 picks per request · sign in for 5"
              : "5 AI picks per request — free during preview"}
          </p>
        </section>

        {/* ─── 2. Now Airing ─────────────────────────── */}
        {nowAiring.length > 0 && (
          <section className="mb-16">
            <div className="flex items-center gap-2 mb-6">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block animate-pulse"
                style={{ backgroundColor: "#22c55e" }}
              />
              <h2 className="text-2xl font-semibold text-foreground">Now Airing</h2>
              <span className="text-muted-foreground text-sm">· Next episode countdown</span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-6 px-6">
              {nowAiring.map((d) => (
                <NowAiringCard key={d.id} drama={d} onOpenDetail={openModal} />
              ))}
            </div>
          </section>
        )}

        {/* ─── 3. Taste onboarding ────────────────────── */}
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

        {/* ─── 4. Top picks ──────────────────────────── */}
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
                  <DramaCard
                    key={d.id}
                    drama={d}
                    onAdd={handleAddToWatchlist}
                    onOpenDetail={openModal}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ─── 5. Trending ───────────────────────────── */}
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
                <TrendingCard
                  key={item.drama.id}
                  item={item}
                  onAdd={handleAddToWatchlist}
                  onOpenDetail={openModal}
                />
              ))}
            </div>
          </section>
        )}

        {/* ─── 6. Browse all ────────────────────────── */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Browse all dramas</h2>

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
                <DramaCard
                  key={d.id}
                  drama={d}
                  onAdd={handleAddToWatchlist}
                  onOpenDetail={openModal}
                />
              ))}
            </div>
          )}
        </section>

        {/* ─── 7. AI Drama Summary (Pro) ────────────── */}
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

        {/* ─── 8. /mypage/dramas CTA ──────────────── */}
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

      {/* Drama detail modal — 단일 인스턴스, 활성 id 로 트리거 */}
      <DramaDetailModal
        dramaId={modalDramaId}
        isPro={isPro}
        onClose={closeModal}
        onAdd={handleAddToWatchlist}
      />
    </div>
  )
}
