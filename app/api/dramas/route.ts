import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// GET /api/dramas — Browse all 드라마 목록 (필터·검색)
//
// 쿼리:
//   ?genre=Romance        (반복 가능 — OR)
//   ?platform=Netflix     (반복 가능 — OR)
//   ?year=2024            (반복 가능 — OR)
//   ?q=tears              (title 부분 일치)
//   ?offset=0             (페이지네이션 — 기본 0)
//
// 노출 한도: 비로그인 포함 모든 유저 동일 — 100개 (현재 카탈로그 64건 ≈ 전부 노출).
//   plan 변별점은 /api/dramas/recommend (Top picks) 와 watchlist (+ 버튼) 에서.
//
// RLS: dramas.is_active=true 만 노출 (어드민이 토글 가능).

export const dynamic = "force-dynamic"

const BROWSE_LIMIT = 100  // plan 무관 — 카탈로그 전체 공개 정책

const QuerySchema = z.object({
  genre: z.array(z.string()).optional(),
  platform: z.array(z.string()).optional(),
  year: z.array(z.coerce.number().int().min(1900).max(2100)).optional(),
  q: z.string().trim().min(1).max(60).optional(),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
})

export async function GET(request: Request) {
  const url = new URL(request.url)

  // URLSearchParams.getAll() 으로 다중 파라미터 수집 → zod 검증
  const raw = {
    genre: url.searchParams.getAll("genre"),
    platform: url.searchParams.getAll("platform"),
    year: url.searchParams.getAll("year"),
    q: url.searchParams.get("q") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  }

  const parsed = QuerySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_query", issues: parsed.error.issues },
      { status: 400 }
    )
  }
  const { genre, platform, year, q, offset } = parsed.data

  const supabase = await createSupabaseServerClient()

  const limit = BROWSE_LIMIT

  // 1. 쿼리 빌드 — RLS 가 is_active 필터링 처리. plan 분기 없음 (browse all).
  let query = supabase
    .from("dramas")
    .select(
      "id, tmdb_id, title, title_ko, genre, year, platform, poster_url, rating, overview, episode_count, status",
      { count: "exact" }
    )

  if (genre && genre.length > 0) query = query.in("genre", genre)
  if (platform && platform.length > 0) query = query.in("platform", platform)
  if (year && year.length > 0) query = query.in("year", year)
  if (q) query = query.ilike("title", `%${q}%`)

  query = query
    .order("rating", { ascending: false, nullsFirst: false })
    .order("year", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error("[/api/dramas] 조회 실패:", error)
    return NextResponse.json(
      { error: "query_failed", message: error.message, code: error.code },
      { status: 500 }
    )
  }

  return NextResponse.json({
    dramas: data ?? [],
    limit,
    offset,
    total: count ?? null,
  })
}
