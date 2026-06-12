import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from("hallyu_news")
    .select("id, source, title, url, thumbnail_url, image_url, published_at, category, summary, related_artist, sources, content_type")
    .eq("id", id)
    .single()

  if (error || !data) return NextResponse.json({ error: "not found" }, { status: 404 })

  return NextResponse.json(
    { news: data },
    { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=120" } },
  )
}
