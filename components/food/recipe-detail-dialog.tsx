"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Clock, Flame, Users, Loader2, Copy, Check, Bookmark, BookmarkCheck } from "lucide-react"

// KfoodKit — 레시피 상세 모달
//
// 카드 클릭 → 본 컴포넌트 마운트 → /api/food/recipes/[id] fetch.
// title_en/description_en 없으면 서버가 Claude Haiku 로 lazy 생성 후 응답 — 첫 로드만 느림.

interface NutritionShape {
  calorie_kcal?: number | null
  calorie_text?: string | null
  nation?: string | null
  type?: string | null
  level?: string | null
  qnt_text?: string | null
  cooking_time_text?: string | null
  summary?: string | null
}

interface RecipeDetail {
  id: string
  title: string
  title_en: string | null
  description_en: string | null
  image_url: string | null
  image_source: "mfds" | "unsplash" | null
  ready_in_minutes: number | null
  servings: number | null
  nutrition: NutritionShape | null
  ingredients: Array<{
    name: string
    name_en: string | null
    capacity: string | null
    type: string | null
  }>
  instructions: Array<{
    step: number
    instruction: string
    instruction_en: string | null
    tip: string | null
  }>
}

export function RecipeDetailDialog({
  recipeId,
  onClose,
  onCopyIngredient,
  isSaved = false,
  onToggleSave,
}: {
  recipeId: string | null
  onClose: () => void
  // 재료 옆 복사 버튼 클릭 시 호출 — 페이지가 navigator.clipboard 위임.
  // 미제공 시 버튼 자체 미노출.
  onCopyIngredient?: (name: string) => void
  // 북마크 — 페이지가 비로그인/Free cap/optimistic toggle 모두 위임. 미제공 시 버튼 미노출.
  isSaved?: boolean
  onToggleSave?: (recipeId: string) => void
}) {
  const [detail, setDetail] = useState<RecipeDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [justCopiedTitle, setJustCopiedTitle] = useState(false)                  // 복사 직후 체크 아이콘 표시용
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!recipeId) {
      setDetail(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setDetail(null)
    fetch(`/api/food/recipes/${recipeId}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setError(typeof json.error === "string" ? json.error : "Failed to load recipe.")
          return
        }
        setDetail(json as RecipeDetail)
      })
      .catch((err) => {
        if (cancelled) return
        console.error("[food/RecipeDetailDialog] fetch 실패:", err)
        setError("Network error. Please try again.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [recipeId])

  const open = recipeId !== null

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="bg-[#141416] border-[#2a2a2a] text-foreground max-w-2xl max-h-[90vh] p-0 flex flex-col overflow-hidden">
        {/* 이미지 영역 — 상단 고정. 16:9 (aspect-video) — 4:3 보다 낮은 높이로 콘텐츠 영역 확보. */}
        <div className="relative bg-[#252525] flex items-center justify-center overflow-hidden flex-shrink-0 aspect-video">
          {detail?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={detail.image_url}
              alt={detail.title}
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <span className="text-muted-foreground text-6xl">🍜</span>
          )}
        </div>

        {/* 콘텐츠 영역 — 이미지 아래 스크롤 가능. flex-1 로 남은 높이 차지. */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          <TooltipProvider delayDuration={150}>
            <DialogHeader className="mb-4">
              <div className="flex items-start gap-2">
                <DialogTitle className="text-xl font-bold text-white leading-tight flex-1">
                  {detail
                    ? detail.title_en
                      ? `${detail.title} (${detail.title_en})`
                      : detail.title
                    : loading
                      ? "Loading…"
                      : "Recipe"}
                </DialogTitle>
                {/* 북마크 — 비로그인/Free cap/optimistic 모두 페이지에서 처리. */}
                {detail && onToggleSave && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onToggleSave(detail.id)}
                        aria-label={isSaved ? "Remove from saved" : "Save recipe"}
                        className="flex-shrink-0 mt-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isSaved ? (
                          <BookmarkCheck className="w-4 h-4" style={{ color: "#FF4B6E" }} />
                        ) : (
                          <Bookmark className="w-4 h-4" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {isSaved ? "Saved" : "Save recipe"}
                    </TooltipContent>
                  </Tooltip>
                )}
                {/* 한글 음식명 복사 — Ingredient Finder 에 붙여넣기 용 (예: "부추김치"). */}
                {detail && onCopyIngredient && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => {
                          onCopyIngredient(detail.title)
                          setJustCopiedTitle(true)
                          setTimeout(() => setJustCopiedTitle(false), 1500)
                        }}
                        aria-label={`Copy ${detail.title}`}
                        className="flex-shrink-0 mt-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {justCopiedTitle ? (
                          <Check className="w-4 h-4" style={{ color: "#22c55e" }} />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      Copy to Ingredient Finder
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              {detail?.description_en && (
                <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                  {detail.description_en}
                </p>
              )}
            </DialogHeader>
          </TooltipProvider>

          {loading && !detail && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          {detail && (
            <>
              {/* 메타 배지 — 칼로리 · 조리시간 · 인분 */}
              <div className="flex flex-wrap gap-2 mb-5">
                {detail.nutrition?.calorie_kcal != null && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-[#252525] text-foreground">
                    <Flame className="w-3 h-3" />
                    {detail.nutrition.calorie_kcal} kcal
                  </span>
                )}
                {detail.ready_in_minutes != null && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-[#252525] text-foreground">
                    <Clock className="w-3 h-3" />
                    {detail.ready_in_minutes} min
                  </span>
                )}
                {detail.servings != null && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-[#252525] text-foreground">
                    <Users className="w-3 h-3" />
                    {detail.servings} servings
                  </span>
                )}
              </div>

              {/* 재료 목록 — 한글 (영문) 병기. 영문 없으면 한글만. */}
              {detail.ingredients.length > 0 && (
                <section className="mb-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    재료 / INGREDIENTS
                  </h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                    {detail.ingredients.map((ing, i) => (
                      <li
                        key={i}
                        className="text-sm text-foreground/90 flex justify-between gap-3"
                      >
                        <span className="truncate">
                          {ing.name}
                          {ing.name_en && (
                            <span className="text-muted-foreground"> ({ing.name_en})</span>
                          )}
                        </span>
                        {ing.capacity && (
                          <span className="text-muted-foreground flex-shrink-0">
                            {ing.capacity}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* 조리 과정 — 한글 위, 영문 아래 (있을 때). */}
              {detail.instructions.length > 0 && (
                <section className="mb-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    조리법 / INSTRUCTIONS
                  </h3>
                  <ol className="space-y-3">
                    {detail.instructions.map((s) => (
                      <li key={s.step} className="flex gap-3">
                        <span
                          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                          style={{ backgroundColor: "#FF4B6E" }}
                        >
                          {s.step}
                        </span>
                        <div className="flex-1 text-sm text-foreground/90 leading-relaxed">
                          <p>{s.instruction}</p>
                          {s.instruction_en && (
                            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                              {s.instruction_en}
                            </p>
                          )}
                          {s.tip && (
                            <p className="mt-1 text-xs text-muted-foreground">💡 {s.tip}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {/* 이미지 출처 — Unsplash 가이드라인상 의무 표기 */}
              {detail.image_source === "unsplash" && (
                <p className="mt-6 text-[11px] text-muted-foreground/70 text-right">
                  Photo from{" "}
                  <a
                    href="https://unsplash.com/?utm_source=unfoldk&utm_medium=referral"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-muted-foreground"
                  >
                    Unsplash
                  </a>
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
