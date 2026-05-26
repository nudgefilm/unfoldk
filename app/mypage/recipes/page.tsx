"use client"

// /mypage/recipes — 내가 저장한 KfoodKit 레시피
//
// 카드: /food 그리드와 동일 시각 — 한글(영문) 제목 + 카테고리·난이도·칼로리·조리시간.
// 클릭 → RecipeDetailDialog (재사용). 카드 우상단 북마크 (이미 저장됨 → 클릭 시 즉시 해제 / optimistic + DELETE).
// 데이터: /api/food/collections (GET/DELETE). 진입 가드 + 사이드바: MypageShell 공용.

import { useEffect, useState } from "react"
import Link from "next/link"
import { UtensilsCrossed, Clock, Flame, BookmarkCheck, ChevronRight } from "lucide-react"
import { MypageShell } from "@/components/mypage/mypage-shell"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/components/ui/use-toast"
import { RecipeDetailDialog } from "@/components/food/recipe-detail-dialog"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { hasProAccess } from "@/lib/auth/plan"

interface RecipeJoin {
  id: string
  title: string
  title_en: string | null
  image_url: string | null
  ready_in_minutes: number | null
  servings: number | null
  category: string | null
  level: string | null
  calorie_kcal: number | null
}

interface CollectionItem {
  id: string                 // user_food_collections row id
  created_at: string
  recipe: RecipeJoin | null
}

const LEVEL_MAP: Record<string, "Easy" | "Medium" | "Hard"> = {
  "쉬움": "Easy",
  "초급": "Easy",
  "보통": "Medium",
  "중급": "Medium",
  "어려움": "Hard",
  "고급": "Hard",
}

function mapLevel(ko: string | null): "Easy" | "Medium" | "Hard" {
  if (!ko) return "Medium"
  return LEVEL_MAP[ko] ?? "Medium"
}

const difficultyColors: Record<string, string> = {
  Easy: "bg-green-500/20 text-green-400",
  Medium: "bg-yellow-500/20 text-yellow-400",
  Hard: "bg-red-500/20 text-red-400",
}

export default function MyRecipesPage() {
  return (
    <MypageShell activeLabel="Saved Recipes">
      <MyRecipesBody />
      <Toaster />
    </MypageShell>
  )
}

function MyRecipesBody() {
  const { toast } = useToast()
  const [items, setItems] = useState<CollectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null)
  // Pro 권한 — monthly/annual/admin 통합 (hasProAccess). /food/page.tsx 패턴 동일.
  // 현재 본 페이지의 UI 분기엔 직접 사용처 없으나, 향후 Pro 전용 액션 추가 인프라.
  const [, setIsPro] = useState(false)

  useEffect(() => {
    // 마운트 시 plan_type + is_admin 조회 → isPro 계산
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase
        .from("users")
        .select("plan_type, is_admin, trial_ends_at")
        .eq("id", user.id)
        .single()
      const row = profile as { plan_type?: string; is_admin?: boolean; trial_ends_at?: string | null } | null
      setIsPro(hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin, trialEndsAt: row?.trial_ends_at }))
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch("/api/food/collections", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setItems([])
          return
        }
        const json = (await res.json().catch(() => ({}))) as { items?: CollectionItem[] }
        if (cancelled) return
        setItems(json.items ?? [])
      })
      .catch((err) => {
        console.error("[mypage/recipes] fetch 실패:", err)
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 저장 해제 — optimistic 즉시 제거 + DELETE.
  const handleRemove = async (recipeId: string) => {
    const prev = items
    setItems((cur) => cur.filter((it) => it.recipe?.id !== recipeId))
    try {
      const res = await fetch(
        `/api/food/collections?recipe_id=${encodeURIComponent(recipeId)}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error("delete_failed")
    } catch (err) {
      console.error("[mypage/recipes] 삭제 실패:", err)
      // 롤백
      setItems(prev)
      toast({ title: "Couldn't remove the recipe.", description: "Please try again." })
    }
  }

  // 카드 클릭 = 모달 오픈. 모달 안의 북마크 = 즉시 해제 (이 페이지 컨텍스트에선 추가 액션 없음).
  // RecipeDetailDialog 의 isSaved 는 항상 true — 이 페이지의 모든 카드가 저장 상태이므로.
  const handleModalToggleSave = (recipeId: string) => {
    handleRemove(recipeId)
    setActiveRecipeId(null)
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Saved Recipes</h1>
          <p className="text-muted-foreground text-sm">
            Korean recipes you bookmarked from KfoodKit. Cook them anytime.
          </p>
        </div>
        <Link
          href="/food"
          className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium px-4 h-10 rounded-full text-white whitespace-nowrap flex-shrink-0"
          style={{ backgroundColor: "#FF4B6E" }}
        >
          Browse KfoodKit
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {loading ? (
        <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center text-muted-foreground text-sm">
          Loading...
        </div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => {
            const r = item.recipe
            if (!r) return null
            const level = mapLevel(r.level)
            const bilingual = r.title_en ? `${r.title} (${r.title_en})` : r.title
            return (
              <div
                key={item.id}
                onClick={() => setActiveRecipeId(r.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setActiveRecipeId(r.id)
                  }
                }}
                className="text-left bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/50 transition-colors cursor-pointer"
              >
                <div className="aspect-video bg-[#252525] flex items-center justify-center overflow-hidden relative">
                  {r.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.image_url}
                      alt={r.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-muted-foreground text-4xl">🍜</span>
                  )}
                  {/* 북마크 (저장 상태 — 클릭 시 해제) */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Remove from saved"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleRemove(r.id)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        e.stopPropagation()
                        handleRemove(r.id)
                      }
                    }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center hover:bg-black/75 transition-colors cursor-pointer"
                  >
                    <BookmarkCheck className="w-4 h-4" style={{ color: "#FF4B6E" }} />
                  </div>
                </div>

                <div className="p-4">
                  <span className="inline-block px-2 py-1 rounded-full text-xs bg-[#252525] text-muted-foreground mb-2">
                    {r.category ?? "Korean recipe"}
                  </span>
                  <h3 className="text-lg font-bold text-white mb-3 leading-tight">
                    {bilingual}
                  </h3>
                  <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${difficultyColors[level]}`}
                    >
                      {level}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {r.calorie_kcal != null && (
                        <span className="inline-flex items-center gap-1">
                          <Flame className="w-3 h-3" />
                          {r.calorie_kcal} kcal
                        </span>
                      )}
                      {r.ready_in_minutes != null && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {r.ready_in_minutes} min
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 모바일 CTA */}
      <div className="sm:hidden mt-8">
        <Link
          href="/food"
          className="inline-flex items-center gap-1.5 text-sm font-medium px-4 h-10 rounded-full text-white"
          style={{ backgroundColor: "#FF4B6E" }}
        >
          Browse KfoodKit
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <RecipeDetailDialog
        recipeId={activeRecipeId}
        onClose={() => setActiveRecipeId(null)}
        isSaved={true}
        onToggleSave={handleModalToggleSave}
      />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-12 text-center">
      <UtensilsCrossed className="w-10 h-10 mx-auto mb-3" style={{ color: "#FF4B6E" }} />
      <p className="text-foreground font-medium mb-1">No saved recipes yet</p>
      <p className="text-muted-foreground text-sm mb-5 max-w-md mx-auto">
        Bookmark Korean recipes from KfoodKit to build your personal cookbook.
      </p>
      <Link
        href="/food"
        className="inline-flex items-center gap-1.5 text-sm font-medium px-5 h-10 rounded-full text-white"
        style={{ backgroundColor: "#FF4B6E" }}
      >
        Browse KfoodKit
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
