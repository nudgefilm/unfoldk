import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { AdminErrorBanner } from "@/components/admin/admin-error-banner"
import { formatPostgrestError } from "@/lib/admin/format-error"
import { KoreanPhrasesAdmin, type KoreanPhraseAdminRow } from "@/components/admin/korean-phrases-admin"

export const dynamic = "force-dynamic"

async function loadPhrases(): Promise<{ ok: true; rows: KoreanPhraseAdminRow[] } | { ok: false; error: string }> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("korean_phrases")
    .select("id, korean, english, drama_name, difficulty, image_url, scene_description, featured_date, created_at")
    .order("created_at", { ascending: false })
    .limit(2000)

  if (error) {
    console.error("[admin/korean] 조회 실패:", error)
    return { ok: false, error: formatPostgrestError(error) }
  }
  return { ok: true, rows: (data ?? []) as KoreanPhraseAdminRow[] }
}

export default async function AdminKoreanPage() {
  const result = await loadPhrases()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold mb-1">HangeulGo — 표현 관리</h1>
        <p className="text-muted-foreground text-sm">
          표현별 이미지 URL 등록 → Grammar Explanation 카드 상단 표시
        </p>
      </div>

      {!result.ok && <AdminErrorBanner message={result.error} />}
      {result.ok && <KoreanPhrasesAdmin rows={result.rows} />}
    </div>
  )
}
