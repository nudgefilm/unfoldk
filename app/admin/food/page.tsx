import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { AdminErrorBanner } from "@/components/admin/admin-error-banner"
import { formatPostgrestError } from "@/lib/admin/format-error"
import { FoodAdminTable, type FoodAdminRow } from "@/components/admin/food-admin-table"

export const dynamic = "force-dynamic"

type LoadResult =
  | { ok: true; rows: FoodAdminRow[] }
  | { ok: false; error: string }

async function loadFood(): Promise<LoadResult> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("food_recipes")
    .select("id, mafra_rcp_seq, title, title_en, image_url, image_source")
    .order("mafra_rcp_seq", { ascending: true, nullsFirst: false })
    .limit(2000)

  if (error) {
    console.error("[admin/food] 조회 실패:", error)
    return { ok: false, error: formatPostgrestError(error) }
  }
  type Row = {
    id: string
    mafra_rcp_seq: string | null
    title: string
    title_en: string | null
    image_url: string | null
    image_source: "mfds" | "unsplash" | "upload" | "manual" | null
  }
  return { ok: true, rows: (data ?? []) as Row[] }
}

export default async function AdminFoodPage() {
  const result = await loadFood()

  const totals = result.ok
    ? {
        all: result.rows.length,
        withImage: result.rows.filter((r) => !!r.image_url).length,
        withoutImage: result.rows.filter((r) => !r.image_url).length,
      }
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold mb-1">Food 이미지 관리</h1>
        <p className="text-muted-foreground text-sm">
          {totals
            ? `총 ${totals.all.toLocaleString()}건 · 이미지 있음 ${totals.withImage.toLocaleString()} · 없음 ${totals.withoutImage.toLocaleString()}`
            : "조회 실패"}
        </p>
      </div>

      {!result.ok && (
        <AdminErrorBanner
          title="레시피 조회 실패"
          detail={result.error}
          logPrefix="[admin/food]"
        />
      )}

      {result.ok && <FoodAdminTable rows={result.rows} />}
    </div>
  )
}
