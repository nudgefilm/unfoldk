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

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
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
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  MessageCircle,
  UtensilsCrossed,
  MapPin,
} from "lucide-react"
import Link from "next/link"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { hasProAccess } from "@/lib/auth/plan"
import { AuthGate } from "@/components/auth-gate"
import type { DramaApi } from "@/lib/dramas/mapper"

// 필터 칩 옵션
const GENRES = ["Romance", "Thriller", "Comedy", "Fantasy", "Historical"]
const MOODS = ["Heartwarming", "Intense", "Light", "Emotional"]
const EMOTION_MOODS = ["Bittersweet ending", "Slow-burn romance", "Satisfying revenge", "Found family", "Tear-jerker"]
const PLATFORMS = ["Netflix", "Viki", "Disney+"]

// Browse All 전용 필터 (Phase 2.1) — 모두 단일 선택형
const BROWSE_STATUS_OPTIONS: { label: string; value: "all" | "ongoing" | "completed" }[] = [
  { label: "All", value: "all" },
  { label: "On Air", value: "ongoing" },
  { label: "Ended", value: "completed" },
]

const BROWSE_PLATFORM_OPTIONS: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Netflix", value: "Netflix" },
  { label: "Viki", value: "Viki" },
  { label: "Disney+", value: "Disney+" },
  { label: "Amazon", value: "Amazon" },
]

type BrowseSort = "popularity" | "rating" | "latest" | "next_episode"
const BROWSE_SORT_OPTIONS: { label: string; value: BrowseSort }[] = [
  { label: "Popularity", value: "popularity" },
  { label: "Rating", value: "rating" },
  { label: "Latest", value: "latest" },
  { label: "Next Episode", value: "next_episode" },
]

// 페이지네이션 — 페이지당 24건 (4×6 grid)
const BROWSE_PAGE_SIZE = 24

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

// next_episode_date → D-Day 라벨 (Asia/Seoul 기준)
//
// 규칙 (Phase 2.1 — 2026-05-18):
//   - null 또는 과거 날짜 → "Check official schedule"
//     (next_episode_date 가 오늘보다 과거면 TMDB 데이터가 stale — 다음 ingest 까지 신뢰 X)
//   - 오늘 = 정확히 동일 YYYY-MM-DD → "New episode today!"
//   - 내일 (+1) → "New episode tomorrow"
//   - 2~6일 후 → "New episode in N days"
//   - 7일 이상 → "Mar 25" 같은 절대 날짜
//
// 날짜 비교는 Asia/Seoul 기준 — 한국 방영 일정 기준이라 글로벌 유저의 로컬 자정으로 잘못 판정하는 케이스 차단
function buildDDayLabel(nextEpisodeDate: string | null): string {
  if (!nextEpisodeDate) return "Check official schedule"

  // Asia/Seoul 오늘 YYYY-MM-DD — sv-SE locale 이 ISO 형식 출력
  const seoulToday = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })

  if (nextEpisodeDate === seoulToday) return "New episode today!"
  if (nextEpisodeDate < seoulToday) return "Check official schedule" // 과거 — stale data

  // 미래 날짜 — 일수 계산 (UTC 자정 기준 — 양쪽 같은 TZ 라 결과 동일)
  const target = new Date(nextEpisodeDate + "T00:00:00Z")
  const today = new Date(seoulToday + "T00:00:00Z")
  const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))

  if (diffDays === 1) return "New episode tomorrow"
  if (diffDays <= 6) return `New episode in ${diffDays} days`
  return target.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

// 페이지네이션 번호 배열 빌더 (Phase 2.1)
//
// 현재 페이지 기준 ±2 범위 + 처음/마지막 + 필요 시 생략 부호.
// 예: 총 10페이지, 현재 5 → [1, "...", 3, 4, 5, 6, 7, "...", 10]
//     총 3페이지, 현재 2 → [1, 2, 3]
function buildPageNumbers(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const out: Array<number | "ellipsis"> = []
  out.push(1)
  if (current > 4) out.push("ellipsis")
  const start = Math.max(2, current - 2)
  const end = Math.min(total - 1, current + 2)
  for (let p = start; p <= end; p++) out.push(p)
  if (current < total - 3) out.push("ellipsis")
  out.push(total)
  return out
}

