import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { AdminErrorBanner } from "@/components/admin/admin-error-banner"
import { formatPostgrestError } from "@/lib/admin/format-error"
import { DramasOstManager } from "@/components/admin/dramas-ost-manager"

// 어드민 — KdramaMatch 드라마 + OST 아티스트 매핑 UI (Phase 2)
//
// 목적:
//   - 드라마별 ost_artist_ids (kpop_artists.id 배열) 수동 매핑
//   - 자동 매칭 대신 큐레이션 — 정확도 우선
// 노출:
//   - dramas 카탈로그 100건 + 각 행에 현재 매핑 아티스트 표시 + 검색 추가 UI
// 권한:
//   - layout 에서 is_admin 검증 후 진입

export const dynamic = "force-dynamic"

export interface AdminDramaRow {
  id: string
  title: string
  title_ko: string | null
  original_name: string | null
  year: number | null
  poster_url: string | null
  ost_artist_ids: string[] | null
  is_active: boolean
}

export interface AdminKpopArtistOption {
  id: string
  name: string
  name_ko: string | null
  thumbnail_url: string | null
  member_count: number | null
}

type LoadResult =
  | { ok: true; dramas: AdminDramaRow[]; artists: AdminKpopArtistOption[] }
  | { ok: false; error: string }

async function loadData(): Promise<LoadResult> {
  const supabase = createSupabaseAdminClient()

  const [dramasRes, artistsRes] = await Promise.all([
    supabase
      .from("dramas")
      .select("id, title, title_ko, original_name, year, poster_url, ost_artist_ids, is_active")
      .order("year", { ascending: false, nullsFirst: false })
      .order("title", { ascending: true })
      .limit(200),
    supabase
      .from("kpop_artists")
      .select("id, name, name_ko, thumbnail_url, member_count")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(1000),
  ])

  if (dramasRes.error) {
    console.error("[admin/dramas] dramas 조회 실패:", dramasRes.error)
    return { ok: false, error: formatPostgrestError(dramasRes.error) }
  }
  if (artistsRes.error) {
    console.error("[admin/dramas] kpop_artists 조회 실패:", artistsRes.error)
    return { ok: false, error: formatPostgrestError(artistsRes.error) }
  }

  return {
    ok: true,
    dramas: (dramasRes.data ?? []) as AdminDramaRow[],
    artists: (artistsRes.data ?? []) as AdminKpopArtistOption[],
  }
}

export default async function AdminDramasPage() {
  const result = await loadData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold mb-1">KdramaMatch</h1>
        <p className="text-muted-foreground text-sm">
          {result.ok
            ? `총 ${result.dramas.length}편 · OST 아티스트 매핑`
            : "조회 실패"}
        </p>
      </div>

      {!result.ok && (
        <AdminErrorBanner
          title="드라마 조회 실패"
          detail={result.error}
          logPrefix="[admin/dramas]"
        />
      )}

      {result.ok && (
        <DramasOstManager dramas={result.dramas} artists={result.artists} />
      )}
    </div>
  )
}
