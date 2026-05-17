import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// PATCH /api/admin/dramas/[id] — 어드민 OST 아티스트 매핑 저장 (Phase 2)
//
// body: { ost_artist_ids: string[] }
// 동작:
//   - kpop_artists.id 배열 검증 (존재·중복 제거)
//   - dramas.ost_artist_ids 컬럼만 update
// 권한:
//   - is_admin 필수
// 멱등성:
//   - 동일 id 배열로 여러 번 호출 무해 (update 만 발생)

export const dynamic = "force-dynamic"

const PatchSchema = z.object({
  ost_artist_ids: z.array(z.string().uuid()).max(20),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.reason },
      { status: auth.reason === "unauthenticated" ? 401 : 403 }
    )
  }

  const { id: dramaId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(dramaId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 }
    )
  }

  // 중복 제거 + 순서 보존
  const seen = new Set<string>()
  const uniqueIds: string[] = []
  for (const id of parsed.data.ost_artist_ids) {
    if (!seen.has(id)) {
      seen.add(id)
      uniqueIds.push(id)
    }
  }

  const supabase = createSupabaseAdminClient()

  // 존재 검증 — kpop_artists 에 모두 있는지 확인 (잘못된 id 박제 방지)
  if (uniqueIds.length > 0) {
    const { data: existingArtists, error: artistsErr } = await supabase
      .from("kpop_artists")
      .select("id")
      .in("id", uniqueIds)
    if (artistsErr) {
      return NextResponse.json(
        { error: "artists_lookup_failed", message: artistsErr.message },
        { status: 500 }
      )
    }
    const existingSet = new Set(
      (existingArtists ?? []).map((r) => (r as { id: string }).id)
    )
    const missing = uniqueIds.filter((id) => !existingSet.has(id))
    if (missing.length > 0) {
      return NextResponse.json(
        { error: "unknown_artist_ids", missing },
        { status: 400 }
      )
    }
  }

  const { data, error } = await supabase
    .from("dramas")
    .update({ ost_artist_ids: uniqueIds.length > 0 ? uniqueIds : null })
    .eq("id", dramaId)
    .select("id, ost_artist_ids")
    .single()

  if (error) {
    console.error("[/api/admin/dramas/[id]] 업데이트 실패:", error)
    return NextResponse.json(
      { error: "update_failed", message: error.message, code: error.code },
      { status: 500 }
    )
  }

  return NextResponse.json({ drama: data })
}
