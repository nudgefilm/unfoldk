"use client"

import { useEffect, useRef, useState } from "react"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Trophy, ChevronRight, ChevronLeft, Lock, Bot, Sparkles, Clock, Flame, Plus, Check, ShoppingCart, X as XIcon, Download, Bookmark, BookmarkCheck } from "lucide-react"
import Link from "next/link"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { hasProAccess } from "@/lib/auth/plan"
import { RecipeDetailDialog } from "@/components/food/recipe-detail-dialog"
import { WeeklyPicksSection } from "@/components/food/weekly-picks-section"
import { DramaFoodGuideSection } from "@/components/food/drama-food-guide-section"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/components/ui/use-toast"
import { AuthGate } from "@/components/auth-gate"

// AI Ingredient Finder — 한류 팬 밀집 20개국. 지역별 <optgroup> 그룹화.
// 이모지 + ISO alpha-2 코드. /api/food/ingredient-finder 에 country 로 전송.
const COUNTRY_GROUPS: Array<{
  region: string
  options: Array<{ value: string; label: string }>
}> = [
  {
    region: "Americas",
    options: [
      { value: "US", label: "🇺🇸 United States" },
      { value: "CA", label: "🇨🇦 Canada" },
      { value: "BR", label: "🇧🇷 Brazil" },
      { value: "MX", label: "🇲🇽 Mexico" },
    ],
  },
  {
    region: "Asia Pacific",
    options: [
      { value: "AU", label: "🇦🇺 Australia" },
      { value: "JP", label: "🇯🇵 Japan" },
      { value: "TH", label: "🇹🇭 Thailand" },
      { value: "PH", label: "🇵🇭 Philippines" },
      { value: "VN", label: "🇻🇳 Vietnam" },
      { value: "ID", label: "🇮🇩 Indonesia" },
      { value: "MY", label: "🇲🇾 Malaysia" },
      { value: "SG", label: "🇸🇬 Singapore" },
    ],
  },
  {
    region: "Europe",
    options: [
      { value: "GB", label: "🇬🇧 United Kingdom" },
      { value: "FR", label: "🇫🇷 France" },
      { value: "DE", label: "🇩🇪 Germany" },
      { value: "ES", label: "🇪🇸 Spain" },
      { value: "NL", label: "🇳🇱 Netherlands" },
      { value: "PL", label: "🇵🇱 Poland" },
    ],
  },
  {
    region: "Middle East",
    options: [
      { value: "SA", label: "🇸🇦 Saudi Arabia" },
      { value: "AE", label: "🇦🇪 UAE" },
    ],
  },
]

// /api/food/ingredient-finder 응답 (음식명 → 재료별 sourcing breakdown)
interface FinderItem {
  ingredient_ko: string
  substitute_en: string
  store: string
  difficulty: "Easy" | "Medium" | "Hard"
}

interface FinderResult {
  items: FinderItem[]
}

interface RecipeListItem {
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

// MAFRA LEVEL_NM (한글) → UI 라벨 매핑
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

const RECIPES_PAGE_SIZE = 12
const SHOPPING_LIST_KEY = "kfoodkit-shopping-list"

// 페이지네이션 표시 항목 — 항상 첫·마지막 페이지 + 현재 ±2 + 사이 공백은 ellipsis.
// edge 보정: current<=4 면 앞 5개 / current>=total-3 이면 뒤 5개 몰아 표시 (5개 페이지 유지).
type PaginationItem = number | "ellipsis-left" | "ellipsis-right"
function getPaginationItems(current: number, total: number): PaginationItem[] {
  if (total <= 1) return [1]
  let start: number
  let end: number
  if (current <= 4) {
    start = 2
    end = Math.min(total - 1, 5)
  } else if (current >= total - 3) {
    start = Math.max(2, total - 4)
    end = total - 1
  } else {
    start = current - 2
    end = current + 2
  }
  const items: PaginationItem[] = [1]
  if (start > 2) items.push("ellipsis-left")
  for (let i = start; i <= end; i++) items.push(i)
  if (end < total - 1) items.push("ellipsis-right")
  items.push(total)
  return items
}

interface ShoppingItem {
  id: string
  name: string
  checked: boolean
}

export default function KfoodKitPage() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")              // 300ms 후 API 호출
  const [isPro, setIsPro] = useState(false)                               // monthly/annual/admin 통합 판별
  const [isLoggedIn, setIsLoggedIn] = useState(false)                     // 북마크 노출 가드 — 비로그인은 버튼 자체 숨김

