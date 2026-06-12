import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { hasProAccess } from "@/lib/auth/plan"

export const dynamic = "force-dynamic"

const LIMIT_MAX = 20

// GET /api/community-feeds?artist_keyword=&limit=20&offset=0
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const keyword = searchParams.get("artist_keyword")
  const limit   = Math.min(Number(searchParams.get("limit") ?? "20"), LIMIT_MAX)
  const offset  = Number(searchParams.get("offset") ?? "0")
  const myFeed  = searchParams.get("my_feed") === "true"

  const supabase = await createSupabaseServerClient()

  let query = supabase
    .from("community_feeds")
    .select("id, user_id, title, content, artist_keyword, created_at, users!inner(email)", { count: "exact" })
    .eq("status", "published")
    .order("created_at", { ascending: false })

  if (keyword) query = query.ilike("artist_keyword", `%${keyword}%`)

  if (myFeed) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ feeds: [], total: 0 })
    query = query.eq("user_id", user.id)
  }

  const { data, count, error } = await query.range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ feeds: data ?? [], total: count ?? 0, limit, offset })
}

const PostSchema = z.object({
  title:          z.string().min(1).max(200),
  content:        z.string().min(1).max(2000),
  artist_keyword: z.string().max(100).optional(),
})

// POST /api/community-feeds — Pro 유저만 작성
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  // Pro 유저 확인
  const { data: profile } = await supabase
    .from("users")
    .select("plan_type, is_admin, trial_ends_at")
    .eq("id", user.id)
    .maybeSingle()
  const row = profile as { plan_type?: string; is_admin?: boolean; trial_ends_at?: string | null } | null
  if (!hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin, trialEndsAt: row?.trial_ends_at })) {
    return NextResponse.json({ error: "pro_required" }, { status: 403 })
  }

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }) }
  const parsed = PostSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 })

  const { data, error } = await supabase
    .from("community_feeds")
    .insert({
      user_id:        user.id,
      title:          parsed.data.title,
      content:        parsed.data.content,
      artist_keyword: parsed.data.artist_keyword ?? null,
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data.id }, { status: 201 })
}
