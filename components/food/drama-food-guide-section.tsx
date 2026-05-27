"use client"

import { useEffect, useState } from "react"
import { ChevronRight, Utensils, RefreshCw } from "lucide-react"

// KfoodKit — This Week's K-Drama Food Guide 섹션
//
// food_recipes.featured_week 기반 주간 드라마 3개 노출.
// 데이터 없으면 섹션 자체 미노출 (null 반환).
// 로그인·Pro 불필요 — 자유 열람, 레시피 모달은 기존 권한 체크 위임.

interface FoodItem {
  recipe_id: string
  food_name: string
  food_name_en: string | null
  image_url: string | null
  episode_tag: string | null
  scene_description: string | null
}

interface DramaCard {
  drama_title: string
  foods: FoodItem[]
}

interface DramaGuideData {
  week: string
  dramas: DramaCard[]
}

export function DramaFoodGuideSection({
  onRecipeClick,
}: {
  onRecipeClick: (recipeId: string) => void
}) {
  const [data, setData] = useState<DramaGuideData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/food/drama-guide", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return
        const json = (await res.json().catch(() => null)) as DramaGuideData | null
        if (json && Array.isArray(json.dramas) && json.dramas.length > 0) {
          setData(json)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // 로딩 중이거나 데이터 없으면 미노출
  if (loading || !data || data.dramas.length === 0) return null

  return (
    <section className="mb-16">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-2xl font-semibold text-white">
          This Week&apos;s K-Drama Food Guide
        </h2>
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
          <RefreshCw className="w-3 h-3" />
          Updated every Monday
        </span>
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        Foods spotted in this week&apos;s dramas — click any dish to see the full recipe
      </p>

      {/* 드라마 카드 3열 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.dramas.map((drama) => (
          <div
            key={drama.drama_title}
            className="bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden"
          >
            {/* 드라마명 헤더 */}
            <div
              className="px-4 py-3 border-b border-border/20 flex items-center gap-2"
              style={{ backgroundColor: "rgba(255, 75, 110, 0.08)" }}
            >
              <Utensils className="w-4 h-4 flex-shrink-0" style={{ color: "#FF4B6E" }} />
              <h3 className="text-sm font-semibold text-white leading-tight line-clamp-1">
                {drama.drama_title}
              </h3>
            </div>

            {/* 음식 목록 */}
            <div className="divide-y divide-border/20">
              {drama.foods.length === 0 ? (
                <p className="px-4 py-3 text-xs text-muted-foreground">No dishes yet.</p>
              ) : (
                drama.foods.map((food) => (
                  <button
                    key={food.recipe_id}
                    type="button"
                    onClick={() => onRecipeClick(food.recipe_id)}
                    className="w-full text-left flex items-start gap-3 px-3 py-3 hover:bg-[#252525] transition-colors group"
                  >
                    {/* 썸네일 */}
                    <div className="w-14 h-14 rounded-lg bg-[#252525] flex-shrink-0 overflow-hidden">
                      {food.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={food.image_url}
                          alt={food.food_name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center text-xl">
                          🍜
                        </span>
                      )}
                    </div>

                    {/* 텍스트 */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      {/* 음식명 */}
                      <p className="text-sm font-medium text-white leading-tight mb-1 truncate">
                        {food.food_name_en ?? food.food_name}
                      </p>
                      {/* 에피소드 태그 */}
                      {food.episode_tag && (
                        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-[#2a2a2a] text-muted-foreground mb-1 leading-none">
                          {food.episode_tag}
                        </span>
                      )}
                      {/* 장면 설명 */}
                      {food.scene_description && (
                        <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                          {food.scene_description}
                        </p>
                      )}
                    </div>

                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
