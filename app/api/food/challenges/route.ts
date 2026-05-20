import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// /api/food/challenges — 현재 주간 K푸드 챌린지 (공개)
//
// GET: week_start <= today <= week_end 인 챌린지 1건 + 매칭 레시피 id.
//      없으면 { challenge: null, recipeId: null }.
//      매칭 레시피는 food_name 으로 food_recipes.title ILIKE 검색 — Start 버튼이 모달로 보낼 id 미리 lookup.
//
// 정책: anon+auth read (0030 food_challenges_select_all).

export const dynamic = "force-dynamic"

export interface FoodChallenge {
  id: string
  title: string
  description: string | null
  food_name: string | null
  image_url: string | null
  week_start: string                          // YYYY-MM-DD (PostgreSQL date)
  week_end: string
}

interface ChallengeRow {
  id: string
  title: string
  description: string | null
  food_name: string | null
  image_url: string | null
  week_start: string
  week_end: string
}

export async function GET() {
  const supabase = await createSupabaseServerClient()

  // 오늘 (UTC) 가 [week_start, week_end] 범위에 들어가는 챌린지.
  // 여러 개가 겹치면 가장 최근 시작분.
  const todayIso = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from("food_challenges")
    .select("id, title, description, food_name, image_url, week_start, week_end")
    .lte("week_start", todayIso)
    .gte("week_end", todayIso)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("[/api/food/challenges] 조회 실패:", error)
    return NextResponse.json(
      { error: "query_failed", message: error.message, code: error.code },
      { status: 500 }
    )
  }

  if (!data) {
    return NextResponse.json({ challenge: null, recipeId: null })
  }

  const challenge = data as ChallengeRow

  // food_name 으로 매칭 레시피 첫 1건 — Start 버튼이 모달로 띄울 id.
  let recipeId: string | null = null
  if (challenge.food_name) {
    const pattern = `%${challenge.food_name.replace(/[%_]/g, "")}%`
    const { data: rec, error: recErr } = await supabase
      .from("food_recipes")
      .select("id")
      .or(`title.ilike.${pattern},title_en.ilike.${pattern}`)
      .limit(1)
      .maybeSingle()
    if (recErr) {
      console.warn("[/api/food/challenges] recipe lookup 실패:", recErr.message)
    } else if (rec) {
      recipeId = (rec as { id: string }).id
    }
  }

  return NextResponse.json({
    challenge: challenge as FoodChallenge,
    recipeId,
  })
}
