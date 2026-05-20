import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { AdminErrorBanner } from "@/components/admin/admin-error-banner"
import { formatPostgrestError } from "@/lib/admin/format-error"
import { FoodAdminTabs } from "@/components/admin/food-admin-tabs"
import type { FoodAdminRow } from "@/components/admin/food-admin-table"
import type { ChallengeAdminRow } from "@/components/admin/challenges-admin"

export const dynamic = "force-dynamic"

type RecipesResult = { ok: true; rows: FoodAdminRow[] } | { ok: false; error: string }
type ChallengesResult =
  | { ok: true; rows: ChallengeAdminRow[] }
  | { ok: false; error: string }

async function loadRecipes(): Promise<RecipesResult> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("food_recipes")
    .select("id, mafra_rcp_seq, title, title_en, image_url, image_source")
    .order("mafra_rcp_seq", { ascending: true, nullsFirst: false })
    .limit(2000)

  if (error) {
    console.error("[admin/food] recipes 조회 실패:", error)
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

async function loadChallenges(): Promise<ChallengesResult> {
  const supabase = createSupabaseAdminClient()
  // 최근 10건 — Active + upcoming + 최근 past 모두 포괄
  const { data, error } = await supabase
    .from("food_challenges")
    .select("id, title, description, food_name, image_url, week_start, week_end, created_at")
    .order("week_start", { ascending: false })
    .limit(10)

  if (error) {
    console.error("[admin/food] challenges 조회 실패:", error)
    return { ok: false, error: formatPostgrestError(error) }
  }
  return { ok: true, rows: (data ?? []) as ChallengeAdminRow[] }
}

export default async function AdminFoodPage() {
  const [recipesRes, challengesRes] = await Promise.all([
    loadRecipes(),
    loadChallenges(),
  ])
  const todayIso = new Date().toISOString().slice(0, 10)

  const totals = recipesRes.ok
    ? {
        all: recipesRes.rows.length,
        withImage: recipesRes.rows.filter((r) => !!r.image_url).length,
        withoutImage: recipesRes.rows.filter((r) => !r.image_url).length,
      }
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold mb-1">Food 관리</h1>
        <p className="text-muted-foreground text-sm">
          {totals
            ? `레시피 ${totals.all.toLocaleString()}건 · 이미지 있음 ${totals.withImage.toLocaleString()} · 없음 ${totals.withoutImage.toLocaleString()}`
            : "레시피 조회 실패"}
        </p>
      </div>

      {!recipesRes.ok && (
        <AdminErrorBanner
          title="레시피 조회 실패"
          detail={recipesRes.error}
          logPrefix="[admin/food]"
        />
      )}
      {!challengesRes.ok && (
        <AdminErrorBanner
          title="챌린지 조회 실패"
          detail={challengesRes.error}
          logPrefix="[admin/food/challenges]"
        />
      )}

      <FoodAdminTabs
        recipes={recipesRes.ok ? recipesRes.rows : []}
        challenges={challengesRes.ok ? challengesRes.rows : []}
        todayIso={todayIso}
      />
    </div>
  )
}
