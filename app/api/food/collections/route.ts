import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { hasProAccess } from "@/lib/auth/plan"

// /api/food/collections — 사용자 저장 레시피 CRUD
//
// 모두 로그인 필수. RLS "user_food_collections_all_own" (0030) 로 본인 행만 read/write.
//
// GET                    — 본인 저장 + food_recipes join (카드 그리드용 필드)
// POST  body: { recipe_id }   — 저장. Free 5개 cap (Pro·admin 무제한). unique(user_id, recipe_id) 충돌은 conflict 그대로 반환.
// DELETE ?recipe_id=...        — 삭제 (idempotent — 없으면 ok:true)

export const dynamic = "force-dynamic"

const FREE_SAVE_CAP = 5

const PostSchema = z.object({
  recipe_id: z.string().uuid("recipe_id must be uuid"),
})

async function requireUser() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

// ───────── GET ─────────
export async function GET() {
  const { supabase, user } = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  // recipe join — /food 카드 그리드와 동일 필드 + nutrition jsonb (category/level/calorie 평탄화 원본)
  const { data, error } = await supabase
    .from("user_food_collections")
    .select(
      "id, created_at, recipe:food_recipes(id, title, title_en, image_url, ready_in_minutes, servings, nutrition)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[/api/food/collections GET] 조회 실패:", error)
    return NextResponse.json(
      { error: "query_failed", message: error.message, code: error.code },
      { status: 500 }
    )
  }

  // /api/food/recipes (목록) 와 동일한 출력 schema 로 평탄화 — 카드 컴포넌트 재사용 위해
  type JoinedRow = {
    id: string
    created_at: string
    recipe: {
      id: string
      title: string
      title_en: string | null
      image_url: string | null
      ready_in_minutes: number | null
      servings: number | null
      nutrition: { calorie_kcal?: unknown; type?: unknown; level?: unknown } | null
    } | null
  }
  const items = ((data ?? []) as JoinedRow[]).map((row) => {
    const n = row.recipe?.nutrition ?? null
    return {
      id: row.id,                                  // collection row id (삭제용)
      created_at: row.created_at,
      recipe: row.recipe
        ? {
            id: row.recipe.id,
            title: row.recipe.title,
            title_en: row.recipe.title_en,
            image_url: row.recipe.image_url,
            ready_in_minutes: row.recipe.ready_in_minutes,
            servings: row.recipe.servings,
            category: typeof n?.type === "string" ? n.type : null,
            level: typeof n?.level === "string" ? n.level : null,
            calorie_kcal: typeof n?.calorie_kcal === "number" ? n.calorie_kcal : null,
          }
        : null,
    }
  })

  return NextResponse.json({ items })
}

// ───────── POST ─────────
export async function POST(request: Request) {
  const { supabase, user } = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const parsed = PostSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 }
    )
  }

  // Pro / 어드민 권한 — Free cap 검사 우회
  const { data: profile } = await supabase
    .from("users")
    .select("plan_type, is_admin, trial_ends_at")
    .eq("id", user.id)
    .maybeSingle()
  const profileRow = profile as { plan_type?: string; is_admin?: boolean; trial_ends_at?: string | null } | null
  const isPro = hasProAccess({
    planType: profileRow?.plan_type,
    isAdmin: profileRow?.is_admin,
    trialEndsAt: profileRow?.trial_ends_at,
  })

  // Free → 5개 cap (이미 저장한 동일 recipe 가 cap 에 들어가도 unique 충돌이라 별 의미 없음 — count 만 검사)
  if (!isPro) {
    const { count, error: cntErr } = await supabase
      .from("user_food_collections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
    if (cntErr) {
      console.error("[/api/food/collections POST] count 실패:", cntErr)
      return NextResponse.json(
        { error: "query_failed", message: cntErr.message, code: cntErr.code },
        { status: 500 }
      )
    }
    if ((count ?? 0) >= FREE_SAVE_CAP) {
      return NextResponse.json(
        { error: "free_limit_reached", limit: FREE_SAVE_CAP },
        { status: 403 }
      )
    }
  }

  const { data, error } = await supabase
    .from("user_food_collections")
    .insert({ user_id: user.id, recipe_id: parsed.data.recipe_id })
    .select("id, created_at, recipe_id")
    .single()

  if (error) {
    // unique(user_id, recipe_id) 충돌 — 이미 저장한 상태로 응답 (멱등)
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, already: true })
    }
    console.error("[/api/food/collections POST] insert 실패:", error)
    return NextResponse.json(
      { error: "insert_failed", message: error.message, code: error.code },
      { status: 500 }
    )
  }

  return NextResponse.json({ item: data })
}

// ───────── DELETE ─────────
export async function DELETE(request: Request) {
  const { supabase, user } = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  const url = new URL(request.url)
  const recipeId = url.searchParams.get("recipe_id")
  if (!recipeId || !/^[0-9a-f-]{36}$/i.test(recipeId)) {
    return NextResponse.json({ error: "invalid_recipe_id" }, { status: 400 })
  }

  const { error } = await supabase
    .from("user_food_collections")
    .delete()
    .eq("user_id", user.id)
    .eq("recipe_id", recipeId)

  if (error) {
    console.error("[/api/food/collections DELETE] 실패:", error)
    return NextResponse.json(
      { error: "delete_failed", message: error.message, code: error.code },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
