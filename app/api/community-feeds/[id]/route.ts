import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// GET /api/community-feeds/[id]
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from("community_feeds")
    .select("id, user_id, title, content, artist_keyword, created_at, users!inner(email)")
    .eq("id", id)
    .eq("status", "published")
    .single()

  if (error || !data) return NextResponse.json({ error: "not_found" }, { status: 404 })

  return NextResponse.json({ feed: data })
}

// DELETE /api/community-feeds/[id] — 본인 피드만
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  const { error } = await supabase
    .from("community_feeds")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id) // RLS 보조: 본인 피드만

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
