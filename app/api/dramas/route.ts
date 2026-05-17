import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { mapDramaRow, DRAMA_SELECT } from "@/lib/dramas/mapper"

// GET /api/dramas — Browse all 드라마 목록 (필터·검색·정렬)
//
// 쿼리:
//   ?genre=Romance              (반복 가능 — OR)
//   ?platform=Netflix           (반복 가능 — OR)
//   ?year=2024                  (반복 가능 — OR)
//   ?status=ongoing|completed   (반복 가능 — OR)
//   ?min_rating=3.5             (rating ≥ 값. 5점 척도)
//   ?min_episodes=12            (episode_count ≥ 값)
//   ?max_episodes=24            (episode_count ≤ 값)
//   ?q=tears                    (title 부분 일치)
//   ?sort=rating|year|episode_count|popularity|latest  (기본 rating, 내림차순)
//                               (latest = first_air_date 기준 — Phase 2 추가)
//   ?offset=0                   (페이지네이션 — 기본 0)
//   ?limit=24                   (페이지 크기 — 기본 100, max 100. Phase 2.1 추가)
//
// 노출 한도: 비로그인 포함 모든 유저 동일 — 최대 100개.

export const dynamic = "force-dynamic"

const BROWSE_LIMIT_MAX = 100
const BROWSE_LIMIT_DEFAULT = 100
const STATUS_VALUES = ["ongoing", "completed"] as const
// Phase 2 — popularity / latest / next_episode 정렬 추가
const SORT_VALUES = [
  "rating",
  "year",
  "episode_count",
  "popularity",
  "latest",
  "next_episode",
] as const

const QuerySchema = z.object({
  genre: z.array(z.string()).optional(),
  platform: z.array(z.string()).optional(),
  year: z.array(z.coerce.number().int().min(1900).max(2100)).optional(),
  status: z.array(z.enum(STATUS_VALUES)).optional(),
  min_rating: z.coerce.number().min(0).max(10).optional(),
  min_episodes: z.coerce.number().int().min(0).max(9999).optional(),
  max_episodes: z.coerce.number().int().min(0).max(9999).optional(),
  // Phase 2 — on_the_air 필터 ("true" 만 의미. 그 외 무시)
  on_the_air: z.enum(["true", "false"]).optional(),
  q: z.string().trim().min(1).max(60).optional(),
  sort: z.enum(SORT_VALUES).default("rating"),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
  limit: z.coerce.number().int().min(1).max(BROWSE_LIMIT_MAX).default(BROWSE_LIMIT_DEFAULT),
})

export async function GET(request: Request) {
  const url = new URL(request.url)

  const raw = {
    genre: url.searchParams.getAll("genre"),
    platform: url.searchParams.getAll("platform"),
    year: url.searchParams.getAll("year"),
    status: url.searchParams.getAll("status"),
    min_rating: url.searchParams.get("min_rating") ?? undefined,
    min_episodes: url.searchParams.get("min_episodes") ?? undefined,
    max_episodes: url.searchParams.get("max_episodes") ?? undefined,
    on_the_air: url.searchParams.get("on_the_air") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
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
    on_the_air,
    q,
    sort,
    offset,
    limit,
  } = parsed.data

  const supabase = await createSupabaseServerClient()

  let query = supabase.from("dramas").select(DRAMA_SELECT, { count: "exact" })

  if (genre && genre.length > 0) query = query.in("genre", genre)
  if (platform && platform.length > 0) query = query.in("platform", platform)
  if (year && year.length > 0) query = query.in("year", year)
  if (status && status.length > 0) query = query.in("status", status)
  if (min_rating !== undefined) query = query.gte("rating", min_rating)
  if (min_episodes !== undefined) query = query.gte("episode_count", min_episodes)
  if (max_episodes !== undefined) query = query.lte("episode_count", max_episodes)
  if (on_the_air === "true") query = query.eq("on_the_air", true)
  if (q) query = query.ilike("title", `%${q}%`)

  // 정렬 — sort 컬럼 desc + tiebreaker rating desc
  // latest 는 year desc, next_episode 는 next_episode_date asc (가까운 화 먼저)
  if (sort === "latest") {
    query = query.order("year", { ascending: false, nullsFirst: false })
    query = query.order("rating", { ascending: false, nullsFirst: false })
  } else if (sort === "next_episode") {
    query = query.order("next_episode_date", { ascending: true, nullsFirst: false })
    query = query.order("popularity", { ascending: false, nullsFirst: false })
  } else {
    query = query.order(sort, { ascending: false, nullsFirst: false })
    if (sort !== "rating") {
      query = query.order("rating", { ascending: false, nullsFirst: false })
    }
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

  const dramas = (data ?? []).map(mapDramaRow)

  return NextResponse.json({
    dramas,
    limit,
    offset,
    total: count ?? null,
  })
}
