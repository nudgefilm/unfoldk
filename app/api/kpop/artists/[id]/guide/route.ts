import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { generateArtistGuide, type ArtistGuide } from "@/lib/claude/kpop-weekly"

// GET /api/kpop/artists/[id]/guide
// DB 에 가이드 있으면 즉시 반환.
// 없으면 Claude Haiku 로 최초 1회 생성 후 DB 저장 → 반환.
// (CLAUDE.md AI 처리 원칙: 아티스트 가이드만 온디맨드 예외 허용)

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = createSupabaseAdminClient()

  // 아티스트 존재 확인
  const { data: artist } = await admin
    .from("kpop_artists")
    .select("id, name")
    .eq("id", id)
    .maybeSingle()

  if (!artist) return NextResponse.json({ guide: null }, { status: 404 })

  // 캐시 확인
  const { data: existing } = await admin
    .from("kpop_artist_guides")
    .select("guide_text, generated_at")
    .eq("artist_id", id)
    .maybeSingle()

  if (existing) {
    const parsed = JSON.parse(existing.guide_text) as ArtistGuide
    return NextResponse.json({ guide: { ...parsed, generated_at: existing.generated_at } })
  }

  // 최초 1회 온디맨드 생성
  const artistRow = artist as { id: string; name: string }
  let guide: ArtistGuide
  try {
    guide = await generateArtistGuide(artistRow.name)
  } catch (err) {
    console.error(`[/api/kpop/artists/${id}/guide] 생성 실패:`, String(err))
    return NextResponse.json({ guide: null })
  }

  const guideText = JSON.stringify(guide)
  const { error } = await admin.from("kpop_artist_guides").insert({
    artist_id: id,
    guide_text: guideText,
  })

  if (error) {
    console.error(`[/api/kpop/artists/${id}/guide] 저장 실패:`, error.message)
  }

  return NextResponse.json({
    guide: { ...guide, generated_at: new Date().toISOString() },
  })
}
