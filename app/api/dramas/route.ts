import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// GET /api/dramas — Browse all 드라마 목록 (필터·검색·정렬)
//
// 쿼리:
//   ?genre=Romance              (반복 가능 — OR)
//   ?platform=Netflix           (반복 가능 — OR)
//   ?year=2024                  (반복 가능 — OR)
//   ?status=ongoing|completed   (반복 가능 — OR)
//   ?min_rating=7.5             (TMDB rating ≥ 값. 0~10)
//   ?min_episodes=12            (episode_count ≥ 값)
//   ?max_episodes=24            (episode_count ≤ 값)
//   ?q=tears                    (title 부분 일치)
//   ?sort=rating|year|episode_count  (기본 rating, 내림차순)
//   ?offset=0                   (페이지네이션 — 기본 0)
//
// 노출 한도: 비로그인 포함 모든 유저 동일 — 100개 (현재 카탈로그 64건 ≈ 전부 노출).
//   plan 변별점은 /api/dramas/recommend (Top picks) 와 watchlist (+ 버튼) 에서.
//
// RLS: dramas.is_active=true 만 노출 (어드민이 토글 가능).

export const dynamic = "force-dynamic"

const BROWSE_LIMIT = 100 // plan 무관 — 카탈로그 전체 공개 정책
const STATUS_VALUES = ["ongoing", "completed"] as const
const SORT_VALUES = ["rating", "year", "episode_count"] as const

const QuerySchema = z.object({
  genre: z.array(z.string()).optional(),
  platform: z.array(z.string()).optional(),
  year: z.array(z.coerce.number().int().min(1900).max(2100)).optional(),
  status: z.array(z.enum(STATUS_VALUES)).optional(),
  min_rating: z.coerce.number().min(0).max(10).optional(),
  min_episodes: z.coerce.number().int().min(0).max(9999).optional(),
  max_episodes: z.coerce.number().int().min(0).max(9999).optional(),
  q: z.string().trim().min(1).max(60).optional(),
  sort: z.enum(SORT_VALUES).default("rating"),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
})

export async function GET(request: Request) {
  const url = new URL(request.url)

  // URLSearchParams.getAll() 으로 다중 파라미터 수집 → zod 검증
  const raw = {
    genre: url.searchParams.getAll("genre"),
    platform: url.searchParams.getAll("platform"),
    year: url.searchParams.getAll("year"),
    status: url.searchParams.getAll("status"),
    min_rating: url.searchParams.get("min_rating") ?? undefined,
    min_episodes: url.searchParams.get("min_episodes") ?? undefined,
    max_episodes: url.searchParams.get("max_episodes") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  }

  const parsed = QuerySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_query", issues: parsed.error.issues },
      { status: 400 }
    )
  }
  const {
    genre,
    platform,
    year,
    status,
    min_rating,
    min_episodes,
    max_episodes,
    q,
    sort,
    offset,
  } = parsed.data

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
  if (status && status.length > 0) query = query.in("status", status)
  if (min_rating !== undefined) query = query.gte("rating", min_rating)
  if (min_episodes !== undefined) query = query.gte("episode_count", min_episodes)
  if (max_episodes !== undefined) query = query.lte("episode_count", max_episodes)
  if (q) query = query.ilike("title", `%${q}%`)

  // 정렬 — sort 컬럼 desc + tiebreaker. nullsFirst:false 로 NULL 은 뒤로.
  query = query.order(sort, { ascending: false, nullsFirst: false })
  if (sort !== "rating") {
    query = query.order("rating", { ascending: false, nullsFirst: false })
  }
  query = query.range(offset, offset + limit - 1)

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
