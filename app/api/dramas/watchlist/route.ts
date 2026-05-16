import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// /api/dramas/watchlist — 사용자 시청 목록 CRUD
//
// 모두 로그인 필수. RLS "watchlist_all_own" 정책으로 본인 행만 read/write.
//
// GET ?status=watching|want_to_watch|completed       — 본인 시청 목록 (status 필터 옵셔널)
// POST  body: { drama_id, status, current_episode? } — 등록 (이미 있으면 status 갱신, rating/review 보존)
// PATCH body: { drama_id, status?, current_episode?, rating?, review? } — 부분 수정 (0022 컬럼 추가)
// DELETE ?drama_id=...                                — 삭제

export const dynamic = "force-dynamic"

const STATUS_VALUES = ["watching", "want_to_watch", "completed"] as const
type WatchStatus = (typeof STATUS_VALUES)[number]

// rating 0~5 / 0.5 단위는 numeric(2,1) check 제약과 zod step 으로 이중 가드.
// review null 허용 — 빈 문자열은 클라가 trim 후 null 변환 (DB check char_length≤500).
const PostSchema = z.object({
  drama_id: z.string().uuid(),
  status: z.enum(STATUS_VALUES),
  current_episode: z.number().int().min(0).max(9999).optional(),
})

const PatchSchema = z.object({
  drama_id: z.string().uuid(),
  status: z.enum(STATUS_VALUES).optional(),
  current_episode: z.number().int().min(0).max(9999).optional(),
  rating: z.number().min(0).max(5).multipleOf(0.5).nullable().optional(),
  review: z.string().max(500).nullable().optional(),
})

async function requireUser() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

// ───────── GET ─────────
export async function GET(request: Request) {
  const { supabase, user } = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  const url = new URL(request.url)
  const statusParam = url.searchParams.get("status")
  const status =
    statusParam && (STATUS_VALUES as readonly string[]).includes(statusParam)
      ? (statusParam as WatchStatus)
      : null

  // join 으로 drama 정보 함께 — UI 가 한 번에 카드 그리도록
  let query = supabase
    .from("user_watchlist")
    .select(
      "id, status, current_episode, rating, review, created_at, updated_at, drama:dramas(id, tmdb_id, title, title_ko, genre, year, platform, poster_url, rating, episode_count, status)"
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  if (status) query = query.eq("status", status)

  const { data, error } = await query

  if (error) {
    console.error("[/api/dramas/watchlist GET] 조회 실패:", error)
    return NextResponse.json(
      { error: "query_failed", message: error.message, code: error.code },
      { status: 500 }
    )
  }

  return NextResponse.json({ items: data ?? [] })
}

// ───────── POST ─────────
export async function POST(request: Request) {
  const { supabase, user } = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const parsed = PostSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 }
    )
  }

  // upsert (user_id, drama_id) unique → 동일 드라마 재등록 시 status·current_episode 만 갱신
  // rating·review 는 명시적으로 건드리지 않음 (기존 값 보존) — onConflict + 명시 컬럼만 update
  const { data, error } = await supabase
    .from("user_watchlist")
    .upsert(
      {
        user_id: user.id,
        drama_id: parsed.data.drama_id,
        status: parsed.data.status,
        current_episode: parsed.data.current_episode ?? 0,
      },
      { onConflict: "user_id,drama_id" }
    )
    .select("id, status, current_episode, rating, review")
    .single()

  if (error) {
    console.error("[/api/dramas/watchlist POST] upsert 실패:", error)
    return NextResponse.json(
      { error: "upsert_failed", message: error.message, code: error.code },
      { status: 500 }
    )
  }

  return NextResponse.json({ item: data })
}

// ───────── PATCH ─────────
export async function PATCH(request: Request) {
  const { supabase, user } = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const parsed = PatchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 }
    )
  }

  // 변경 필드 화이트리스트 — drama_id 외 최소 1개 필요
  const { drama_id, ...rest } = parsed.data
  const fields = Object.entries(rest).filter(([, v]) => v !== undefined)
  if (fields.length === 0) {
    return NextResponse.json({ error: "no_fields_to_update" }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  for (const [k, v] of fields) {
    // review 빈 문자열 → null 정규화 (DB 는 char_length null 무관)
    if (k === "review" && typeof v === "string" && v.trim().length === 0) {
      update[k] = null
    } else {
      update[k] = v
    }
  }

  const { data, error } = await supabase
    .from("user_watchlist")
    .update(update)
    .eq("user_id", user.id)
    .eq("drama_id", drama_id)
    .select("id, status, current_episode, rating, review")
    .maybeSingle()

  if (error) {
    console.error("[/api/dramas/watchlist PATCH] 실패:", error)
    return NextResponse.json(
      { error: "update_failed", message: error.message, code: error.code },
      { status: 500 }
    )
  }

  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  return NextResponse.json({ item: data })
}

// ───────── DELETE ─────────
export async function DELETE(request: Request) {
  const { supabase, user } = await requireUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  const url = new URL(request.url)
  const dramaId = url.searchParams.get("drama_id")
  if (!dramaId || !/^[0-9a-f-]{36}$/i.test(dramaId)) {
    return NextResponse.json({ error: "invalid_drama_id" }, { status: 400 })
  }

  const { error } = await supabase
    .from("user_watchlist")
    .delete()
    .eq("user_id", user.id)
    .eq("drama_id", dramaId)

  if (error) {
    console.error("[/api/dramas/watchlist DELETE] 실패:", error)
    return NextResponse.json(
      { error: "delete_failed", message: error.message, code: error.code },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
