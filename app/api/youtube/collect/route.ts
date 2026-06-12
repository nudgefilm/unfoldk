import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { google } from "googleapis"

export const dynamic = "force-dynamic"

function getYoutubeClient() {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) throw new Error("YOUTUBE_API_KEY 미설정")
  return google.youtube({ version: "v3", auth: apiKey })
}

// POST /api/youtube/collect — 어드민 전용, YouTube 검색 후 youtube_videos 에 pending upsert
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "unauthenticated" ? 401 : 403 })
  }

  let body: { service?: string; ref_id?: string; ref_type?: string; query?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 })
  }

  const { service, ref_id, ref_type, query } = body
  if (!service || !query) {
    return NextResponse.json({ error: "service, query 필수" }, { status: 400 })
  }

  const youtube = getYoutubeClient()

  let searchItems: { videoId: string; title: string; thumbnailUrl: string | null; publishedAt: string | null }[] = []
  try {
    const res = await youtube.search.list({
      part: ["snippet"],
      q: query,
      type: ["video"],
      maxResults: 5,
      order: "relevance",
    })

    searchItems = (res.data.items ?? [])
      .filter((item) => !!item.id?.videoId)
      .map((item) => ({
        videoId: item.id!.videoId!,
        title: item.snippet?.title ?? "",
        thumbnailUrl:
          item.snippet?.thumbnails?.high?.url ??
          item.snippet?.thumbnails?.medium?.url ??
          item.snippet?.thumbnails?.default?.url ??
          null,
        publishedAt: item.snippet?.publishedAt ?? null,
      }))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[youtube/collect] search 실패:", msg)
    return NextResponse.json({ error: "YouTube API 오류: " + msg }, { status: 500 })
  }

  if (searchItems.length === 0) {
    return NextResponse.json({ collected: 0, videos: [] })
  }

  const admin = createSupabaseAdminClient()
  const rows = searchItems.map((v) => ({
    service,
    ref_id: ref_id ?? null,
    ref_type: ref_type ?? null,
    video_id: v.videoId,
    title: v.title,
    thumbnail_url: v.thumbnailUrl,
    published_at: v.publishedAt,
    status: "pending",
    updated_at: new Date().toISOString(),
  }))

  const { data, error } = await admin
    .from("youtube_videos")
    .upsert(rows, { onConflict: "video_id", ignoreDuplicates: false })
    .select("id, video_id, title, status")

  if (error) {
    console.error("[youtube/collect] upsert 실패:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ collected: data?.length ?? 0, videos: data ?? [] })
}
