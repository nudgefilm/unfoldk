import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { hasProAccess } from "@/lib/auth/plan"
import { generateDramaCharacters } from "@/lib/claude/drama-characters"

// GET /api/dramas/[id]/characters — Pro 전용 캐릭터 관계도 (Phase 2)
//
// 동작:
//   1. 로그인 + Pro 검증
//   2. drama_ai_characters 캐시 hit → 즉시 반환
//   3. miss → Claude Haiku 생성 후 캐시 저장
// 응답:
//   - { content: string, cached: boolean }
//   - 403: not_pro / 404: drama_not_found / 422: insufficient_cast

const MODEL = "claude-haiku-4-5"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dramaId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(dramaId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("users")
    .select("plan_type, is_admin, subscription_status")
    .eq("id", user.id)
    .maybeSingle()
  const row = profile as
    | { plan_type?: string; is_admin?: boolean; subscription_status?: string }
    | null
  if (!hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin })) {
    return NextResponse.json({ error: "not_pro" }, { status: 403 })
  }

  // 1. 캐시 hit
  const { data: cached, error: cacheErr } = await supabase
    .from("drama_ai_characters")
    .select("content")
    .eq("drama_id", dramaId)
    .maybeSingle()
  if (cacheErr) {
    console.warn("[/api/dramas/[id]/characters] 캐시 조회 실패:", cacheErr.message)
  }
  if (cached) {
    return NextResponse.json({
      content: (cached as { content: string }).content,
      cached: true,
    })
  }

  // 2. 드라마 메타 fetch
  const { data: drama, error: dramaErr } = await supabase
    .from("dramas")
    .select("id, title, overview, cast_members")
    .eq("id", dramaId)
    .maybeSingle()
  if (dramaErr) {
    return NextResponse.json(
      { error: "drama_lookup_failed", message: dramaErr.message },
      { status: 500 }
    )
  }
  if (!drama) {
    return NextResponse.json({ error: "drama_not_found" }, { status: 404 })
  }

  const dramaRow = drama as {
    id: string
    title: string
    overview: string | null
    cast_members: Array<{ name: string; character: string }> | null
  }

  const cast = dramaRow.cast_members ?? []
  if (cast.length === 0) {
    return NextResponse.json(
      { error: "insufficient_cast", message: "Cast data unavailable." },
      { status: 422 }
    )
  }

  // 3. Claude 호출
  const content = await generateDramaCharacters({
    title: dramaRow.title,
    overview: dramaRow.overview,
    cast,
  })

  if (!content) {
    return NextResponse.json(
      { error: "generation_failed", message: "Could not generate character map." },
      { status: 422 }
    )
  }

  // 4. 캐시 저장
  const admin = createSupabaseAdminClient()
  const { error: insertErr } = await admin
    .from("drama_ai_characters")
    .upsert(
      { drama_id: dramaId, content, model: MODEL },
      { onConflict: "drama_id" }
    )
  if (insertErr) {
    console.warn("[/api/dramas/[id]/characters] 캐시 저장 실패:", insertErr.message)
  }

  return NextResponse.json({ content, cached: false })
}
