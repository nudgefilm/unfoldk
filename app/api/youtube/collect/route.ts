import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { google } from "googleapis"

export const dynamic = "force-dynamic"

// 서비스별 최소 조회수 기준
const MIN_VIEW_COUNT: Record<string, number> = {
  kpop:     200_000,
  calendar: 100_000,
  kdrama:   100_000,
  hangeul:   50_000,
  curation:  10_000,
}

// 제목 블랙리스트 — 소문자 매칭
const TITLE_BLACKLIST = ["reaction", "fan made"]

function getYoutubeClient() {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) throw new Error("YOUTUBE_API_KEY 미설정")
  return google.youtube({ version: "v3", auth: apiKey })
}

// POST /api/youtube/collect
// body: { service, ref_id, ref_type, query }
// 1) YouTube search.list (maxResults=10, publishedAfter=1년전)
// 2) videos.list 로 통계(viewCount) 조회
// 3) 블랙리스트·조회수 필터 적용
// 4) youtube_videos 에 pending upsert — UNIQUE(service, ref_id, video_id)
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

  // publishedAfter: 현재 기준 1년 전
  const publishedAfter = new Date()
  publishedAfter.setFullYear(publishedAfter.getFullYear() - 1)

  // ── Step 1: search.list — video_id 목록 수집 (100 units)
  let videoIds: string[] = []
  try {
    const searchRes = await youtube.search.list({
      part: ["snippet"],
      q: query,
      type: ["video"],
      maxResults: 10,
      order: "viewCount",
      publishedAfter: publishedAfter.toISOString(),
    })
    videoIds = (searchRes.data.items ?? [])
      .map((i) => i.id?.videoId)
      .filter((id): id is string => !!id)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[youtube/collect] search.list 실패:", msg)
    return NextResponse.json({ error: "YouTube search API 오류: " + msg }, { status: 500 })
  }

  if (videoIds.length === 0) {
    return NextResponse.json({ collected: 0, filtered: 0, videos: [] })
  }

  // ── Step 2: videos.list — snippet + statistics (1 unit)
  interface VideoDetail {
    videoId: string
    title: string
    thumbnailUrl: string | null
    publishedAt: string | null
    viewCount: number
  }
  let details: VideoDetail[] = []
  try {
    const videosRes = await youtube.videos.list({
      part: ["snippet", "statistics"],
      id: videoIds,
    })
    details = (videosRes.data.items ?? [])
      .filter((v) => !!v.id)
      .map((v) => ({
        videoId: v.id!,
        title: v.snippet?.title ?? "",
        thumbnailUrl:
          v.snippet?.thumbnails?.high?.url ??
          v.snippet?.thumbnails?.medium?.url ??
          v.snippet?.thumbnails?.default?.url ??
          null,
        publishedAt: v.snippet?.publishedAt ?? null,
        viewCount: v.statistics?.viewCount ? Number(v.statistics.viewCount) : 0,
      }))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[youtube/collect] videos.list 실패:", msg)
    return NextResponse.json({ error: "YouTube videos API 오류: " + msg }, { status: 500 })
  }

  // ── Step 3: 필터링
  const minViews = MIN_VIEW_COUNT[service] ?? 10_000
  const passed = details.filter((v) => {
    const titleLower = v.title.toLowerCase()
    if (TITLE_BLACKLIST.some((kw) => titleLower.includes(kw))) return false
    if (v.viewCount < minViews) return false
    return true
  })

  if (passed.length === 0) {
    return NextResponse.json({ collected: 0, filtered: details.length, videos: [] })
  }

  // ── Step 4: upsert — UNIQUE(service, ref_id, video_id)
  const admin = createSupabaseAdminClient()
  const rows = passed.map((v) => ({
    service,
    ref_id: ref_id ?? null,
    ref_type: ref_type ?? null,
    video_id: v.videoId,
    title: v.title,
    thumbnail_url: v.thumbnailUrl,
    view_count: v.viewCount,
    published_at: v.publishedAt,
    status: "pending",
    updated_at: new Date().toISOString(),
  }))

  const { data, error } = await admin
    .from("youtube_videos")
    .upsert(rows, { onConflict: "service,ref_id,video_id", ignoreDuplicates: false })
    .select("id, video_id, title, view_count, status")

  if (error) {
    console.error("[youtube/collect] upsert 실패:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[youtube/collect] service=${service} query="${query}" searched=${videoIds.length} filtered=${details.length - passed.length} saved=${data?.length ?? 0}`)

  return NextResponse.json({
    collected: data?.length ?? 0,
    filtered: details.length - passed.length,
    videos: data ?? [],
  })
}
