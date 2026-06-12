import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// related_artist + category → 내부 페이지 링크 해석
// kpop   → kpop_artists 테이블 ILIKE 검색 → /kpop/[id]
// kdrama → dramas 테이블 title ILIKE 검색 → /drama/[id]
// 매칭 실패 또는 kbeauty/general → null
async function resolveRelatedLink(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  category: string | null,
  relatedArtist: string | null,
): Promise<{ href: string; label: string } | null> {
  if (!relatedArtist || !category) return null

  if (category === "kpop") {
    const { data } = await supabase
      .from("kpop_artists")
      .select("id, name")
      .ilike("name", relatedArtist)
      .limit(1)
      .maybeSingle()
    if (!data) return null
    const row = data as { id: string; name: string }
    return { href: `/kpop/${row.id}`, label: `View ${row.name} on KpopStats →` }
  }

  if (category === "kdrama") {
    const { data } = await supabase
      .from("dramas")
      .select("id, title")
      .ilike("title", relatedArtist)
      .limit(1)
      .maybeSingle()
    if (!data) return null
    const row = data as { id: string; title: string }
    return { href: `/drama/${row.id}`, label: `Find ${row.title} on KdramaMatch →` }
  }

  return null
}

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

  const row = data as {
    id: string; source: string; title: string; url: string
    thumbnail_url: string | null; image_url: string | null
    published_at: string | null; category: string | null
    summary: string | null; related_artist: string | null
    sources: string[] | null; content_type: string | null
  }

  const related_link = await resolveRelatedLink(supabase, row.category, row.related_artist)

  return NextResponse.json({ news: { ...row, related_link } })
}
