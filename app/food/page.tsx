"use client"

import { useEffect, useRef, useState } from "react"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Trophy, ChevronRight, ChevronLeft, Lock, Bot, Sparkles, Clock, Flame, Plus, Check, ShoppingCart, X as XIcon } from "lucide-react"
import Link from "next/link"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { hasProAccess } from "@/lib/auth/plan"
import { RecipeDetailDialog } from "@/components/food/recipe-detail-dialog"
import { WeeklyPicksSection } from "@/components/food/weekly-picks-section"

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

interface FinderSubstitute {
  name: string
  note: string
}

interface FinderResult {
  substitutes: FinderSubstitute[]
  stores: string[]
  tip: string
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

interface ShoppingItem {
  id: string
  name: string
  checked: boolean
}

export default function KfoodKitPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")              // 300ms 후 API 호출
  const [isPro, setIsPro] = useState(false)                               // monthly/annual/admin 통합 판별

  // 레시피 카탈로그 (Popular K-Drama Recipes 섹션) — 서버 페이지네이션
  const [recipes, setRecipes] = useState<RecipeListItem[]>([])
  const [recipesLoading, setRecipesLoading] = useState(true)
  const [recipesError, setRecipesError] = useState<string | null>(null)
  const [recipesPage, setRecipesPage] = useState(1)
  const [recipesTotal, setRecipesTotal] = useState(0)
  const recipesGridRef = useRef<HTMLDivElement | null>(null)              // 페이지 변경 시 smooth scroll target

