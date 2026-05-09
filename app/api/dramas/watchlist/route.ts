import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// /api/dramas/watchlist — 사용자 시청 목록 CRUD
//
// 모두 로그인 필수. RLS "watchlist_all_own" 정책으로 본인 행만 read/write.
//
// GET ?status=watching|want_to_watch|completed       — 본인 시청 목록 (status 필터 옵셔널)
// POST  body: { drama_id, status, current_episode? } — 등록 (이미 있으면 status 갱신)
// PATCH body: { drama_id, status?, current_episode? } — 수정
// DELETE ?drama_id=...                                — 삭제

export const dynamic = "force-dynamic"

const STATUS_VALUES = ["watching", "want_to_watch", "completed"] as const
type WatchStatus = (typeof STATUS_VALUES)[number]

const PostSchema = z.object({
  drama_id: z.string().uuid(),
  status: z.enum(STATUS_VALUES),
  current_episode: z.number().int().min(0).max(9999).optional(),
})

const PatchSchema = z.object({
  drama_id: z.string().uuid(),
  status: z.enum(STATUS_VALUES).optional(),
  current_episode: z.number().int().min(0).max(9999).optional(),
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
      "id, status, current_episode, created_at, drama:dramas(id, title, title_ko, genre, year, platform, poster_url, rating, episode_count, status)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

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

  // upsert (user_id, drama_id) unique → 동일 드라마 재등록 시 status 만 갱신
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
    .select("id, status, current_episode")
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

  // status / current_episode 둘 다 미지정 시 에러
  if (parsed.data.status === undefined && parsed.data.current_episode === undefined) {
    return NextResponse.json({ error: "no_fields_to_update" }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (parsed.data.status !== undefined) update.status = parsed.data.status
  if (parsed.data.current_episode !== undefined)
    update.current_episode = parsed.data.current_episode

  const { data, error } = await supabase
    .from("user_watchlist")
    .update(update)
    .eq("user_id", user.id)
    .eq("drama_id", parsed.data.drama_id)
    .select("id, status, current_episode")
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
