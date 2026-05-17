import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { hasProAccess } from "@/lib/auth/plan"
import { generateDramaSummary } from "@/lib/claude/drama-summary"

// GET /api/dramas/[id]/summary — Pro 전용 에피소드 요약 (Phase 2)
//
// 동작:
//   1. 로그인 + Pro 검증
//   2. drama_ai_summaries 캐시 hit → 즉시 반환
//   3. miss → Claude Haiku 생성 후 캐시 저장 (admin client)
// 비용:
//   - 캐시 hit 후 추가 호출 없음 — 드라마당 첫 1회만 Claude
// 응답:
//   - { summary: string, cached: boolean }
//   - 403: not_pro / 404: drama_not_found / 422: insufficient_synopsis

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
    .from("drama_ai_summaries")
    .select("summary")
    .eq("drama_id", dramaId)
    .maybeSingle()
  if (cacheErr) {
    // RLS 차단 외 다른 오류 — 진단 위해 로그만, 진행
    console.warn("[/api/dramas/[id]/summary] 캐시 조회 실패:", cacheErr.message)
  }
  if (cached) {
    return NextResponse.json({ summary: (cached as { summary: string }).summary, cached: true })
  }

  // 2. 드라마 메타 fetch
  const { data: drama, error: dramaErr } = await supabase
    .from("dramas")
    .select("id, title, overview, number_of_episodes, number_of_seasons, genre, cast_members")
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
    number_of_episodes: number | null
    number_of_seasons: number | null
    genre: string | null
    cast_members: Array<{ name: string; character: string }> | null
  }

  // 3. Claude 호출
  const summary = await generateDramaSummary({
    title: dramaRow.title,
    overview: dramaRow.overview,
    numberOfEpisodes: dramaRow.number_of_episodes,
    numberOfSeasons: dramaRow.number_of_seasons,
    genre: dramaRow.genre,
    cast: dramaRow.cast_members ?? [],
  })

  if (!summary) {
    return NextResponse.json(
      { error: "insufficient_synopsis", message: "Could not generate summary." },
      { status: 422 }
    )
  }

  // 4. 캐시 저장 — admin client (Pro user 의 insert 권한 굳이 부여하지 않음)
  const admin = createSupabaseAdminClient()
  const { error: insertErr } = await admin
    .from("drama_ai_summaries")
    .upsert(
      { drama_id: dramaId, summary, model: MODEL },
      { onConflict: "drama_id" }
    )
  if (insertErr) {
    console.warn("[/api/dramas/[id]/summary] 캐시 저장 실패:", insertErr.message)
    // 캐시 실패해도 응답은 정상 — 다음 호출 시 다시 시도
  }

  return NextResponse.json({ summary, cached: false })
}
