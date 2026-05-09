import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { recommendDramas } from "@/lib/claude/recommend-dramas"
import { hasProAccess } from "@/lib/auth/plan"

// POST /api/dramas/recommend — 취향 기반 추천
//
// body: { genres: string[], moods: string[], platforms: string[] }
// 동작:
//   1. 후보 60개 1차 필터링 (선택된 genre/platform OR 전체 인기순)
//   2. Claude Haiku 로 ranking + reason
//   3. ranking 결과를 dramas 행 + reason 합성해 반환
//
// 인증: 비로그인도 호출 가능 — 추천 자체는 free 기능. 단, 결과 노출 한도는 list API 와 동일하게 비회원 6개.

export const dynamic = "force-dynamic"

const ANON_LIMIT = 6
const FREE_LIMIT = 12
const PAID_LIMIT = 30                       // 추천은 list 보다 보수적 (Claude 토큰 비용)

const BodySchema = z.object({
  genres: z.array(z.string().max(40)).max(10).default([]),
  moods: z.array(z.string().max(40)).max(10).default([]),
  platforms: z.array(z.string().max(40)).max(10).default([]),
})

export async function POST(request: Request) {
  // 1. body 파싱
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 }
    )
  }
  const { genres, moods, platforms } = parsed.data

  const supabase = await createSupabaseServerClient()

  // 2. plan 별 결과 한도 결정
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let limit = ANON_LIMIT
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("plan_type, is_admin")
      .eq("id", user.id)
      .maybeSingle()
    const row = profile as { plan_type?: string; is_admin?: boolean } | null
    const isPaidActive = hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin })
    limit = isPaidActive ? PAID_LIMIT : FREE_LIMIT
  }

  // 3. 후보 60개 — genre/platform 으로 1차 필터링, 없으면 인기 전체
  let query = supabase
    .from("dramas")
    .select("id, title, title_ko, genre, year, platform, poster_url, rating, overview, episode_count, status")

  if (genres.length > 0) query = query.in("genre", genres)
  if (platforms.length > 0) query = query.in("platform", platforms)

  query = query
    .order("rating", { ascending: false, nullsFirst: false })
    .limit(60)

  const { data: candidates, error } = await query

  if (error) {
    console.error("[/api/dramas/recommend] 후보 조회 실패:", error)
    return NextResponse.json(
      { error: "query_failed", message: error.message, code: error.code },
      { status: 500 }
    )
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ recommendations: [], source: "fallback", note: "no candidates" })
  }

  // 4. Claude 추천 호출
  const result = await recommendDramas({
    genres,
    moods,
    platforms,
    candidates: candidates.map((c) => ({
      id: c.id,
      title: c.title,
      title_ko: c.title_ko,
      genre: c.genre,
      year: c.year,
      platform: c.platform,
      rating: c.rating,
      overview: c.overview,
    })),
  })

  // 5. id → drama row 매핑 + reason 합성, 한도 적용
  const dramaById = new Map(candidates.map((c) => [c.id, c]))
  const recommendations = result.items
    .slice(0, limit)
    .map((item) => {
      const drama = dramaById.get(item.id)
      if (!drama) return null
      return { ...drama, reason: item.reason }
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)

  return NextResponse.json({
    recommendations,
    limit,
    source: result.source,
    note: result.note,
  })
}
