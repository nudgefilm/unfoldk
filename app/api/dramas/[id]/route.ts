import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { mapDramaRow, DRAMA_SELECT, type DramaApi } from "@/lib/dramas/mapper"

// GET /api/dramas/[id] — 단건 드라마 상세 (모달용)
//
// 응답:
//   { drama: DramaApi, ostArtists?: Array<{id,name,thumbnailUrl,memberCount}> }
//
// OST 아티스트:
//   drama.ostArtistIds 가 있으면 admin 클라이언트로 kpop_artists 조회.
//   RLS 우회 — kpop_artists 는 본래 public read 라 server client 도 가능하지만
//   member_count·is_active 제한 없이 안정적 조회 위해 admin 사용.

export const dynamic = "force-dynamic"

interface OstArtistApi {
  id: string
  name: string
  thumbnailUrl: string | null
  memberCount: number | null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // UUID 정규식 가벼운 검증 — RLS·DB 미스로 인한 500 회피
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("dramas")
    .select(DRAMA_SELECT)
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("[/api/dramas/[id]] 조회 실패:", error)
    return NextResponse.json(
      { error: "query_failed", message: error.message },
      { status: 500 }
    )
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const drama: DramaApi = mapDramaRow(data)

  // OST 아티스트 join — admin client (RLS 우회 — kpop_artists 자체는 public read 라 큰 의미 없음)
  let ostArtists: OstArtistApi[] = []
  if (drama.ostArtistIds && drama.ostArtistIds.length > 0) {
    const admin = createSupabaseAdminClient()
    const { data: artists, error: aErr } = await admin
      .from("kpop_artists")
      .select("id, name, thumbnail_url, member_count")
      .in("id", drama.ostArtistIds)
      .eq("is_active", true)
    if (aErr) {
      console.warn("[/api/dramas/[id]] OST 아티스트 조회 실패:", aErr)
    } else {
      const rows = (artists ?? []) as Array<{
        id: string
        name: string
        thumbnail_url: string | null
        member_count: number | null
      }>
      // 입력 순서 보존 — drama.ostArtistIds 인덱스 기준 정렬
      const order = new Map(drama.ostArtistIds.map((id, i) => [id, i]))
      ostArtists = rows
        .map((r) => ({
          id: r.id,
          name: r.name,
          thumbnailUrl: r.thumbnail_url,
          memberCount: r.member_count,
        }))
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    }
  }

  return NextResponse.json({ drama, ostArtists })
}
