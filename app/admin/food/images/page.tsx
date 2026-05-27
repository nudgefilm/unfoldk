import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { FoodImageReview, type ReviewRow } from "@/components/admin/food-image-review"

export const dynamic = "force-dynamic"

export default async function FoodImagesPage() {
  const admin = createSupabaseAdminClient()

  const { data } = await admin
    .from("food_recipes")
    .select("id, title, title_en, image_url, image_source")
    .or("image_source.is.null,image_source.in.(mfds,unsplash)")
    .order("title", { ascending: true })
    .limit(500)

  const recipes = (data ?? []) as ReviewRow[]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">이미지 검수</h1>
        <p className="text-sm text-muted-foreground mt-1">
          API 수집 이미지를 검토하고 고품질 이미지로 교체합니다.
          검수 완료 시 목록에서 자동으로 제거됩니다.
        </p>
      </div>
      <FoodImageReview initialRecipes={recipes} />
    </div>
  )
}
