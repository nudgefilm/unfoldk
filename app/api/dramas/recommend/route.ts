import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import {
  recommendDramas,
  recommendDramasPersonalized,
  type WatchlistEntry,
  type RatingEntry,
} from "@/lib/claude/recommend-dramas"
import { hasProAccess } from "@/lib/auth/plan"
import { DRAMA_SELECT, mapDramaRow } from "@/lib/dramas/mapper"

// POST /api/dramas/recommend — 취향 기반 Top picks 추천
//
// body: { genres: string[], moods: string[], platforms: string[] }
// 동작:
//   1. 후보 60개 1차 필터링 (선택된 genre/platform OR 전체 인기순)
//   2. Claude Haiku 로 ranking + reason (최대 30 추천 반환)
//   3. plan 별 한도로 슬라이스 후 dramas 행 + reason 합성
//
// 인증: 비로그인도 호출 가능 (3건 미리보기). 결과 노출 한도가 핵심 plan 변별점.

export const dynamic = "force-dynamic"

// Top picks 정책: anon 3 미리보기 / free 5 / paid 30 (Claude 실효 상한)
const ANON_LIMIT = 3
const FREE_LIMIT = 5
const PAID_LIMIT = 30

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
  let isPro = false
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("plan_type, is_admin, trial_ends_at")
      .eq("id", user.id)
      .maybeSingle()
    const row = profile as { plan_type?: string; is_admin?: boolean; trial_ends_at?: string | null } | null
    isPro = hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin, trialEndsAt: row?.trial_ends_at })
    limit = isPro ? PAID_LIMIT : FREE_LIMIT
  }

  // 3. 후보 60개 — genre/platform 으로 1차 필터링, 없으면 인기 전체
  let query = supabase.from("dramas").select(DRAMA_SELECT)

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

  const mapped = candidates.map(mapDramaRow)

  // candidate 공통 입력 — 개인화·일반 양쪽에서 재사용
  const candidateInput = mapped.map((c) => ({
    id: c.id,
    title: c.title,
    title_ko: c.titleKo,
    genre: c.genre,
    year: c.year,
    platform: c.platform,
    rating: c.rating,
    overview: c.overview,
  }))
  const dramaById = new Map(mapped.map((c) => [c.id, c]))

  // 결제 연동 후 아래 상수를 `isPro && !!user` 로 교체 // 2026-05-16 임시 정책
  const usePersonalized: boolean = false // isPro && !!user

  // 4. Claude 추천 호출 (개인화 or 일반)
  if (usePersonalized && user) {
    // [Pro] 시청 이력 + 평점 기반 개인화 추천
    const { data: wRows } = await supabase
      .from("user_watchlist")
      .select("status, rating, drama:dramas(title)")
      .eq("user_id", user.id)
      .limit(100)
    type WRow = { status: string; rating: number | null; drama: { title: string } | null }
    const watchlistEntries: WatchlistEntry[] = ((wRows ?? []) as WRow[])
      .filter((r) => r.drama?.title)
      .map((r) => ({
        dramaTitle: r.drama!.title,
        status: r.status as WatchlistEntry["status"],
      }))
    const ratingEntries: RatingEntry[] = ((wRows ?? []) as WRow[])
      .filter((r) => r.drama?.title && r.rating !== null)
      .map((r) => ({ dramaTitle: r.drama!.title, rating: r.rating! }))

    const personalized = await recommendDramasPersonalized({
      genres,
      moods,
      platforms,
      candidates: candidateInput,
      watchlist: watchlistEntries,
      ratings: ratingEntries,
    })
    const recs = personalized.items
      .slice(0, limit)
      .map((item) => {
        const drama = dramaById.get(item.id)
        if (!drama) return null
        return { ...drama, reason: item.reason, personalizedReason: item.personalizedReason }
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
    return NextResponse.json({
      recommendations: recs,
      limit,
      source: personalized.source,
      note: personalized.note,
    })
  }

  // 5. 일반 추천 (Free / anon) — personalizedReason: null
  const result = await recommendDramas({
    genres,
    moods,
    platforms,
    candidates: candidateInput,
  })
  const recommendations = result.items
    .slice(0, limit)
    .map((item) => {
      const drama = dramaById.get(item.id)
      if (!drama) return null
      return { ...drama, reason: item.reason, personalizedReason: null }
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)

  return NextResponse.json({
    recommendations,
    limit,
    source: result.source,
    note: result.note,
  })
}
