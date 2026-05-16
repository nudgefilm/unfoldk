import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// /api/blog/[slug]/comments
//   GET    — 해당 slug 댓글 목록 (최신순) + 작성자 프로필 join. 비로그인도 조회 가능.
//   POST   — 로그인 유저만 작성. RLS "blog_comments_insert_own" 이 본인 user_id 강제.
//   DELETE — 본인 댓글만 삭제. 쿼리 파라미터 ?id=uuid 로 대상 지정. RLS 가 본인/관리자만 통과.
//
// 슬러그 검증:
//   blog_comments.slug 는 외래키 없는 text. 잘못된 slug 로 댓글이 작성돼도
//   고아 row 가 될 뿐 무결성 영향 없음. 다만 사용자 실수·악의 방지 위해 zod 로 형식 검증.
//
// 프로필 join:
//   RLS users_select_own 정책상 본인 user 정보만 select 가능 → 댓글 작성자
//   프로필 표시 위해 service_role 클라이언트로 한 번에 fetch (다른 라우트도 이 패턴 사용).
//   노출 필드는 id/name/avatar_url 만 — email, plan_type 등 민감 정보 제외.

const SlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "invalid slug format").max(120)

const PostBodySchema = z.object({
  content: z.string().trim().min(1, "댓글 내용 필수").max(1000, "1000자 이하"),
})

interface CommentRow {
  id: string
  slug: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
}

interface UserProfile {
  id: string
  name: string | null
  avatar_url: string | null
}

export interface CommentItem {
  id: string
  content: string
  created_at: string
  updated_at: string
  user: {
    id: string
    name: string
    avatar_url: string | null
  }
}

// ─── GET ────────────────────────────────────────────────────────
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const slugParsed = SlugSchema.safeParse(slug)
  if (!slugParsed.success) {
    return NextResponse.json({ error: "invalid_slug" }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()

  const { data: rows, error } = await supabase
    .from("blog_comments")
    .select("id, slug, user_id, content, created_at, updated_at")
    .eq("slug", slugParsed.data)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    console.error("[blog/comments] 조회 실패:", error.message)
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 })
  }

  const comments = (rows ?? []) as CommentRow[]
  if (comments.length === 0) {
    return NextResponse.json({ comments: [] satisfies CommentItem[] })
  }

  // 작성자 프로필 batch fetch — service_role 로 RLS 우회 (공개 표시 정보만 노출)
  const userIds = Array.from(new Set(comments.map((c) => c.user_id)))
  const admin = createSupabaseAdminClient()
  const { data: profiles, error: profileErr } = await admin
    .from("users")
    .select("id, name, avatar_url")
    .in("id", userIds)

  if (profileErr) {
    console.error("[blog/comments] 프로필 fetch 실패:", profileErr.message)
  }

  const profileMap = new Map<string, UserProfile>()
  for (const p of (profiles ?? []) as UserProfile[]) {
    profileMap.set(p.id, p)
  }

  const items: CommentItem[] = comments.map((c) => {
    const profile = profileMap.get(c.user_id)
    const fallbackName = "UnfoldK reader"
    return {
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      updated_at: c.updated_at,
      user: {
        id: c.user_id,
        name: profile?.name?.trim() || fallbackName,
        avatar_url: profile?.avatar_url ?? null,
      },
    }
  })

  return NextResponse.json({ comments: items })
}

// ─── POST ───────────────────────────────────────────────────────
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  const { slug } = await params
  const slugParsed = SlugSchema.safeParse(slug)
  if (!slugParsed.success) {
    return NextResponse.json({ error: "invalid_slug" }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = PostBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // RLS "blog_comments_insert_own" 정책 — auth.uid() = user_id 자동 검증
  const { data, error } = await supabase
    .from("blog_comments")
    .insert({
      slug: slugParsed.data,
      user_id: user.id,
      content: parsed.data.content,
    })
    .select("id, slug, user_id, content, created_at, updated_at")
    .single()

  if (error) {
    console.error("[blog/comments] insert 실패:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 응답에 프로필 정보 같이 포함 — 클라가 추가 fetch 없이 즉시 prepend 가능
  const meta = (user.user_metadata ?? {}) as { full_name?: string; avatar_url?: string }
  const { data: profile } = await supabase
    .from("users")
    .select("name, avatar_url")
    .eq("id", user.id)
    .single()

  const profileRow = profile as { name?: string | null; avatar_url?: string | null } | null
  const name =
    profileRow?.name?.trim() ||
    meta.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "UnfoldK reader"
  const avatar = profileRow?.avatar_url ?? meta.avatar_url ?? null

  const item: CommentItem = {
    id: data.id,
    content: data.content,
    created_at: data.created_at,
    updated_at: data.updated_at,
    user: {
      id: user.id,
      name,
      avatar_url: avatar,
    },
  }

  return NextResponse.json({ comment: item }, { status: 201 })
}

// ─── DELETE ─────────────────────────────────────────────────────
// 본인 댓글만 삭제. ?id=uuid 쿼리. RLS "blog_comments_delete_own" 정책이 본인 검증.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  const { slug } = await params
  const slugParsed = SlugSchema.safeParse(slug)
  if (!slugParsed.success) {
    return NextResponse.json({ error: "invalid_slug" }, { status: 400 })
  }

  const url = new URL(request.url)
  const idParam = url.searchParams.get("id") ?? ""
  const idParsed = z.string().uuid().safeParse(idParam)
  if (!idParsed.success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }

  // .select("id") — RLS 미통과로 0 행 삭제 시 데이터 비어있어 silent fail 감지 가능
  const { data, error } = await supabase
    .from("blog_comments")
    .delete()
    .eq("id", idParsed.data)
    .eq("slug", slugParsed.data)
    .select("id")

  if (error) {
    console.error("[blog/comments] delete 실패:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data || data.length === 0) {
    // RLS 차단 (본인 아님) 또는 이미 삭제됨 — 보안상 동일하게 403 으로 처리
    return NextResponse.json({ error: "forbidden_or_not_found" }, { status: 403 })
  }

  return NextResponse.json({ ok: true })
}
