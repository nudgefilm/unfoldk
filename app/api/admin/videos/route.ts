import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// GET /api/admin/videos — 전체 youtube_videos 목록 + pending 카운트 (어드민 전용)
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "unauthenticated" ? 401 : 403 })
  }

  const { searchParams } = new URL(req.url)
  const countOnly = searchParams.get("count_only") === "true"

  const admin = createSupabaseAdminClient()

  if (countOnly) {
    const { count, error } = await admin
      .from("youtube_videos")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ total: count ?? 0 })
  }

  const serviceFilter = searchParams.get("service")
  const statusFilter = searchParams.get("status")

  let query = admin
    .from("youtube_videos")
    .select("id, service, ref_id, ref_type, video_id, title, thumbnail_url, published_at, status, created_at")
    .order("created_at", { ascending: false })

  if (serviceFilter && serviceFilter !== "all") {
    query = query.eq("service", serviceFilter)
  }
  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ videos: data ?? [] })
}
