import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { requireAdmin } from "@/lib/admin/auth"

export const dynamic = "force-dynamic"

// GET /api/admin/community-feeds/list — 어드민 전체 목록 (report_count DESC)
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: "unauthorized" }, { status: auth.reason === "unauthenticated" ? 401 : 403 })

  const admin = createSupabaseAdminClient()

  const { data, error } = await admin
    .from("community_feeds")
    .select("id, user_id, title, content, artist_keyword, status, report_count, created_at, users!inner(email)")
    .order("report_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ feeds: data ?? [] })
}
