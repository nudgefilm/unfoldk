import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// GET /api/hallyu-feed?category=&source=&limit=20&offset=0
// count_only=true → { count: N } 어드민 배지용
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category   = searchParams.get("category")   // 'kpop' | 'kdrama' | 'kbeauty' | 'general'
  const source     = searchParams.get("source")      // 'koreaboo' | 'allkpop' | 'soompi'
  const limit      = Math.min(Number(searchParams.get("limit") ?? "20"), 50)
  const offset     = Number(searchParams.get("offset") ?? "0")
  const countOnly  = searchParams.get("count_only") === "true"

  const supabase = await createSupabaseServerClient()

  let query = supabase
    .from("hallyu_news")
    .select("id, source, title, url, thumbnail_url, image_url, published_at, category, summary, sources, related_artist, content_type", {
      count: countOnly ? "exact" : undefined,
      head: countOnly,
    })
    .order("published_at", { ascending: false })

  if (category) query = query.eq("category", category)
  if (source)   query = query.eq("source", source)

  if (countOnly) {
    const { count, error } = await query
    if (error) return NextResponse.json({ count: 0 })
    return NextResponse.json({ count: count ?? 0 })
  }

  const { data, error } = await query.range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ news: data ?? [], limit, offset })
}
