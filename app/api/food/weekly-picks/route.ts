import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  detectSeason,
  generateWeeklyPicks,
  getWeekStart,
  type RecipeCandidate,
  type WeeklyPicksResult,
} from "@/lib/claude/weekly-picks"

// /api/food/weekly-picks — 이번 주 K-Food Picks (Free 전체 개방 2026-06-01)
//
// 동작:
//   1) 현재 주의 week_start (월요일 UTC) 계산
//   2) food_weekly_picks 에 동일 week_start row 있으면 즉시 반환 (캐시 히트)
//   3) 없으면 food_recipes 후보 50건 추출 → Claude Haiku 선정 → DB 캐싱 → 반환
//
// Next.js cache: revalidate 604800 (1주). 캐시 키는 week_start 동일 동안 매주 갱신.

export const dynamic = "force-dynamic"
export const revalidate = 604800

const CANDIDATE_POOL_SIZE = 50

interface WeeklyPicksResponse {
  week_start: string                    // YYYY-MM-DD
  theme: string
  season: string
  picks: Array<{
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
  }>
}

interface NutritionShape {
  calorie_kcal?: unknown
  type?: unknown
  summary?: unknown
}

function pickCalorie(raw: unknown): number | null {
  if (!raw || typeof raw !== "object") return null
  const v = (raw as NutritionShape).calorie_kcal
  return typeof v === "number" ? v : null
}

export async function GET() {
  // This Week's K-Food Picks — Free 전체 개방 (2026-06-01 변경, 인증 게이트 제거)
  const today = new Date()
  const weekStart = getWeekStart(today)
  const weekStartIso = weekStart.toISOString().slice(0, 10)
  const season = detectSeason(today)

  // 2) 기존 캐시 조회
  const admin = createSupabaseAdminClient()
  const { data: cached, error: cachedErr } = await admin
    .from("food_weekly_picks")
    .select("week_start, theme, picks")
    .eq("week_start", weekStartIso)
    .maybeSingle()

  if (cachedErr) {
    console.error("[weekly-picks] 캐시 조회 실패:", cachedErr)
  }

  let weeklyResult: WeeklyPicksResult
  if (cached) {
    type CachedRow = { week_start: string; theme: string; picks: unknown }
    const r = cached as CachedRow
    if (!Array.isArray(r.picks)) {
      return NextResponse.json({ error: "cache_corrupt" }, { status: 500 })
    }
    weeklyResult = {
      theme: r.theme,
      picks: r.picks as WeeklyPicksResult["picks"],
    }
  } else {
    // 3) 후보군 fetch + Claude 호출 + 캐시 저장
    const { data: candData, error: candErr } = await admin
      .from("food_recipes")
      .select("id, title, title_en, nutrition")
      .order("created_at", { ascending: false })
      .limit(CANDIDATE_POOL_SIZE)

    if (candErr) {
      return NextResponse.json({ error: candErr.message }, { status: 500 })
    }
    type CRow = {
      id: string
      title: string
      title_en: string | null
      nutrition: unknown
    }
    const candidates: RecipeCandidate[] = ((candData ?? []) as CRow[]).map((r) => {
      const n = (r.nutrition && typeof r.nutrition === "object" ? r.nutrition : {}) as NutritionShape
      return {
        id: r.id,
        title_ko: r.title,
        title_en: r.title_en,
        category_ko: typeof n.type === "string" ? n.type : null,
        summary_ko: typeof n.summary === "string" ? n.summary : null,
      }
    })

    try {
      weeklyResult = await generateWeeklyPicks({
        season,
        weekStart,
        candidates,
      })
    } catch (err) {
      console.error("[weekly-picks] generate 실패:", err)
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "generate failed" },
        { status: 500 }
      )
    }

    // DB 캐싱 — race 시 unique(week_start) 충돌 가능 → onConflict ignore
    const { error: upErr } = await admin
      .from("food_weekly_picks")
      .upsert(
        {
          week_start: weekStartIso,
          theme: weeklyResult.theme,
          picks: weeklyResult.picks,
        },
        { onConflict: "week_start" }
      )
    if (upErr) {
      console.warn("[weekly-picks] 캐시 저장 실패 (응답은 정상):", upErr.message)
    }
  }

  // 4) recipe_id 별 메타 조회 (image_url, 칼로리 등)
  const recipeIds = weeklyResult.picks.map((p) => p.recipe_id)
  const { data: recData, error: recErr } = await admin
    .from("food_recipes")
    .select("id, title, title_en, image_url, ready_in_minutes, servings, nutrition")
    .in("id", recipeIds)

  if (recErr) {
    return NextResponse.json({ error: recErr.message }, { status: 500 })
  }
  type RecRow = {
    id: string
    title: string
    title_en: string | null
    image_url: string | null
    ready_in_minutes: number | null
    servings: number | null
    nutrition: unknown
  }
  const recipeMap = new Map<string, RecRow>(
    ((recData ?? []) as RecRow[]).map((r) => [r.id, r])
  )

  const picksWithRecipe: WeeklyPicksResponse["picks"] = []
  for (const pick of weeklyResult.picks) {
    const r = recipeMap.get(pick.recipe_id)
    if (!r) continue       // 삭제된 레시피 — 응답에서 제외
    picksWithRecipe.push({
      recipe_id: pick.recipe_id,
      reason: pick.reason,
      recipe: {
        id: r.id,
        title: r.title,
        title_en: r.title_en,
        image_url: r.image_url,
        ready_in_minutes: r.ready_in_minutes,
        servings: r.servings,
        calorie_kcal: pickCalorie(r.nutrition),
      },
    })
  }

  const response: WeeklyPicksResponse = {
    week_start: weekStartIso,
    theme: weeklyResult.theme,
    season,
    picks: picksWithRecipe,
  }
  return NextResponse.json(response)
}