  // 상세 모달 — 선택된 recipe id (null = 닫힘)
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null)

  // AI Ingredient Finder 상태
  const [finderCountry, setFinderCountry] = useState("US")
  const [finderIngredient, setFinderIngredient] = useState("")
  const [finderLoading, setFinderLoading] = useState(false)
  const [finderResult, setFinderResult] = useState<FinderResult | null>(null)
  const [finderError, setFinderError] = useState<string | null>(null)

  // My Shopping List — localStorage 영속화 (로그인 불필요)
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([])
  const [shoppingHydrated, setShoppingHydrated] = useState(false)         // hydration 완료 전엔 localStorage 쓰기 skip

  // 마운트 시 plan 권한 확인 — Pro 잠금 가드용
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
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

  // 재료명 클립보드 복사 — 모달에서 호출. navigator.clipboard 지원 안 되면 silent fail.
  const handleCopyIngredient = (name: string) => {
    if (!name) return
    try {
      void navigator.clipboard?.writeText(name)
    } catch (err) {
      console.warn("[food] clipboard 복사 실패:", err)
    }
  }

  // Ingredient Finder — POST /api/food/ingredient-finder
  // Pro 가드는 라우트 측에서 403 으로 반환. UI 는 blur overlay 로 미리 막아 401/403 조우 최소화.
  const handleFinderSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = finderIngredient.trim()
    if (!trimmed) return

    setFinderLoading(true)
    setFinderError(null)
    setFinderResult(null)
    try {
      const res = await fetch("/api/food/ingredient-finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredient: trimmed, country: finderCountry }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          typeof json.error === "string"
            ? json.error
            : "Could not find substitutes — try again."
        setFinderError(msg)
        return
      }
      setFinderResult({
        substitutes: json.substitutes ?? [],
        stores: json.stores ?? [],
        tip: json.tip ?? "",
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
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
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

        {/* Weekly Challenge Banner */}
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
                    This Week&apos;s Challenge: Make Japchae
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    From Itaewon Class · Difficulty: Intermediate
                  </p>
                  <p className="text-muted-foreground text-xs mt-2">
                    1,240 fans joined
                  </p>
                </div>
              </div>
              <Link href="/food/challenge">
                <Button 
                  className="rounded-full font-medium text-white whitespace-nowrap"
                  style={{ backgroundColor: "#FF4B6E" }}
                >
                  Start Challenge
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

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
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => setActiveRecipeId(recipe.id)}
                    className="text-left bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/50 transition-colors"
                  >
                    {/* 이미지 — MAFRA 응답엔 이미지 없음. 이후 enrichment 단계에서 채워짐 */}
                    <div className="h-40 bg-[#252525] flex items-center justify-center overflow-hidden">
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
                )
              })}

              {recipes.length === 0 && !recipesError && (
                <p className="col-span-full text-muted-foreground text-sm">
                  No recipes match your search.
                </p>
              )}
            </div>
          )}

          {/* 페이지네이션 — totalPages > 1 일 때만 노출 */}
          {!recipesLoading && totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
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
              <span className="text-sm text-muted-foreground tabular-nums">
                Page {recipesPage} / {totalPages}
              </span>
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

        {/* This Week's K-Food Picks (Pro 전용) — Popular Recipes 아래 */}
        <WeeklyPicksSection isPro={isPro} onRecipeClick={(id) => setActiveRecipeId(id)} />

        {/* AI Ingredient Substitution (Pro Feature) — isPro 면 블러·오버레이 해제 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-6">UnfoldK Ingredient Finder</h2>
          <div className="relative">
            <div
              className={`bg-[#1a1a1a] border border-border/30 rounded-xl p-6 ${
                isPro ? "" : "blur-[4px] pointer-events-none"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <Bot className="w-6 h-6" style={{ color: "#FF4B6E" }} />
                <h3 className="text-lg font-semibold text-white">Local Ingredient Finder</h3>
              </div>
              <p className="text-muted-foreground text-sm mb-6">
                Paste any Korean ingredient from a recipe above — we&apos;ll find substitutes
                and where to buy it in your country.
              </p>

              <form
                onSubmit={handleFinderSubmit}
                className="grid grid-cols-1 md:grid-cols-[1fr_240px_auto] gap-3 mb-6"
              >
                {/* 식재료 검색 */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Korean ingredient
                  </label>
                  <Input
                    value={finderIngredient}
                    onChange={(e) => setFinderIngredient(e.target.value)}
                    placeholder="e.g. Gochugaru, Doenjang, Tteok"
                    maxLength={80}
                    className="bg-[#0d0d0f] border-[#2a2a2a] rounded-lg text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                {/* 국가 선택 — 지역별 optgroup */}
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

                {/* 제출 */}
                <div className="md:self-end">
                  <Button
                    type="submit"
                    disabled={finderLoading || finderIngredient.trim().length === 0}
                    className="h-10 rounded-full font-medium text-white px-5 w-full md:w-auto"
                    style={{ backgroundColor: "#FF4B6E" }}
                  >
                    <Sparkles className="w-4 h-4 mr-1.5" />
                    {finderLoading ? "Finding..." : "Find"}
                  </Button>
                </div>
              </form>

              {/* 결과 / 에러 / 빈 상태 */}
              {finderError ? (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">
                  {finderError}
                </div>
              ) : finderResult ? (
                <div className="space-y-4">
                  {/* 대체 재료 — 각 항목에 Add to Shopping List 버튼 */}
                  <div className="bg-[#252525] rounded-lg p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                      Substitutes
                    </p>
                    <ul className="space-y-2">
                      {finderResult.substitutes.map((s, i) => {
                        const inList = shoppingItems.some(
                          (item) => item.name.toLowerCase() === s.name.toLowerCase()
                        )
                        return (
                          <li key={i} className="text-sm flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <span className="text-foreground font-medium">{s.name}</span>
                              {s.note && (
                                <span className="text-muted-foreground"> — {s.note}</span>
                              )}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={inList}
                              onClick={() => handleAddToShoppingList(s.name)}
                              className="flex-shrink-0 h-7 px-2.5 text-xs bg-transparent border-[#3a3a3a] text-foreground hover:bg-[#1a1a1a]"
                            >
                              {inList ? (
                                <>
                                  <Check className="w-3 h-3 mr-1" />
                                  Added
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3 mr-1" />
                                  Add to List
                                </>
                              )}
                            </Button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>

                  {/* 현지 스토어 */}
                  {finderResult.stores.length > 0 && (
                    <div className="bg-[#252525] rounded-lg p-4">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                        Where to buy
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {finderResult.stores.map((store) => (
                          <span
                            key={store}
                            className="text-xs font-medium px-2.5 py-1 rounded-full"
                            style={{
                              backgroundColor: "rgba(255, 75, 110, 0.15)",
                              color: "#FF4B6E",
                            }}
                          >
                            {store}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tip */}
                  {finderResult.tip && (
                    <div className="bg-[#141416] border border-border/30 rounded-lg p-3 text-sm text-muted-foreground">
                      💡 {finderResult.tip}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Search for any Korean ingredient — we&apos;ll find substitutes and local stores in
                  your country.
                </p>
              )}
            </div>

            {/* Upgrade Overlay */}
            {!isPro && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-[#1a1a1a] border border-border/50 rounded-xl p-6 text-center shadow-xl">
                  <Lock className="w-8 h-8 mx-auto mb-3" style={{ color: "#FF4B6E" }} />
                  <p className="text-white font-medium mb-2">Coming with Hallyu Pass</p>
                  <p className="text-muted-foreground text-xs mb-4">Available at launch.</p>
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

        {/* My Shopping List — localStorage 영속화. 로그인·Pro 불필요. */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
            <h2 className="text-2xl font-semibold text-white">My Shopping List</h2>
            {shoppingItems.length > 0 && (
              <button
                type="button"
                onClick={handleClearShoppingList}
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
          <p className="text-muted-foreground text-sm mb-6">
            Search for Korean ingredients above to build your shopping list.
          </p>
          <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6">
            {shoppingItems.length === 0 ? (
              <div className="text-center py-6">
                <ShoppingCart className="w-8 h-8 mx-auto mb-3 text-muted-foreground/60" />
                <p className="text-muted-foreground text-sm">
                  Your list is empty. Use the Ingredient Finder above and tap{" "}
                  <span className="text-foreground font-medium">Add to List</span> on any substitute.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {shoppingItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 group"
                  >
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
                        item.checked
                          ? "line-through text-muted-foreground"
                          : "text-foreground"
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
          </div>
        </section>
      </main>

      {/* 레시피 상세 모달 — 카드 클릭 시 마운트, lazy fetch */}
      <RecipeDetailDialog
        recipeId={activeRecipeId}
        onClose={() => setActiveRecipeId(null)}
        onCopyIngredient={handleCopyIngredient}
      />

      <FooterSection />
    </div>
  )
}