  // 저장된 레시피 id Set — 카드/모달의 북마크 상태. 로그인 시 마운트 후 GET 으로 채움.
  // optimistic 업데이트 + 서버 응답으로 보정.
  const [savedRecipeIds, setSavedRecipeIds] = useState<Set<string>>(new Set())

  // 레시피 카탈로그 (Popular K-Drama Recipes 섹션) — 서버 페이지네이션
  const [recipes, setRecipes] = useState<RecipeListItem[]>([])
  const [recipesLoading, setRecipesLoading] = useState(true)
  const [recipesError, setRecipesError] = useState<string | null>(null)
  const [recipesPage, setRecipesPage] = useState(1)
  const [recipesTotal, setRecipesTotal] = useState(0)
  const recipesGridRef = useRef<HTMLDivElement | null>(null)              // 페이지 변경 시 smooth scroll target

  // 상세 모달 — 선택된 recipe id (null = 닫힘)
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null)

  // AI Dish-to-Ingredients Finder 상태
  const [finderCountry, setFinderCountry] = useState("US")
  const [finderDish, setFinderDish] = useState("")
  const [finderLoading, setFinderLoading] = useState(false)
  const [finderResult, setFinderResult] = useState<FinderResult | null>(null)
  const [finderError, setFinderError] = useState<string | null>(null)

  // 주간 K푸드 챌린지 — /api/food/challenges. null = 로딩 또는 없음 (둘 다 섹션 미노출).
  interface ChallengeState {
    id: string
    title: string
    description: string | null
    food_name: string | null
    image_url: string | null
    week_start: string
    week_end: string
  }
  const [challenge, setChallenge] = useState<ChallengeState | null>(null)
  const [challengeRecipeId, setChallengeRecipeId] = useState<string | null>(null)

  // My Shopping List — localStorage 영속화 (로그인 불필요)
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([])
  const [shoppingHydrated, setShoppingHydrated] = useState(false)         // hydration 완료 전엔 localStorage 쓰기 skip
  const shoppingBoxRef = useRef<HTMLDivElement | null>(null)              // PNG 캡처 target
  const [savingImage, setSavingImage] = useState(false)

  // 마운트 시 plan 권한 확인 — Pro 잠금 가드용 + 저장 레시피 hydrate
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setIsLoggedIn(true)
      const { data: profile } = await supabase
        .from("users")
        .select("plan_type, is_admin, trial_ends_at")
        .eq("id", user.id)
        .single()
      const row = profile as { plan_type?: string; is_admin?: boolean; trial_ends_at?: string | null } | null
      setIsPro(hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin, trialEndsAt: row?.trial_ends_at }))
    })

    // 주간 챌린지 fetch — 공개 GET. challenge null 이면 섹션 미노출.
    fetch("/api/food/challenges", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return
        const json = (await res.json().catch(() => ({}))) as {
          challenge: ChallengeState | null
          recipeId: string | null
        }
        if (json.challenge) {
          setChallenge(json.challenge)
          setChallengeRecipeId(json.recipeId ?? null)
        }
      })
      .catch(() => {
        // 네트워크 에러 — 섹션 미노출 (challenge null 유지)
      })

    // 저장 레시피 id hydrate — 비로그인이면 401 반환되어 빈 Set 유지.
    fetch("/api/food/collections", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return
        const json = (await res.json().catch(() => ({}))) as {
          items?: Array<{ recipe: { id: string } | null }>
        }
        const ids = (json.items ?? [])
          .map((it) => it.recipe?.id)
          .filter((id): id is string => typeof id === "string")
        setSavedRecipeIds(new Set(ids))
      })
      .catch(() => {
        // 비로그인 / 네트워크 에러 — 빈 Set 유지
      })
  }, [])

  // 검색 디바운스 — 입력 후 300ms 안정화되면 API 재호출. 페이지 자동 1로 리셋.
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim())
      setRecipesPage(1)
    }, 300)
    return () => clearTimeout(handle)
  }, [searchQuery])

  // 레시피 카탈로그 fetch — 서버 페이징 + search 파라미터.
  // (page, debouncedSearch) 가 변하면 재호출.
  useEffect(() => {
    let cancelled = false
    setRecipesLoading(true)
    setRecipesError(null)
    const params = new URLSearchParams({
      page: String(recipesPage),
      pageSize: String(RECIPES_PAGE_SIZE),
    })
    if (debouncedSearch.length > 0) params.set("search", debouncedSearch)
    fetch(`/api/food/recipes?${params.toString()}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setRecipesError(typeof json.error === "string" ? json.error : "Failed to load recipes.")
          return
        }
        setRecipes(Array.isArray(json.items) ? (json.items as RecipeListItem[]) : [])
        setRecipesTotal(typeof json.total === "number" ? json.total : 0)
      })
      .catch((err) => {
        if (cancelled) return
        console.error("[food] recipes fetch 실패:", err)
        setRecipesError("Network error.")
      })
      .finally(() => {
        if (!cancelled) setRecipesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [recipesPage, debouncedSearch])

  // localStorage → shoppingItems hydration (마운트 1회). 이후 변경분만 저장.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SHOPPING_LIST_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setShoppingItems(
            parsed.filter(
              (i): i is ShoppingItem =>
                typeof i === "object" &&
                i !== null &&
                typeof i.id === "string" &&
                typeof i.name === "string" &&
                typeof i.checked === "boolean"
            )
          )
        }
      }
    } catch (err) {
      console.warn("[food] shopping list hydrate 실패:", err)
    }
    setShoppingHydrated(true)
  }, [])

  // shoppingItems 변경 시 localStorage 동기화. hydrate 전엔 초기 [] 로 덮어쓰기 방지.
  useEffect(() => {
    if (!shoppingHydrated) return
    try {
      localStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify(shoppingItems))
    } catch (err) {
      console.warn("[food] shopping list 저장 실패:", err)
    }
  }, [shoppingItems, shoppingHydrated])

  const totalPages = Math.max(1, Math.ceil(recipesTotal / RECIPES_PAGE_SIZE))

  const handlePageChange = (next: number) => {
    if (next < 1 || next > totalPages) return
    setRecipesPage(next)
    // 그리드 상단으로 smooth scroll — fetch 시작 직후 곧바로 이동 (로딩 스켈레톤이 보임)
    requestAnimationFrame(() => {
      recipesGridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  // Shopping List 핸들러들 — 중복 이름은 단일 항목 유지 (case-insensitive).
  const handleAddToShoppingList = (name: string) => {
    const trimmed = name.trim()
    if (trimmed.length === 0) return
    setShoppingItems((prev) => {
      const existing = prev.find((i) => i.name.toLowerCase() === trimmed.toLowerCase())
      if (existing) return prev
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      return [...prev, { id, name: trimmed, checked: false }]
    })
  }

  const handleToggleShoppingItem = (id: string) => {
    setShoppingItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i))
    )
  }

  const handleRemoveShoppingItem = (id: string) => {
    setShoppingItems((prev) => prev.filter((i) => i.id !== id))
  }

  const handleClearShoppingList = () => {
    setShoppingItems([])
  }

  // 북마크 토글 — 로그인 사용자 전용 (비로그인은 버튼 자체 미노출이라 도달 안 함).
  // Free 5 cap 도달 (서버 403 free_limit_reached) 시 toast 안내 + Set 롤백.
  const handleToggleSave = async (recipeId: string) => {
    const wasSaved = savedRecipeIds.has(recipeId)

    // optimistic 반영
    setSavedRecipeIds((prev) => {
      const next = new Set(prev)
      if (wasSaved) next.delete(recipeId)
      else next.add(recipeId)
      return next
    })

    try {
      if (wasSaved) {
        const res = await fetch(
          `/api/food/collections?recipe_id=${encodeURIComponent(recipeId)}`,
          { method: "DELETE" }
        )
        if (!res.ok) throw new Error("delete_failed")
      } else {
        const res = await fetch("/api/food/collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipe_id: recipeId }),
        })
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string; limit?: number }
          if (res.status === 403 && json.error === "free_limit_reached") {
            // 롤백
            setSavedRecipeIds((prev) => {
              const next = new Set(prev)
              next.delete(recipeId)
              return next
            })
            toast({
              title: `Free saves are full (${json.limit ?? 5}).`,
              description: "Coming with Hallyu Pass — unlimited saves at launch.",
            })
            return
          }
          throw new Error(json.error ?? "save_failed")
        }
      }
    } catch (err) {
      console.error("[food] toggle save 실패:", err)
      // 롤백 — 서버 거부 시 원복
      setSavedRecipeIds((prev) => {
        const next = new Set(prev)
        if (wasSaved) next.add(recipeId)
        else next.delete(recipeId)
        return next
      })
      toast({
        title: "Couldn't update your saved recipes.",
        description: "Please try again.",
      })
    }
  }

  // 재료명 클립보드 복사 — 모달에서 호출. navigator.clipboard 지원 안 되면 silent fail.
  const handleCopyIngredient = (name: string) => {
    if (!name) return
    try {
      void navigator.clipboard?.writeText(name)
    } catch (err) {
      console.warn("[food] clipboard 복사 실패:", err)
    }
  }

  // Shopping List 박스 PNG 캡처 — html2canvas 동적 import (bundle 크기 절감).
  // 캡처 직전 워터마크 노드를 임시로 추가해 결과물에만 노출, 캡처 후 제거.
  const handleSaveShoppingListAsImage = async () => {
    const node = shoppingBoxRef.current
    if (!node || shoppingItems.length === 0 || savingImage) return
    setSavingImage(true)
    try {
      const { default: html2canvas } = await import("html2canvas")
      const canvas = await html2canvas(node, {
        backgroundColor: "#1a1a1a",                          // 박스 배경과 일치
        scale: 2,                                            // retina 품질
        logging: false,
        useCORS: true,
      })
      const dataUrl = canvas.toDataURL("image/png")
      const link = document.createElement("a")
      link.href = dataUrl
      link.download = "unfoldk-shopping-list.png"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error("[food] PNG 저장 실패:", err)
    } finally {
      setSavingImage(false)
    }
  }

  // Dish → 재료 sourcing breakdown — POST /api/food/ingredient-finder
  // Pro 가드는 라우트 측에서 403 으로 반환. UI 는 blur overlay 로 미리 막아 401/403 조우 최소화.
  const handleFinderSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = finderDish.trim()
    if (!trimmed) return

    setFinderLoading(true)
    setFinderError(null)
    setFinderResult(null)
    try {
      const res = await fetch("/api/food/ingredient-finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dish: trimmed, country: finderCountry }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          typeof json.error === "string"
            ? json.error
            : "Could not generate the breakdown — try again."
        setFinderError(msg)
        return
      }
      setFinderResult({
        items: Array.isArray(json.items) ? (json.items as FinderItem[]) : [],
      })
    } catch (err) {
      console.error("[food/finder] 요청 실패:", err)
      setFinderError("Network error. Please try again.")
    } finally {
      setFinderLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0d0d0f" }}>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 pt-28 pb-12">
        {/* Page Header */}
        <section className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">KfoodKit</h1>
          <p className="text-muted-foreground text-lg mb-8">
            Cook your favorite K-drama dishes, anywhere in the world
          </p>
          
          {/* Search Bar */}
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by drama or dish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 py-6 bg-[#1a1a1a] border-border/30 rounded-xl text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </section>

        {/* Weekly Challenge Banner — /api/food/challenges 실데이터. 챌린지 없으면 섹션 미노출. */}
        {challenge && (
          <section className="mb-12">
            <div
              className="bg-[#1a1a1a] rounded-xl p-6 border-l-4"
              style={{ borderLeftColor: "#FF4B6E" }}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
                  >
                    <Trophy className="w-6 h-6" style={{ color: "#FF4B6E" }} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white mb-1">
                      This Week&apos;s Challenge: {challenge.title}
                    </h2>
                    {challenge.description && (
                      <p className="text-muted-foreground text-sm">{challenge.description}</p>
                    )}
                  </div>
                </div>
                {/* Start → 매칭 레시피 모달 오픈. recipeId 없으면 버튼 미노출. */}
                {challengeRecipeId && (
                  <AuthGate isLoggedIn={isLoggedIn}>
                  <Button
                    type="button"
                    onClick={() => setActiveRecipeId(challengeRecipeId)}
                    className="rounded-full font-medium text-white whitespace-nowrap"
                    style={{ backgroundColor: "#FF4B6E" }}
                  >
                    Start Challenge
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                  </AuthGate>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Drama Food Cards Grid — food_recipes 실데이터 (MAFRA) */}
        <section className="mb-12" ref={recipesGridRef}>
          <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
            <h2 className="text-2xl font-semibold text-white">Popular K-Drama Recipes</h2>
            {recipesTotal > 0 && (
              <span className="text-xs text-muted-foreground">
                {recipesTotal.toLocaleString()} recipes
              </span>
            )}
          </div>

          {recipesError && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-sm text-red-400 mb-4">
              {recipesError}
            </div>
          )}

          {recipesLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden animate-pulse"
                >
                  <div className="h-40 bg-[#252525]" />
                  <div className="p-4 space-y-3">
                    <div className="h-3 w-20 bg-[#252525] rounded-full" />
                    <div className="h-5 w-3/4 bg-[#252525] rounded" />
                    <div className="h-4 w-full bg-[#252525] rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!recipesLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recipes.map((recipe) => {
                const level = mapLevel(recipe.level)
                const bilingual = recipe.title_en
                  ? `${recipe.title} (${recipe.title_en})`
                  : recipe.title
                return (
                  <AuthGate key={recipe.id} isLoggedIn={isLoggedIn}>
                  <button
                    type="button"
                    onClick={() => setActiveRecipeId(recipe.id)}
                    className="w-full text-left bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/50 transition-colors"
                  >
                    {/* 이미지 — 16:9 (aspect-video) 비율 통일. object-cover 로 영역 채움.
                        `relative` 는 우상단 북마크 absolute 위치용 — 시각 변경 없음. */}
                    <div className="aspect-video bg-[#252525] flex items-center justify-center overflow-hidden relative">
                      {recipe.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={recipe.image_url}
                          alt={recipe.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-muted-foreground text-4xl">🍜</span>
                      )}
                      {/* 북마크 — 로그인 사용자만 노출. button 안 button HTML 위반 회피 위해
                          div role="button". stopPropagation 으로 카드 클릭(모달 오픈) 차단. */}
                      {isLoggedIn && (
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={
                            savedRecipeIds.has(recipe.id) ? "Remove from saved" : "Save recipe"
                          }
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleToggleSave(recipe.id)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              e.stopPropagation()
                              handleToggleSave(recipe.id)
                            }
                          }}
                          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center hover:bg-black/75 transition-colors cursor-pointer"
                        >
                          {savedRecipeIds.has(recipe.id) ? (
                            <BookmarkCheck className="w-4 h-4" style={{ color: "#FF4B6E" }} />
                          ) : (
                            <Bookmark className="w-4 h-4 text-white" />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      {/* 카테고리 핀 (밥 / 국&찌개 등) */}
                      <span className="inline-block px-2 py-1 rounded-full text-xs bg-[#252525] text-muted-foreground mb-2">
                        {recipe.category ?? "Korean recipe"}
                      </span>

                      {/* 음식명 — 한글 (영문) */}
                      <h3 className="text-lg font-bold text-white mb-3 leading-tight">
                        {bilingual}
                      </h3>

                      {/* 난이도 + 칼로리·조리시간 */}
                      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${difficultyColors[level]}`}
                        >
                          {level}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {recipe.calorie_kcal != null && (
                            <span className="inline-flex items-center gap-1">
                              <Flame className="w-3 h-3" />
                              {recipe.calorie_kcal} kcal
                            </span>
                          )}
                          {recipe.ready_in_minutes != null && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {recipe.ready_in_minutes} min
                            </span>
                          )}
                        </div>
                      </div>

                      {/* View Recipe — 클릭 시 모달 오픈 */}
                      <span
                        className="text-sm font-medium flex items-center gap-1"
                        style={{ color: "#FF4B6E" }}
                      >
                        View Recipe
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </button>
                  </AuthGate>
                )
              })}

              {recipes.length === 0 && !recipesError && (
                <p className="col-span-full text-muted-foreground text-sm">
                  No recipes match your search.
                </p>
              )}
            </div>
          )}

          {/* 페이지네이션 — 첫·마지막 페이지 항상 + 현재 ±2 + ellipsis. brand color 강조. */}
          {!recipesLoading && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8 flex-wrap">
              <Button
                type="button"
                variant="outline"
                disabled={recipesPage <= 1}
                onClick={() => handlePageChange(recipesPage - 1)}
                className="bg-[#1a1a1a] border-[#2a2a2a] text-foreground hover:bg-[#252525] rounded-full"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Prev
              </Button>
              {getPaginationItems(recipesPage, totalPages).map((item, idx) => {
                if (item === "ellipsis-left" || item === "ellipsis-right") {
                  return (
                    <span
                      key={`${item}-${idx}`}
                      aria-hidden
                      className="px-2 text-muted-foreground select-none tabular-nums"
                    >
                      …
                    </span>
                  )
                }
                const isCurrent = item === recipesPage
                return (
                  <Button
                    key={item}
                    type="button"
                    variant="outline"
                    onClick={() => handlePageChange(item)}
                    aria-current={isCurrent ? "page" : undefined}
                    className={
                      isCurrent
                        ? "rounded-full min-w-10 px-3 text-white border-transparent tabular-nums"
                        : "bg-[#1a1a1a] border-[#2a2a2a] text-foreground hover:bg-[#252525] rounded-full min-w-10 px-3 tabular-nums"
                    }
                    style={
                      isCurrent
                        ? { backgroundColor: "#FF4B6E", borderColor: "#FF4B6E" }
                        : undefined
                    }
                  >
                    {item}
                  </Button>
                )
              })}
              <Button
                type="button"
                variant="outline"
                disabled={recipesPage >= totalPages}
                onClick={() => handlePageChange(recipesPage + 1)}
                className="bg-[#1a1a1a] border-[#2a2a2a] text-foreground hover:bg-[#252525] rounded-full"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </section>

        {/* This Week's K-Food Picks — Free 전체 개방 (2026-06-01 변경) */}
        <WeeklyPicksSection isPro={true} isLoggedIn={isLoggedIn} onRecipeClick={(id) => { if (isLoggedIn) setActiveRecipeId(id) }} />

        {/* ── Local Ingredient Matcher ────────────────────────────────
            h2 제목은 blur 밖 → 항상 보임. 콘텐츠 박스만 blur + overlay. */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-6">Local Ingredient Matcher</h2>
          <div className="relative">
            <div className={isPro ? "" : "blur-sm pointer-events-none select-none"}>
              <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Bot className="w-6 h-6" style={{ color: "#FF4B6E" }} />
                  <h3 className="text-lg font-semibold text-white">Local Ingredient Matcher</h3>
                </div>
                <p className="text-muted-foreground text-sm mb-6">
                  Enter a Korean dish name and select your country — UnfoldK will show you where
                  to find every ingredient at your local stores.
                </p>

                <form
                  onSubmit={handleFinderSubmit}
                  className="grid grid-cols-1 md:grid-cols-[1fr_240px_auto] gap-3 mb-6"
                >
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Korean Dish Name
                    </label>
                    <Input
                      value={finderDish}
                      onChange={(e) => setFinderDish(e.target.value)}
                      placeholder="e.g. 부추김치, 비빔밥, 김치찌개"
                      maxLength={80}
                      className="bg-[#0d0d0f] border-[#2a2a2a] rounded-lg text-foreground placeholder:text-muted-foreground"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Your country
                    </label>
                    <select
                      value={finderCountry}
                      onChange={(e) => setFinderCountry(e.target.value)}
                      className="w-full h-10 bg-[#0d0d0f] border border-[#2a2a2a] rounded-lg px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-[#FF4B6E]"
                    >
                      {COUNTRY_GROUPS.map((grp) => (
                        <optgroup key={grp.region} label={grp.region}>
                          {grp.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div className="md:self-end">
                    <Button
                      type="submit"
                      disabled={finderLoading || finderDish.trim().length === 0}
                      className="h-10 rounded-full font-medium text-white px-5 w-full md:w-auto"
                      style={{ backgroundColor: "#FF4B6E" }}
                    >
                      <Sparkles className="w-4 h-4 mr-1.5" />
                      {finderLoading ? "Finding..." : "Find"}
                    </Button>
                  </div>
                </form>

                {finderError ? (
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">
                    {finderError}
                  </div>
                ) : finderResult ? (
                  <div className="space-y-3">
                    {finderResult.items.map((item, i) => {
                      const inList = shoppingItems.some(
                        (s) => s.name.toLowerCase() === item.substitute_en.toLowerCase()
                      )
                      const diffColors: Record<FinderItem["difficulty"], string> = {
                        Easy: "bg-green-500/20 text-green-400",
                        Medium: "bg-yellow-500/20 text-yellow-400",
                        Hard: "bg-red-500/20 text-red-400",
                      }
                      return (
                        <div
                          key={i}
                          className="bg-[#252525] rounded-lg p-4 grid grid-cols-1 md:grid-cols-[1.2fr_1.5fr_1.4fr_auto] gap-3 items-center"
                        >
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-0.5">
                              Ingredient
                            </p>
                            <p className="text-foreground font-medium truncate">{item.ingredient_ko}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-0.5">
                              Local substitute
                            </p>
                            <p className="text-foreground text-sm truncate">{item.substitute_en}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-0.5">
                              Where to buy
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-muted-foreground text-sm truncate">{item.store}</span>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${diffColors[item.difficulty]}`}>
                                {item.difficulty}
                              </span>
                            </div>
                          </div>
                          <div className="md:justify-self-end">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={inList}
                              onClick={() => handleAddToShoppingList(item.substitute_en)}
                              className="h-8 px-3 text-xs bg-transparent border-[#3a3a3a] text-foreground hover:bg-[#1a1a1a] whitespace-nowrap"
                            >
                              {inList ? (
                                <><Check className="w-3 h-3 mr-1" />Added</>
                              ) : (
                                <><Plus className="w-3 h-3 mr-1" />Add to List</>
                              )}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                    {finderResult.items.length === 0 && (
                      <p className="text-muted-foreground text-sm">
                        No essential ingredients identified for this dish — try a different name.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Enter a Korean dish above — UnfoldK will list each essential ingredient
                    and where to source it locally.
                  </p>
                )}
              </div>
            </div>

            {/* Pro 잠금 오버레이 — 콘텐츠 박스 중앙 */}
            {!isPro && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-[#1a1a1a] border border-border/50 rounded-xl p-8 text-center shadow-xl max-w-xs w-full mx-4">
                  <Lock className="w-8 h-8 mx-auto mb-3" style={{ color: "#FF4B6E" }} />
                  <p className="text-white font-medium mb-2">Coming with Hallyu Pass</p>
                  <p className="text-muted-foreground text-xs mb-4">
                    Find local substitutes for Korean ingredients and manage your shopping list.
                  </p>
                  <Link href="/signup">
                    <Button
                      className="rounded-full font-medium text-white"
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

        {/* ── My Shopping List ────────────────────────────────────────
            h2 제목은 blur 밖 → 항상 보임. 콘텐츠 박스만 blur + overlay. */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
            <h2 className="text-2xl font-semibold text-white">My Shopping List</h2>
            {isPro && shoppingItems.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveShoppingListAsImage}
                  disabled={savingImage}
                  className="text-xs font-medium px-3 py-1.5 rounded-full border border-[#3a3a3a] text-foreground hover:bg-[#1a1a1a] disabled:opacity-60 inline-flex items-center gap-1.5"
                >
                  <Download className="w-3 h-3" />
                  {savingImage ? "Saving…" : "Save as Image"}
                </button>
                <button
                  type="button"
                  onClick={handleClearShoppingList}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
          <p className="text-muted-foreground text-sm mb-6">
            Use the Local Ingredient Matcher above to find local substitutes — then add them to
            your shopping list.
          </p>
          <div className="relative">
            <div
              ref={shoppingBoxRef}
              className={`bg-[#1a1a1a] border border-border/30 rounded-xl p-6 ${
                isPro ? "" : "blur-sm pointer-events-none select-none"
              }`}
            >
              {shoppingItems.length === 0 ? (
                <div className="text-center py-6">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-3 text-muted-foreground/60" />
                  <p className="text-muted-foreground text-sm">
                    Your list is empty. Use the Local Ingredient Matcher above and tap{" "}
                    <span className="text-foreground font-medium">Add to List</span> on any substitute.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {shoppingItems.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 group">
                      <button
                        type="button"
                        onClick={() => handleToggleShoppingItem(item.id)}
                        aria-label={item.checked ? `Uncheck ${item.name}` : `Check ${item.name}`}
                        className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                          item.checked
                            ? "border-[#FF4B6E] bg-[#FF4B6E]"
                            : "border-border/50 hover:border-foreground/50"
                        }`}
                      >
                        {item.checked && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <span
                        className={`flex-1 text-sm ${
                          item.checked ? "line-through text-muted-foreground" : "text-foreground"
                        }`}
                      >
                        {item.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveShoppingItem(item.id)}
                        aria-label={`Remove ${item.name}`}
                        className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {isPro && shoppingItems.length > 0 && (
                <div className="mt-6 pt-4 border-t border-border/20 text-center">
                  <p className="text-[11px] tracking-wider text-muted-foreground/70">
                    unfoldk.com
                  </p>
                </div>
              )}
            </div>

            {/* Pro 잠금 오버레이 — 콘텐츠 박스 중앙 */}
            {!isPro && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-[#1a1a1a] border border-border/50 rounded-xl p-6 text-center shadow-xl max-w-xs">
                  <Lock className="w-8 h-8 mx-auto mb-3" style={{ color: "#FF4B6E" }} />
                  <p className="text-white font-medium mb-2">Coming with Hallyu Pass</p>
                  <p className="text-muted-foreground text-xs mb-4">
                    Add ingredients to your personal shopping list.
                  </p>
                  <Link href="/signup">
                    <Button
                      className="rounded-full font-medium text-white"
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

        {/* This Week's K-Drama Food Guide — Free 전체 개방 (2026-06-01 변경) */}
        <DramaFoodGuideSection isLoggedIn={isLoggedIn} onRecipeClick={(id) => { if (isLoggedIn) setActiveRecipeId(id) }} />
      </main>

      {/* 레시피 상세 모달 — 카드 클릭 시 마운트, lazy fetch.
          onToggleSave 는 로그인 시에만 전달 → 모달 안 북마크 버튼도 비로그인 미노출. */}
      <RecipeDetailDialog
        recipeId={activeRecipeId}
        onClose={() => setActiveRecipeId(null)}
        onCopyIngredient={handleCopyIngredient}
        isSaved={activeRecipeId ? savedRecipeIds.has(activeRecipeId) : false}
        onToggleSave={isLoggedIn ? handleToggleSave : undefined}
      />

      {/* Toaster — root layout 미마운트 (admin 만 마운트). 비-admin 페이지엔 로컬 필요 (CLAUDE.md §7) */}
      <Toaster />

      <FooterSection />
    </div>
  )
}
