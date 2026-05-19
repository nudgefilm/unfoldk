// Spoonacular API 래퍼 — 한식 레시피 검색·상세·재료 기반 추천
//
// 공식: https://spoonacular.com/food-api/docs
// 가격: Cooking plan $29/월 (KfoodKit Phase 2). 무료 tier 일 150 points.
//
// 키 인증: x-api-key 헤더 또는 ?apiKey 쿼리. 본 래퍼는 헤더 방식 사용.
// 쿼터 헤더: X-API-Quota-Used / X-API-Quota-Left / X-API-Quota-Request.
//   잔여(X-API-Quota-Left) 가 100 이하로 떨어지면 console.warn — quota 소진 방지.
//
// 응답 캐싱:
//   - 모든 GET 요청 24h revalidate (레시피·재료 데이터는 거의 영구).
//   - CLAUDE.md §6 #5 (외부 API 응답은 캐시) 원칙 일관.

const SPOONACULAR_BASE = "https://api.spoonacular.com"
const REVALIDATE_24H = 86400

export class SpoonacularError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message)
    this.name = "SpoonacularError"
  }
}

function getApiKey(): string {
  const key = process.env.SPOONACULAR_API_KEY
  if (!key) throw new SpoonacularError("SPOONACULAR_API_KEY 미설정")
  return key
}

// 쿼터 헤더 로깅 — 응답마다 잔여 quota 확인, 100 이하면 warn
function logQuota(endpoint: string, headers: Headers): void {
  const left = headers.get("X-API-Quota-Left")
  if (left === null) return
  const leftNum = Number(left)
  if (!Number.isFinite(leftNum)) return
  if (leftNum <= 100) {
    console.warn(
      `[spoonacular] ⚠️ quota 잔여 ${leftNum} (endpoint=${endpoint}) — 곧 소진. cron 빈도/cap 점검 필요`
    )
  } else {
    console.log(`[spoonacular] quota 잔여 ${leftNum} (endpoint=${endpoint})`)
  }
}

async function spoonFetch<T>(
  endpoint: string,
  params: Record<string, string | number | boolean>
): Promise<T> {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
  )
  const url = `${SPOONACULAR_BASE}${endpoint}?${qs.toString()}`

  let res: Response
  try {
    res = await fetch(url, {
      headers: { "x-api-key": getApiKey() },
      next: { revalidate: REVALIDATE_24H },
    })
  } catch (err) {
    throw new SpoonacularError(
      `네트워크 오류 (${endpoint}): ${err instanceof Error ? err.message : String(err)}`
    )
  }

  logQuota(endpoint, res.headers)

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new SpoonacularError(
      `HTTP ${res.status} (${endpoint}): ${body.slice(0, 200)}`,
      res.status
    )
  }

  return (await res.json()) as T
}

// ─── 응답 타입 ────────────────────────────────────────────────
// complexSearch — addRecipeInformation=true 시 information 필드 포함
export interface SpoonacularRecipe {
  id: number
  title: string
  image?: string
  imageType?: string
  readyInMinutes?: number
  servings?: number
  sourceUrl?: string
  sourceName?: string
  summary?: string
  cuisines?: string[]
  dishTypes?: string[]
  diets?: string[]
  extendedIngredients?: Array<{
    id?: number
    name: string
    amount?: number
    unit?: string
    original?: string
  }>
  analyzedInstructions?: Array<{
    name?: string
    steps?: Array<{
      number: number
      step: string
    }>
  }>
  nutrition?: {
    nutrients?: Array<{
      name: string
      amount: number
      unit: string
      percentOfDailyNeeds?: number
    }>
  }
}

interface ComplexSearchResponse {
  results: SpoonacularRecipe[]
  offset: number
  number: number
  totalResults: number
}

// ─── 1. 한식 레시피 검색 (cuisine=korean) ────────────────────
export async function searchKoreanRecipes(args: {
  query?: string
  offset?: number
  number?: number
}): Promise<{ results: SpoonacularRecipe[]; totalResults: number }> {
  const params: Record<string, string | number | boolean> = {
    cuisine: "korean",
    addRecipeInformation: true,
    number: args.number ?? 20,
    offset: args.offset ?? 0,
  }
  if (args.query?.trim()) params.query = args.query.trim()

  const res = await spoonFetch<ComplexSearchResponse>("/recipes/complexSearch", params)
  return { results: res.results, totalResults: res.totalResults }
}

// ─── 2. 레시피 상세 (id 기반) ────────────────────────────────
// includeNutrition=true 로 영양 정보까지 한 번에 수집.
export async function getRecipeById(id: number): Promise<SpoonacularRecipe> {
  return spoonFetch<SpoonacularRecipe>(`/recipes/${id}/information`, {
    includeNutrition: true,
  })
}

// ─── 3. 재료 기반 한식 레시피 검색 ────────────────────────────
// 사용자가 가진 재료로 만들 수 있는 한식 추천. KfoodKit ingredient-finder 연계.
export async function searchRecipesByIngredient(args: {
  ingredient: string
  number?: number
}): Promise<{ results: SpoonacularRecipe[]; totalResults: number }> {
  const res = await spoonFetch<ComplexSearchResponse>("/recipes/complexSearch", {
    cuisine: "korean",
    includeIngredients: args.ingredient,
    addRecipeInformation: true,
    number: args.number ?? 10,
  })
  return { results: res.results, totalResults: res.totalResults }
}
