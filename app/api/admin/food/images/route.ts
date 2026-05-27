import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// GET /api/admin/food/images
// 검수 대상 레시피 조회 (image_source IN ('mfds','unsplash') OR image_source IS NULL)
//
// ?count_only=true → { total: number }  (사이드바 배지용)
// 기본            → { recipes: [...], total: number }

export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.reason },
      { status: auth.reason === "unauthenticated" ? 401 : 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const countOnly = searchParams.get("count_only") === "true"
  const admin = createSupabaseAdminClient()

  if (countOnly) {
    const { count, error } = await admin
      .from("food_recipes")
      .select("id", { count: "exact", head: true })
      .or("image_source.is.null,image_source.in.(mfds,unsplash)")

    if (error) {
      console.error("[admin/food/images] count 조회 실패:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ total: count ?? 0 })
  }

  const { data, error } = await admin
    .from("food_recipes")
    .select("id, title, title_en, image_url, image_source")
    .or("image_source.is.null,image_source.in.(mfds,unsplash)")
    .order("title", { ascending: true })
    .limit(500)

  if (error) {
    console.error("[admin/food/images] 조회 실패:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const recipes = data ?? []
  return NextResponse.json({ recipes, total: recipes.length })
}
