import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// GET /api/videos?service=&ref_id=&ref_type= — published 영상 반환 (RLS: published only)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const service = searchParams.get("service")
  const refId = searchParams.get("ref_id")
  const refType = searchParams.get("ref_type")

  if (!service) {
    return NextResponse.json({ error: "service 필수" }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()

  let query = supabase
    .from("youtube_videos")
    .select("id, video_id, title, thumbnail_url, published_at")
    .eq("service", service)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(10)

  if (refId) query = query.eq("ref_id", refId)
  if (refType) query = query.eq("ref_type", refType)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ videos: data ?? [] }, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=60" },
  })
}
