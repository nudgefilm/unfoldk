"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Lock, Sparkles, Clock, Flame, Loader2 } from "lucide-react"
import { AuthGate } from "@/components/auth-gate"

// KfoodKit — This Week's K-Food Picks 섹션
//
// /api/food/weekly-picks (Pro 전용) 호출. 비Pro 면 blur + Coming with Hallyu Pass 오버레이.

interface WeeklyPick {
  recipe_id: string
  reason: string
  recipe: {
    id: string
    title: string
    title_en: string | null
    image_url: string | null
    ready_in_minutes: number | null
    servings: number | null
    calorie_kcal: number | null
  }
}

interface WeeklyPicksResponse {
  week_start: string
  theme: string
  season: string
  picks: WeeklyPick[]
}

const SEASON_EMOJI: Record<string, string> = {
  Spring: "🌸",
  Summer: "☀️",
  Autumn: "🍂",
  Winter: "❄️",
}

export function WeeklyPicksSection({
  isPro,
  isLoggedIn,
  onRecipeClick,
}: {
  isPro: boolean
  isLoggedIn?: boolean
  onRecipeClick: (recipeId: string) => void
}) {
  const [data, setData] = useState<WeeklyPicksResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pro 일 때만 실데이터 fetch — 비Pro 는 blur overlay 만 보여줌
  useEffect(() => {
    if (!isPro) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch("/api/food/weekly-picks", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setError(typeof json.error === "string" ? json.error : "Failed to load picks.")
          return
        }
        setData(json as WeeklyPicksResponse)
      })
      .catch((err) => {
        if (cancelled) return
        console.error("[food/WeeklyPicks] fetch 실패:", err)
        setError("Network error.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isPro])

  // 비Pro: 정적 placeholder picks 로 blur — 실데이터 호출 안 함.
  const displayData: WeeklyPicksResponse =
    isPro && data
      ? data
      : {
          week_start: new Date().toISOString().slice(0, 10),
          theme: "Spring",
          season: "Spring",
          picks: [
            {
              recipe_id: "_placeholder_1",
              reason: "A light spring rice bowl with seasonal greens.",
              recipe: {
                id: "_placeholder_1",
                title: "비빔밥",
                title_en: "Bibimbap",
                image_url: null,
                ready_in_minutes: 30,
                servings: 2,
                calorie_kcal: 520,
              },
            },
            {
              recipe_id: "_placeholder_2",
              reason: "Hearty stew that pairs well with cool evenings.",
              recipe: {
                id: "_placeholder_2",
                title: "된장찌개",
                title_en: "Doenjang Jjigae",
                image_url: null,
                ready_in_minutes: 25,
                servings: 4,
                calorie_kcal: 280,
              },
            },
            {
              recipe_id: "_placeholder_3",
              reason: "Crispy savory pancake for a relaxed weekend meal.",
              recipe: {
                id: "_placeholder_3",
                title: "해물파전",
                title_en: "Seafood Pajeon",
                image_url: null,
                ready_in_minutes: 20,
                servings: 2,
                calorie_kcal: 380,
              },
            },
          ],
        }

  const emoji = SEASON_EMOJI[displayData.season] ?? "🌿"

  return (
    <section className="mb-12">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-2xl font-semibold text-white">
          {emoji} This Week&apos;s K-Food Picks
        </h2>
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        {displayData.theme} · curated for the season
      </p>

      <div className="relative">
        <div
          className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${
            isPro ? "" : "blur-[4px] pointer-events-none"
          }`}
        >
          {isPro && loading && (
            <div className="col-span-full flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {isPro && error && (
            <div className="col-span-full bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">
              {error}
            </div>
          )}
          {(isPro ? displayData.picks : displayData.picks).map((pick) => (
            <AuthGate key={pick.recipe_id} isLoggedIn={isLoggedIn ?? null}>
            <button
              type="button"
              onClick={() => {
                if (!isPro) return
                onRecipeClick(pick.recipe.id)
              }}
              className="w-full text-left bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/50 transition-colors"
            >
              {/* 이미지 — image_url 있으면 표시, 없거나 실패 시 플레이스홀더 */}
              <div className="h-40 bg-[#252525] flex items-center justify-center overflow-hidden">
                {pick.recipe.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pick.recipe.image_url}
                    alt={pick.recipe.title}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const el = e.currentTarget
                      el.style.display = "none"
                      const placeholder = el.nextElementSibling as HTMLElement | null
                      if (placeholder) placeholder.style.display = "flex"
                    }}
                  />
                ) : null}
                <span
                  className="text-muted-foreground text-4xl items-center justify-center"
                  style={{ display: pick.recipe.image_url ? "none" : "flex" }}
                >
                  🍜
                </span>
              </div>

              <div className="p-4">
                {/* 음식명 한글 (영문) */}
                <h3 className="text-lg font-bold text-white mb-2 leading-tight">
                  {pick.recipe.title_en
                    ? `${pick.recipe.title} (${pick.recipe.title_en})`
                    : pick.recipe.title}
                </h3>

                {/* 선정 이유 */}
                <p className="text-muted-foreground text-sm mb-3 leading-snug line-clamp-2">
                  {pick.reason}
                </p>

                {/* 칼로리 / 조리시간 배지 */}
                <div className="flex flex-wrap gap-2">
                  {pick.recipe.calorie_kcal != null && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[#252525] text-foreground">
                      <Flame className="w-3 h-3" />
                      {pick.recipe.calorie_kcal} kcal
                    </span>
                  )}
                  {pick.recipe.ready_in_minutes != null && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[#252525] text-foreground">
                      <Clock className="w-3 h-3" />
                      {pick.recipe.ready_in_minutes} min
                    </span>
                  )}
                </div>
              </div>
            </button>
            </AuthGate>
          ))}
        </div>

        {/* Pro 잠금 오버레이 */}
        {!isPro && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-[#1a1a1a] border border-border/50 rounded-xl p-6 text-center shadow-xl max-w-xs">
              <Lock className="w-8 h-8 mx-auto mb-3" style={{ color: "#FF4B6E" }} />
              <p className="text-white font-medium mb-2">Coming with Hallyu Pass</p>
              <p className="text-muted-foreground text-xs mb-4">
                Weekly UnfoldK-curated picks. Available at launch.
              </p>
              <Link href="/pricing">
                <Button
                  className="rounded-full font-medium text-white"
                  style={{ backgroundColor: "#FF4B6E" }}
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Notify me at launch
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
