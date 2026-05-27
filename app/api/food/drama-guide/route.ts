import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// GET /api/food/drama-guide
// This Week's K-Drama Food Guide — 이번 주 featured_week 기반 드라마 3개 + 폴백 rotation
//
// 동작:
//   1) 현재 ISO 주차 계산 (예: "2026-W22")
//   2) food_recipes.featured_week = 현재주차 인 레시피 조회
//   3) drama_title 로 그룹핑 → 최대 3개 드라마
//   4) 결과 없으면 drama_title IS NOT NULL 레시피 전체 → 주차 rotation 폴백
//
// 인증 불필요 — 자유 열람 섹션 (레시피 모달 오픈 시 기존 권한 체크)

export const dynamic = "force-dynamic"

function getISOWeekStr(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

interface RecipeRow {
  id: string
  title: string
  title_en: string | null
  image_url: string | null
  image_source: string | null
  drama_title: string | null
  episode_tag: string | null
  scene_description: string | null
}

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

// 업로드/수동 설정 이미지를 먼저, API 수집 이미지는 뒤에 표시
const IMAGE_SOURCE_PRIORITY: Record<string, number> = {
  upload: 0,
  manual: 1,
  unsplash: 2,
  mfds: 3,
}

function groupByDrama(rows: RecipeRow[]): Map<string, FoodItem[]> {
  const map = new Map<string, FoodItem[]>()
  for (const r of rows) {
    if (!r.drama_title) continue
    const list = map.get(r.drama_title) ?? []
    list.push({
      recipe_id: r.id,
      food_name: r.title,
      food_name_en: r.title_en,
      image_url: r.image_url,
      episode_tag: r.episode_tag,
      scene_description: r.scene_description,
    })
    map.set(r.drama_title, list)
  }
  // 각 드라마 내 음식 목록: 업로드 이미지 우선 정렬
  for (const [drama, foods] of map) {
    foods.sort((a, b) => {
      const srcA = (rows.find((r) => r.id === a.recipe_id)?.image_source) ?? null
      const srcB = (rows.find((r) => r.id === b.recipe_id)?.image_source) ?? null
      const pa = srcA ? (IMAGE_SOURCE_PRIORITY[srcA] ?? 4) : 5
      const pb = srcB ? (IMAGE_SOURCE_PRIORITY[srcB] ?? 4) : 5
      return pa - pb
    })
    map.set(drama, foods)
  }
  return map
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const now = new Date()
  const currentWeek = getISOWeekStr(now)
  const weekNum = getISOWeekNumber(now)

  // 1. 이번 주 featured_week 레시피
  const { data: featuredData, error: featuredErr } = await supabase
    .from("food_recipes")
    .select("id, title, title_en, image_url, image_source, drama_title, episode_tag, scene_description")
    .eq("featured_week", currentWeek)
    .not("drama_title", "is", null)
    .order("drama_title")
    .limit(30)

  if (featuredErr) {
    console.error("[drama-guide] featured 조회 실패:", featuredErr.message)
  }

  const featuredRows = (featuredData ?? []) as RecipeRow[]
  const hasFeatured = featuredRows.length > 0

  let dramaMap: Map<string, FoodItem[]>

  if (hasFeatured) {
    dramaMap = groupByDrama(featuredRows)
  } else {
    // 폴백: drama_title 있는 레시피 전체 조회 → 주차 rotation
    const { data: fallbackData } = await supabase
      .from("food_recipes")
      .select("id, title, title_en, image_url, image_source, drama_title, episode_tag, scene_description")
      .not("drama_title", "is", null)
      .order("drama_title")
      .limit(200)
    dramaMap = groupByDrama((fallbackData ?? []) as RecipeRow[])
  }

  if (dramaMap.size === 0) {
    return NextResponse.json({ week: currentWeek, dramas: [] })
  }

  // 2. 드라마 3개 선택
  const allDramas = [...dramaMap.keys()]
  let selectedTitles: string[]

  if (hasFeatured) {
    // featured_week 명시: 최대 3개 그대로 사용
    selectedTitles = allDramas.slice(0, 3)
  } else {
    // 주차 rotation — 레시피 많은 드라마 우선, 주차마다 다른 드라마 노출
    const sorted = [...allDramas].sort(
      (a, b) => (dramaMap.get(b)?.length ?? 0) - (dramaMap.get(a)?.length ?? 0)
    )
    const total = sorted.length
    const offset = weekNum % total
    selectedTitles = []
    for (let i = 0; i < 3 && i < total; i++) {
      selectedTitles.push(sorted[(offset + i) % total])
    }
  }

  const dramas: DramaCard[] = selectedTitles.map((title) => ({
    drama_title: title,
    foods: (dramaMap.get(title) ?? []).slice(0, 4), // 카드당 최대 4개 음식
  }))

  return NextResponse.json({ week: currentWeek, dramas })
}