// 표시용 제목 선택 — 영문 우선, 없으면 한글 fallback (Phase 2.1)
//
// 이미 ingest 단계에서 title = c.name (영문) || c.original_name (한글) fallback 처리됨.
// 따라서 drama.title 은 항상 무언가 들어있음 (DB NOT NULL).
// 본 헬퍼는 frontend 단의 추가 방어층 — title 이 (예: 빈 문자열) 인 경우만 originalName fallback.
function getDisplayTitle(drama: ApiDrama): string {
  const t = (drama.title ?? "").trim()
  if (t) return t
  const o = (drama.originalName ?? "").trim()
  return o || "Untitled"
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
// 2026년 드라마는 Pro 잠금 (KdramaMatch Free/Pro 확정 스펙 2026-06-01).
function DramaCard({
  drama,
  onAdd,
  onOpenDetail,
  isSaved,
  onToggleSave,
  isPro,
  onProLocked,
}: {
  drama: ApiDrama
  onAdd: (dramaId: string) => void
  onOpenDetail: (dramaId: string) => void
  isSaved?: boolean
  onToggleSave?: (dramaId: string) => void
  isPro?: boolean
  onProLocked?: () => void
}) {
  const displayTitle = getDisplayTitle(drama)
  // 2026년 이상 드라마 + 비-Pro → 상세 잠금
  const isLocked = drama.year === 2026 && !isPro

  const handleDetailClick = () => {
    if (isLocked) { onProLocked?.(); return }
    onOpenDetail(drama.id)
  }

  return (
    <div className="bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/50 transition-colors group">
      <button
        type="button"
        onClick={handleDetailClick}
        className="w-full aspect-[2/3] bg-[#252525] flex items-center justify-center relative text-left"
      >
        {drama.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={drama.posterUrl}
            alt={displayTitle}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <span className="text-muted-foreground text-sm">Poster</span>
        )}
        {/* 상태 필 — 비잠금 카드만 */}
        {drama.status && !isLocked && (
          <div className="absolute top-2 left-2">
            <StatusPill status={drama.status} />
          </div>
        )}
        {/* 2026 Pro 뱃지 — 우상단 */}
        {isLocked && (
          <div className="absolute top-2 right-2 z-10">
            <span
              className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "rgba(255,75,110,0.92)", color: "white" }}
            >
              <Lock className="w-2.5 h-2.5" /> Pro
            </span>
          </div>
        )}
        {/* hover 오버레이 — 잠금 시 "Unlock with Hallyu Pass", 일반 시 Play */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {isLocked ? (
            <div className="text-center px-4">
              <Lock className="w-8 h-8 text-white mx-auto mb-2" />
              <p className="text-white text-xs font-medium leading-snug">Unlock with<br />Hallyu Pass</p>
            </div>
          ) : (
            <Play className="w-12 h-12 text-white" fill="white" />
          )}
        </div>
        {/* 북마크 — 비잠금 카드만 */}
        {!isLocked && onToggleSave && (
          <div
            role="button"
            tabIndex={0}
            title={isSaved ? "Saved" : "Save"}
            aria-label={isSaved ? "Remove from My Dramas" : "Save to My Dramas"}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave(drama.id) }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                e.stopPropagation()
                onToggleSave(drama.id)
              }
            }}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center hover:bg-black/75 transition-colors cursor-pointer"
          >
            {isSaved
              ? <BookmarkCheck className="w-4 h-4" style={{ color: "#FF4B6E" }} />
              : <Bookmark className="w-4 h-4 text-white" />
            }
          </div>
        )}
      </button>

      <div className="p-4">
        <h3 className="text-foreground font-semibold text-sm mb-2 line-clamp-1">
          {displayTitle}
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
            onClick={handleDetailClick}
            className="text-xs font-medium flex items-center gap-1 hover:underline"
            style={{ color: isLocked ? "#888" : "#FF4B6E" }}
          >
            {isLocked ? <Lock className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {isLocked ? "Pro only" : "Details"}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAdd(drama.id) }}
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
  isPro,
  onProLocked,
}: {
  item: TrendingItem
  onAdd: (id: string) => void
  onOpenDetail: (id: string) => void
  isPro?: boolean
  onProLocked?: () => void
}) {
  const d = item.drama
  const displayTitle = getDisplayTitle(d)
  const isLocked = d.year === 2026 && !isPro

  const handleClick = () => {
    if (isLocked) { onProLocked?.(); return }
    onOpenDetail(d.id)
  }

  return (
    <div className="flex-shrink-0 w-[180px] bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/50 transition-colors group">
      <button
        type="button"
        onClick={handleClick}
        className="w-full aspect-[2/3] bg-[#252525] relative"
      >
        {d.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={d.posterUrl}
            alt={displayTitle}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
            Poster
          </div>
        )}
        {d.status && !isLocked && (
          <div className="absolute top-2 left-2">
            <StatusPill status={d.status} />
          </div>
        )}
        {isLocked && (
          <div className="absolute top-2 right-2 z-10">
            <span
              className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "rgba(255,75,110,0.92)", color: "white" }}
            >
              <Lock className="w-2.5 h-2.5" /> Pro
            </span>
          </div>
        )}
        {/* hover 오버레이 */}
        {isLocked && (
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="text-center px-2">
              <Lock className="w-6 h-6 text-white mx-auto mb-1" />
              <p className="text-white text-[10px] font-medium leading-snug">Unlock with<br />Hallyu Pass</p>
            </div>
          </div>
        )}
        {!isLocked && (
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
        )}
      </button>
      <div className="p-3">
        <h4 className="text-foreground font-medium text-sm line-clamp-1">{displayTitle}</h4>
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
  isPro,
  onProLocked,
}: {
  drama: ApiDrama
  onOpenDetail: (id: string) => void
  isPro?: boolean
  onProLocked?: () => void
}) {
  const displayTitle = getDisplayTitle(drama)
  const isLocked = drama.year === 2026 && !isPro
  const dDayLabel = buildDDayLabel(drama.nextEpisodeDate)
  // Asia/Seoul 기준 next_episode_date 가 오늘 이상 (미래 포함) 일 때만 캘린더 등록 의미 있음.
  // 과거·null 은 stale 또는 미확정이라 추가 비활성.
  const canSchedule = (() => {
    if (!drama.nextEpisodeDate) return false
    const seoulToday = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })
    return drama.nextEpisodeDate >= seoulToday
  })()

  const handleAddToCalendar = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!canSchedule) return
    const url = buildGoogleCalendarUrlForDrama(
      displayTitle,
      drama.nextEpisodeDate!,
      drama.overview ?? undefined
    )
    window.open(url, "_blank", "noopener,noreferrer")
  }

  return (
    <div
      data-na-card
      className="flex-shrink-0 w-[260px] bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/50 transition-colors snap-start group"
    >
      <button
        type="button"
        onClick={() => {
          if (isLocked) { onProLocked?.(); return }
          onOpenDetail(drama.id)
        }}
        className="w-full aspect-video bg-[#252525] relative"
      >
        {(drama.backdropPath || drama.posterUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={drama.backdropPath ?? drama.posterUrl!}
            alt={displayTitle}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
            No backdrop
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        {/* 2026 Pro 뱃지 */}
        {isLocked && (
          <div className="absolute top-2 right-2 z-10">
            <span
              className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "rgba(255,75,110,0.92)", color: "white" }}
            >
              <Lock className="w-2.5 h-2.5" /> Pro
            </span>
          </div>
        )}
        {/* 잠금 hover 오버레이 */}
        {isLocked && (
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="text-center px-4">
              <Lock className="w-7 h-7 text-white mx-auto mb-1.5" />
              <p className="text-white text-xs font-medium leading-snug">Unlock with Hallyu Pass</p>
            </div>
          </div>
        )}
        <div className="absolute bottom-2 left-3 right-3 text-left">
          <p className="text-white text-sm font-semibold line-clamp-1">{displayTitle}</p>
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
        {/* 캘린더 버튼은 잠금과 무관하게 유지 (방영 일정 등록은 Pro 불필요) */}
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

          {/* Backdrop + 제목 */}
          {/* displayTitle 은 영문 우선 → 한글 fallback. originalName 은 한글 (있을 때만 subtitle). */}
          <div className="w-full aspect-video bg-[#252525] relative">
            {drama && (drama.backdropPath || drama.posterUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={drama.backdropPath ?? drama.posterUrl!}
                alt={getDisplayTitle(drama)}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-[#141418] via-[#141418]/50 to-transparent" />
            {drama && (
              <div className="absolute bottom-4 left-6 right-6">
                <h2 className="text-white text-2xl font-bold mb-1">{getDisplayTitle(drama)}</h2>
                {drama.originalName &&
                  drama.originalName.trim() &&
                  drama.originalName !== getDisplayTitle(drama) && (
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

              {/* Pro 전용 — AI episode summary + character map (Phase 2.1)
                  비-Pro 도 항상 렌더링하되 blur + 오버레이 — 페이지 하단 "AI Drama Summary" 섹션 동일 패턴.
                  Pro 미체결 유저에게 가치 미리보기 + 결제 유도. */}
              <div className="relative">
                <div
                  className={`space-y-6 ${
                    isPro ? "" : "blur-[4px] pointer-events-none select-none"
                  }`}
                >
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5" style={{ color: "#FF4B6E" }} />
                      UnfoldK Episode Summary
                    </p>
                    {isPro && aiSummaryLoading ? (
                      <p className="text-muted-foreground text-sm">Generating...</p>
                    ) : isPro && aiSummary ? (
                      <p className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap">
                        {aiSummary}
                      </p>
                    ) : isPro ? (
                      <p className="text-muted-foreground text-sm">
                        Summary unavailable for this drama.
                      </p>
                    ) : (
                      // 비-Pro placeholder — blur 처리되어 실제 내용 보이지 않음, 레이아웃 공간 확보용
                      <p className="text-foreground/90 text-sm leading-relaxed">
                        Episode-by-episode UnfoldK summary highlighting key plot points, character
                        development, and emotional beats — generated from the synopsis.
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5" style={{ color: "#FF4B6E" }} />
                      Character Map
                    </p>
                    {isPro && aiCharactersLoading ? (
                      <p className="text-muted-foreground text-sm">Generating...</p>
                    ) : isPro && aiCharacters ? (
                      <p className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap">
                        {aiCharacters}
                      </p>
                    ) : isPro ? (
                      <p className="text-muted-foreground text-sm">
                        Character map unavailable for this drama.
                      </p>
                    ) : (
                      <p className="text-foreground/90 text-sm leading-relaxed">
                        Main characters with relationships, family ties, and romantic arcs across
                        the series — auto-generated for every drama.
                      </p>
                    )}
                  </div>
                </div>

                {!isPro && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-[#1a1a1a] border border-border/50 rounded-xl p-5 text-center shadow-xl max-w-sm">
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-3"
                        style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
                      >
                        <Lock className="w-5 h-5" style={{ color: "#FF4B6E" }} />
                      </div>
                      <p className="text-foreground font-medium mb-1.5">
                        Coming with Hallyu Pass
                      </p>
                      <p className="text-muted-foreground text-xs mb-4">
                        UnfoldK episode summary + character map arrive at launch.
                      </p>
                      <Link
                        href="/signup"
                        className="inline-block text-xs font-medium px-4 py-2 rounded-full text-white whitespace-nowrap"
                        style={{ backgroundColor: "#FF4B6E" }}
                      >
                        Notify me at launch
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Cross-service links — 2×2 카드 그리드 */}
              {drama && (
                <div className="border-t border-border/20 pt-5 mt-2">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-3">Explore more</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        href: `/korean?drama=${encodeURIComponent(getDisplayTitle(drama))}`,
                        icon: <MessageCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#FF4B6E" }} />,
                        title: "Learn Korean",
                        sub: "from this drama →",
                      },
                      {
                        href: `/food?drama=${encodeURIComponent(getDisplayTitle(drama))}`,
                        icon: <UtensilsCrossed className="w-4 h-4 flex-shrink-0" style={{ color: "#FF4B6E" }} />,
                        title: "Cook the food",
                        sub: "from this drama →",
                      },
                      {
                        href: `/curation-k?drama=${encodeURIComponent(getDisplayTitle(drama))}`,
                        icon: <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: "#FF4B6E" }} />,
                        title: "Filming locations",
                        sub: "visit real spots →",
                      },
                      {
                        href: `/calendar`,
                        icon: <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: "#FF4B6E" }} />,
                        title: "Related events",
                        sub: "check calendar →",
                      },
                    ].map(({ href, icon, title, sub }) => (
                      <Link
                        key={href}
                        href={href}
                        className="flex items-center gap-2.5 bg-[#252528] hover:bg-[#2e2e32] rounded-xl px-3 py-3 transition-colors group"
                      >
                        {icon}
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{title}</p>
                          <p className="text-[10px] text-muted-foreground truncate group-hover:text-foreground/70 transition-colors">{sub}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
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
// useSearchParams 는 Suspense 경계 필수 — 정적 prerender 안전 처리 (login/page.tsx 동일 패턴).
export default function KdramaMatchPage() {
  return (
    <Suspense fallback={null}>
      <KdramaMatchPageInner />
    </Suspense>
  )
}

function KdramaMatchPageInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [selectedMoods, setSelectedMoods] = useState<string[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [showRecommendations, setShowRecommendations] = useState(false)

  const [recommendations, setRecommendations] = useState<ApiRecommendDrama[]>([])
  const [recommendLoading, setRecommendLoading] = useState(false)
  const [recommendError, setRecommendError] = useState<string | null>(null)

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isPro, setIsPro] = useState(false)
  // 저장된 드라마 Set — watchlist 기반 (any status)
  const [savedDramaIds, setSavedDramaIds] = useState<Set<string>>(new Set())
  // 2026 드라마 Pro 게이트 모달
  const [proGateOpen, setProGateOpen] = useState(false)
  const handleProLocked = () => setProGateOpen(true)

  // Browse All — URL 쿼리 파라미터에서 초기 상태 읽기 (뒤로가기 시 필터 유지)
  //   ?genre=Romance&genre=Thriller  (multi)
  //   ?status=ongoing | completed | (omit=all)
  //   ?year=2024 | (omit=all)
  //   ?platform=Netflix | (omit=all)
  //   ?sort=popularity (default) | rating | latest | next_episode
  //   ?page=2 (default 1)
  const [browseGenres, setBrowseGenres] = useState<string[]>(() =>
    searchParams.getAll("genre")
  )
  const [browseStatus, setBrowseStatus] = useState<"all" | "ongoing" | "completed">(() => {
    const s = searchParams.get("status")
    return s === "ongoing" || s === "completed" ? s : "all"
  })
  const [browseYear, setBrowseYear] = useState<string>(() =>
    searchParams.get("year") ?? "all"
  )
  const [browsePlatform, setBrowsePlatform] = useState<string>(() =>
    searchParams.get("platform") ?? "all"
  )
  const [browseSort, setBrowseSort] = useState<BrowseSort>(() => {
    const s = searchParams.get("sort")
    return s === "rating" || s === "latest" || s === "next_episode" || s === "popularity"
      ? s
      : "popularity"
  })
  const [browsePage, setBrowsePage] = useState<number>(() => {
    const p = Number(searchParams.get("page"))
    return Number.isInteger(p) && p > 0 ? p : 1
  })

  const [browseAll, setBrowseAll] = useState<ApiDrama[]>([])
  const [browseTotal, setBrowseTotal] = useState<number>(0)
  const [browseLoading, setBrowseLoading] = useState(true)

  // Browse All 섹션 ref — 페이지 변경 시 자동 스크롤 타깃
  const browseSectionRef = useRef<HTMLElement>(null)

  const [trending, setTrending] = useState<TrendingItem[]>([])
  const [nowAiring, setNowAiring] = useState<ApiDrama[]>([])

  // Now Airing 가로 스크롤 — calendar Featured 패턴 (clientWidth step) + 양끝 화살표 노출 제어
  // 2026-05-19 카드 1개씩 step 에서 컨테이너 width step 으로 통일
  const nowAiringScrollRef = useRef<HTMLDivElement>(null)
  const [naCanScrollLeft, setNaCanScrollLeft] = useState(false)
  const [naCanScrollRight, setNaCanScrollRight] = useState(false)

  const updateNaScrollState = useCallback(() => {
    const el = nowAiringScrollRef.current
    if (!el) return
    // 부동소수 오차 1px 허용
    setNaCanScrollLeft(el.scrollLeft > 0)
    setNaCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  const scrollNowAiring = (dir: "left" | "right") => {
    const el = nowAiringScrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === "left" ? -el.clientWidth : el.clientWidth, behavior: "smooth" })
  }

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
        .select("plan_type, is_admin, trial_ends_at")
        .eq("id", user.id)
        .single()
      const row = profile as { plan_type?: string; is_admin?: boolean; trial_ends_at?: string | null } | null
      setIsPro(hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin, trialEndsAt: row?.trial_ends_at }))

      // 저장된 드라마 목록 로드 (watchlist any status)
      fetch("/api/dramas/watchlist")
        .then((res) => (res.ok ? res.json() : Promise.reject(res)))
        .then((body: { items: Array<{ drama: { id: string } | null }> }) => {
          const ids = (body.items ?? [])
            .map((i) => i.drama?.id)
            .filter((id): id is string => !!id)
          setSavedDramaIds(new Set(ids))
        })
        .catch(() => {})
    })
  }, [])

  // 2. Browse all fetch + URL 동기화 (Phase 2.1)
  //    fetch query 와 URL 쿼리 모두 동일 파라미터로 빌드. 페이지네이션 offset 계산 = (page-1)*size.
  useEffect(() => {
    const ctrl = new AbortController()

    // API 호출용 쿼리
    const apiParams = new URLSearchParams()
    for (const g of browseGenres) apiParams.append("genre", g)
    if (browseStatus !== "all") apiParams.append("status", browseStatus)
    if (browseYear !== "all") apiParams.append("year", browseYear)
    if (browsePlatform !== "all") apiParams.append("platform", browsePlatform)
    apiParams.set("sort", browseSort)
    apiParams.set("limit", String(BROWSE_PAGE_SIZE))
    apiParams.set("offset", String((browsePage - 1) * BROWSE_PAGE_SIZE))

    // URL 동기화 — 사용자 facing 쿼리는 page 만 노출 (offset/limit 은 내부 계산)
    const urlParams = new URLSearchParams()
    for (const g of browseGenres) urlParams.append("genre", g)
    if (browseStatus !== "all") urlParams.set("status", browseStatus)
    if (browseYear !== "all") urlParams.set("year", browseYear)
    if (browsePlatform !== "all") urlParams.set("platform", browsePlatform)
    if (browseSort !== "popularity") urlParams.set("sort", browseSort)
    if (browsePage !== 1) urlParams.set("page", String(browsePage))
    const queryStr = urlParams.toString()
    const nextUrl = queryStr ? `${pathname}?${queryStr}` : pathname
    // 현재 URL 과 동일하면 replace 생략 (불필요한 re-render 방지)
    if (window.location.search.replace(/^\?/, "") !== queryStr) {
      router.replace(nextUrl, { scroll: false })
    }

    setBrowseLoading(true)
    fetch(`/api/dramas?${apiParams.toString()}`, { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { dramas: ApiDrama[]; total: number | null }) => {
        setBrowseAll(body.dramas ?? [])
        setBrowseTotal(body.total ?? 0)
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return
        console.error("[drama] browse fetch 실패:", err)
        setBrowseAll([])
        setBrowseTotal(0)
      })
      .finally(() => setBrowseLoading(false))
    return () => ctrl.abort()
  }, [
    browseGenres,
    browseStatus,
    browseYear,
    browsePlatform,
    browseSort,
    browsePage,
    pathname,
    router,
  ])

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

  // Now Airing 스크롤 상태 동기화 — nowAiring 변경, 스크롤, 뷰포트 리사이즈 모두 반영
  useEffect(() => {
    if (nowAiring.length === 0) return
    // nowAiring 변경 직후 DOM 렌더 완료를 기다림 (rAF)
    const raf = requestAnimationFrame(updateNaScrollState)
    const el = nowAiringScrollRef.current
    if (!el) return () => cancelAnimationFrame(raf)
    el.addEventListener("scroll", updateNaScrollState, { passive: true })
    const ro = new ResizeObserver(updateNaScrollState)
    ro.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener("scroll", updateNaScrollState)
      ro.disconnect()
    }
  }, [nowAiring, updateNaScrollState])

  // 연도 옵션 — 최근 8년 + "All". 페이지네이션 도입 후 browseAll(현 페이지) 에서 추출하면 페이지마다
  // 옵션이 달라지는 문제 발생 → 고정 리스트로 박제.
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 8 }, (_, i) => currentYear - i)
  }, [])

  const toggleSelection = (
    item: string,
    selected: string[],
    setSelected: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (selected.includes(item)) setSelected(selected.filter((i) => i !== item))
    else setSelected([...selected, item])
  }

  // 필터 변경 시 페이지 1로 리셋하는 래퍼 (Phase 2.1)
  const toggleBrowseGenre = (g: string) => {
    setBrowseGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    )
    setBrowsePage(1)
  }
  const setBrowseStatusReset = (v: "all" | "ongoing" | "completed") => {
    setBrowseStatus(v)
    setBrowsePage(1)
  }
  const setBrowseYearReset = (v: string) => {
    setBrowseYear(v)
    setBrowsePage(1)
  }
  const setBrowsePlatformReset = (v: string) => {
    setBrowsePlatform(v)
    setBrowsePage(1)
  }
  const setBrowseSortReset = (v: BrowseSort) => {
    setBrowseSort(v)
    setBrowsePage(1)
  }

  // 페이지 변경 — Browse All 섹션 상단으로 부드럽게 스크롤
  const changeBrowsePage = (next: number) => {
    setBrowsePage(next)
    // 다음 프레임에 scroll — fetch 시작 시점과 분리
    requestAnimationFrame(() => {
      browseSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  const browseTotalPages = Math.max(1, Math.ceil(browseTotal / BROWSE_PAGE_SIZE))

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
        setSavedDramaIds((prev) => new Set([...prev, dramaId]))
      } catch (err) {
        console.error("[drama] watchlist add 실패:", err)
      }
    },
    [isAuthenticated, router]
  )

  // 북마크 토글 — want_to_watch 추가 / watchlist 삭제
  const handleToggleDramaSave = useCallback(
    async (dramaId: string) => {
      if (!isAuthenticated) {
        router.push("/login?redirect=/drama")
        return
      }
      const isSaved = savedDramaIds.has(dramaId)
      // optimistic
      setSavedDramaIds((prev) => {
        const next = new Set(prev)
        if (isSaved) next.delete(dramaId)
        else next.add(dramaId)
        return next
      })
      try {
        if (isSaved) {
          await fetch(`/api/dramas/watchlist?drama_id=${dramaId}`, { method: "DELETE" })
        } else {
          await fetch("/api/dramas/watchlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ drama_id: dramaId, status: "want_to_watch" }),
          })
        }
      } catch (err) {
        // rollback
        setSavedDramaIds((prev) => {
          const next = new Set(prev)
          if (isSaved) next.add(dramaId)
          else next.delete(dramaId)
          return next
        })
        console.error("[drama] 북마크 toggle 실패:", err)
      }
    },
    [isAuthenticated, router, savedDramaIds]
  )

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-[1320px] mx-auto px-6 pt-28 pb-12">
        {/* ─── 1. Hero ──────────────────────────────── */}
        {/* 2026-05-18 Phase 2.1 — Soon 배너 제거 (서비스 정식 노출).
            HangeulGo / KfoodKit 등 미구현 서비스는 ServiceComingSoonBanner 유지. */}
        <section className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">KdramaMatch</h1>
          <p className="text-muted-foreground text-lg">
            UnfoldK K-drama recommendations, curated just for you.
          </p>
          <p className="text-muted-foreground/70 text-xs mt-3">
            {isAuthenticated === false
              ? "Guests: 3 picks per request · sign in for 5"
              : "5 UnfoldK picks per request — free during preview"}
          </p>
        </section>

        {/* ─── 2. Now Airing ─────────────────────────── */}
        {/* 가로 스크롤 — 스크롤바 숨김 + 좌우 화살표 (카드 1개씩 step).
            HallyuCalendar Featured 패턴 변형: clientWidth 가 아닌 첫 카드 offsetWidth + gap.
            양끝 도달 시 해당 방향 화살표 자동 숨김 (naCanScrollLeft/Right). */}
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
            <div className="relative group">
              <div
                ref={nowAiringScrollRef}
                className="flex gap-4 overflow-x-auto pb-2 -mx-6 px-6 snap-x snap-proximity [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {nowAiring.map((d) => (
                  <AuthGate key={d.id} isLoggedIn={isAuthenticated} className="flex-shrink-0 snap-start">
                    <NowAiringCard drama={d} onOpenDetail={openModal} isPro={isPro} onProLocked={handleProLocked} />
                  </AuthGate>
                ))}
              </div>
              {naCanScrollLeft && (
                <button
                  type="button"
                  onClick={() => scrollNowAiring("left")}
                  aria-label="Scroll now airing left"
                  className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-[#1a1a1a]/90 backdrop-blur-sm border border-border/30 items-center justify-center text-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#1a1a1a]"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              {naCanScrollRight && (
                <button
                  type="button"
                  onClick={() => scrollNowAiring("right")}
                  aria-label="Scroll now airing right"
                  className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-[#1a1a1a]/90 backdrop-blur-sm border border-border/30 items-center justify-center text-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#1a1a1a]"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
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

              <div className="mb-6">
                <p className="text-muted-foreground text-sm mb-3">Emotional arc</p>
                <div className="flex flex-wrap gap-2">
                  {EMOTION_MOODS.map((m) => (
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
                {recommendLoading ? "Finding matches..." : "Get UnfoldK Recommendations"}
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
                  <AuthGate key={d.id} isLoggedIn={isAuthenticated}>
                    <DramaCard
                      drama={d}
                      onAdd={handleAddToWatchlist}
                      onOpenDetail={openModal}
                      isSaved={savedDramaIds.has(d.id)}
                      onToggleSave={handleToggleDramaSave}
                      isPro={isPro}
                      onProLocked={handleProLocked}
                    />
                  </AuthGate>
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
                <AuthGate key={item.drama.id} isLoggedIn={isAuthenticated} className="flex-shrink-0">
                  <TrendingCard
                    item={item}
                    onAdd={handleAddToWatchlist}
                    onOpenDetail={openModal}
                    isPro={isPro}
                    onProLocked={handleProLocked}
                  />
                </AuthGate>
              ))}
            </div>
          </section>
        )}

        {/* ─── 6. Browse all ──────────────────────────
            Phase 2.1 — 페이지당 24건 + 페이지네이션 + 필터 강화 (Status/Platform/Sort).
            필터 칩 스타일은 기존 Chip 컴포넌트 유지 (UI 동결). 필터 변경 시 page 1 리셋.
            URL 쿼리 동기화로 뒤로가기·새로고침에서 상태 보존. */}
        <section ref={browseSectionRef} className="mb-16 scroll-mt-24">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Browse all dramas</h2>

          <div className="space-y-3 mb-6">
            {/* Genre — 멀티 선택 */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-muted-foreground text-xs uppercase tracking-wider w-20 flex-shrink-0">
                Genre
              </span>
              {GENRES.map((g) => (
                <Chip
                  key={g}
                  label={g}
                  selected={browseGenres.includes(g)}
                  onClick={() => toggleBrowseGenre(g)}
                />
              ))}
            </div>

            {/* Status — 단일 선택 (All / On Air / Ended) */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-muted-foreground text-xs uppercase tracking-wider w-20 flex-shrink-0">
                Status
              </span>
              {BROWSE_STATUS_OPTIONS.map((s) => (
                <Chip
                  key={s.value}
                  label={s.label}
                  selected={browseStatus === s.value}
                  onClick={() => setBrowseStatusReset(s.value)}
                />
              ))}
            </div>

            {/* Platform — 단일 선택 (All / Netflix / Viki / Disney+ / Amazon) */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-muted-foreground text-xs uppercase tracking-wider w-20 flex-shrink-0">
                Platform
              </span>
              {BROWSE_PLATFORM_OPTIONS.map((p) => (
                <Chip
                  key={p.value}
                  label={p.label}
                  selected={browsePlatform === p.value}
                  onClick={() => setBrowsePlatformReset(p.value)}
                />
              ))}
            </div>

            {/* Year — 최근 8년 + All (옵션) */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-muted-foreground text-xs uppercase tracking-wider w-20 flex-shrink-0">
                Year
              </span>
              <Chip
                label="All years"
                selected={browseYear === "all"}
                onClick={() => setBrowseYearReset("all")}
              />
              {yearOptions.map((y) => (
                <Chip
                  key={y}
                  label={String(y)}
                  selected={browseYear === String(y)}
                  onClick={() => setBrowseYearReset(String(y))}
                />
              ))}
            </div>

            {/* Sort — 단일 선택 (Popularity / Rating / Latest / Next Episode) */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-muted-foreground text-xs uppercase tracking-wider w-20 flex-shrink-0">
                Sort
              </span>
              {BROWSE_SORT_OPTIONS.map((s) => (
                <Chip
                  key={s.value}
                  label={s.label}
                  selected={browseSort === s.value}
                  onClick={() => setBrowseSortReset(s.value)}
                />
              ))}
            </div>
          </div>

          {browseLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : browseAll.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No dramas match the current filters.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {browseAll.map((d) => (
                  <AuthGate key={d.id} isLoggedIn={isAuthenticated}>
                    <DramaCard
                      drama={d}
                      onAdd={handleAddToWatchlist}
                      onOpenDetail={openModal}
                      isSaved={savedDramaIds.has(d.id)}
                      onToggleSave={handleToggleDramaSave}
                      isPro={isPro}
                      onProLocked={handleProLocked}
                    />
                  </AuthGate>
                ))}
              </div>

              {/* 페이지네이션 — shadcn/ui Pagination (이전/페이지 번호/다음) */}
              {browseTotalPages > 1 && (
                <Pagination className="mt-8">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          if (browsePage > 1) changeBrowsePage(browsePage - 1)
                        }}
                        className={
                          browsePage <= 1
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>

                    {/* 페이지 번호 — 현재 페이지 ±2 + 처음/끝 + 생략 부호 */}
                    {buildPageNumbers(browsePage, browseTotalPages).map((p, idx) =>
                      p === "ellipsis" ? (
                        <PaginationItem key={`e-${idx}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={p}>
                          <PaginationLink
                            href="#"
                            isActive={p === browsePage}
                            onClick={(e) => {
                              e.preventDefault()
                              if (p !== browsePage) changeBrowsePage(p)
                            }}
                            className="cursor-pointer"
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    )}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          if (browsePage < browseTotalPages)
                            changeBrowsePage(browsePage + 1)
                        }}
                        className={
                          browsePage >= browseTotalPages
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          )}
        </section>

        {/* ─── 7. AI Drama Summary (Pro) ────────────── */}
        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-2xl font-semibold text-foreground">UnfoldK Drama Summary</h2>
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
                  UnfoldK summaries of key plot points, character development, and emotional
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
                  &ldquo;If you liked this, try…&rdquo; UnfoldK matches based on tone, themes, and
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
                  <AuthGate isLoggedIn={isAuthenticated}>
                  <Link href="/signup">
                    <Button
                      className="px-6 py-2 rounded-full font-medium text-white"
                      style={{ backgroundColor: "#FF4B6E" }}
                    >
                      Notify me at launch
                    </Button>
                  </Link>
                  </AuthGate>
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
            <AuthGate isLoggedIn={isAuthenticated}>
            <Link
              href={isAuthenticated === false ? "/signup" : "/mypage/dramas"}
              className="inline-flex items-center justify-center gap-1.5 text-sm font-medium px-5 h-11 rounded-full text-white whitespace-nowrap"
              style={{ backgroundColor: "#FF4B6E" }}
            >
              {isAuthenticated === false ? "Sign in to track" : "Manage my dramas →"}
            </Link>
            </AuthGate>
          </div>
        </section>
      </main>

      <FooterSection />

      {/* 2026 드라마 Pro 게이트 모달 */}
      {proGateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={() => setProGateOpen(false)}
        >
          <div
            className="relative bg-[#1a1a1a] border border-border/50 rounded-2xl p-6 text-center max-w-sm w-full shadow-xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setProGateOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
            >
              <Lock className="w-7 h-7" style={{ color: "#FF4B6E" }} />
            </div>
            <h3 className="text-foreground font-semibold text-lg mb-2">
              2026 Dramas — Coming with Hallyu Pass
            </h3>
            <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
              Full access to 2026 K-drama details, episode summaries, and character maps arrives with Hallyu Pass.
            </p>
            <Link
              href="/signup"
              className="inline-block text-sm font-medium px-6 py-2.5 rounded-full text-white"
              style={{ backgroundColor: "#FF4B6E" }}
              onClick={() => setProGateOpen(false)}
            >
              Notify me at launch
            </Link>
          </div>
        </div>
      )}

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
