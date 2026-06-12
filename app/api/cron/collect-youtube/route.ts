import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { google } from "googleapis"

// YouTube 영상 자동 수집 — 5개 서비스 대상 주간 수집
// vercel.json: 매주 월 UTC 02:00 (= KST 월 11:00)
// 수동 호출: Authorization: Bearer ${CRON_SECRET} 또는 어드민 세션
//
// YouTube API 쿼터 계산 (일일 10,000 units):
// kpop:     10 아티스트 × 3 쿼리 × 100 units = 3,000 units
// calendar:  5 이벤트   × 3 쿼리 × 100 units = 1,500 units
// kdrama:   10 드라마   × 2 쿼리 × 100 units = 2,000 units
// curation:  5 스팟     × 2 쿼리 × 100 units = 1,000 units
// 합계: 7,500 units (일일 한도 10,000 이내)
export const maxDuration = 300
export const dynamic = "force-dynamic"

const MIN_VIEW_COUNT: Record<string, number> = {
  kpop:     200_000,
  calendar: 100_000,
  kdrama:   100_000,
  hangeul:   50_000,
  curation:  10_000,
}

const TITLE_BLACKLIST = [
  "reaction", "fan made",
  "#shorts", "shorts",
  "hindi", "vietnam", "tagalog", "malay", "indonesia",
  "thai", "chinese", "cartoon", "anime",
  "driving", "lesson", "howto", "teach",
]

interface VideoDetail {
  videoId: string
  title: string
  thumbnailUrl: string | null
  publishedAt: string | null
  viewCount: number
}

interface StepLog {
  query?: string
  searchResults?: number
  afterBlacklist?: number
  afterViewCount?: number
  upserted?: number
  note?: string
}

function getYoutubeClient() {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) throw new Error("YOUTUBE_API_KEY 미설정")
  return google.youtube({ version: "v3", auth: apiKey })
}

async function collectForEntity(
  youtube: ReturnType<typeof google.youtube>,
  admin: ReturnType<typeof createSupabaseAdminClient>,
  service: string,
  refId: string,
  refType: string,
  queries: string[],
  verbose = false,
): Promise<{ collected: number; filtered: number; logs?: StepLog[] }> {
  const publishedAfter = new Date()
  publishedAfter.setFullYear(publishedAfter.getFullYear() - 1)
  const logs: StepLog[] = []

  // Step 1: search.list — 쿼리별 video_id 수집, 중복 제거
  const videoIdSet = new Set<string>()
  for (const q of queries) {
    try {
      const res = await youtube.search.list({
        part: ["snippet"],
        q,
        type: ["video"],
        maxResults: 5,
        order: "viewCount",
        publishedAfter: publishedAfter.toISOString(),
        relevanceLanguage: "ko",
        regionCode: "KR",
      })
      const count = (res.data.items ?? []).length
      for (const item of res.data.items ?? []) {
        if (item.id?.videoId) videoIdSet.add(item.id.videoId)
      }
      console.log(`[collect-youtube] search.list "${q}" → ${count}건`)
      if (verbose) logs.push({ query: q, searchResults: count })
    } catch (err) {
      console.error(`[collect-youtube] search.list 실패 (${service} / "${q}"):`, err)
      if (verbose) logs.push({ query: q, note: `search 실패: ${String(err)}` })
    }
  }

  const videoIds = Array.from(videoIdSet)
  console.log(`[collect-youtube] 중복제거 후 video_id ${videoIds.length}개`)
  if (videoIds.length === 0) return { collected: 0, filtered: 0, logs: verbose ? logs : undefined }

  // Step 2: videos.list — 통계 조회 (1 unit per call)
  let details: VideoDetail[] = []
  try {
    const res = await youtube.videos.list({ part: ["snippet", "statistics"], id: videoIds })
    details = (res.data.items ?? [])
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
    console.log(`[collect-youtube] videos.list 응답 ${details.length}건`)
  } catch (err) {
    console.error(`[collect-youtube] videos.list 실패 (${service}/${refId}):`, err)
    return { collected: 0, filtered: videoIds.length, logs: verbose ? logs : undefined }
  }

  // Step 3: 블랙리스트 + 조회수 필터
  const minViews = MIN_VIEW_COUNT[service] ?? 10_000
  const afterBlacklist = details.filter((v) => {
    const lower = v.title.toLowerCase()
    return !TITLE_BLACKLIST.some((kw) => lower.includes(kw))
  })
  const passed = afterBlacklist.filter((v) => v.viewCount >= minViews)

  console.log(`[collect-youtube] 블랙리스트 필터: ${details.length} → ${afterBlacklist.length}건`)
  console.log(`[collect-youtube] 조회수 필터(≥${minViews.toLocaleString()}): ${afterBlacklist.length} → ${passed.length}건`)

  if (verbose) {
    logs.push({
      afterBlacklist: afterBlacklist.length,
      afterViewCount: passed.length,
      note: passed.map((v) => `"${v.title}" (${v.viewCount.toLocaleString()} views)`).join(" | "),
    })
  }

  if (passed.length === 0) return { collected: 0, filtered: details.length, logs: verbose ? logs : undefined }

  // Step 4: upsert — UNIQUE(service, ref_id, video_id)
  const rows = passed.map((v) => ({
    service,
    ref_id: refId,
    ref_type: refType,
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
    .select("id")

  if (error) {
    console.error(`[collect-youtube] upsert 실패 (${service}/${refId}):`, error.message)
    return { collected: 0, filtered: passed.length, logs: verbose ? logs : undefined }
  }

  const upserted = data?.length ?? 0
  console.log(`[collect-youtube] upsert 완료 ${upserted}건`)
  if (verbose) logs.push({ upserted })

  return { collected: upserted, filtered: details.length - passed.length, logs: verbose ? logs : undefined }
}

export async function GET(request: Request) {
  // CRON_SECRET 인증 우선, 실패 시 어드민 세션으로 폴백
  const cronAuth = verifyCronAuth(request)
  if (!cronAuth.ok) {
    const adminAuth = await requireAdmin()
    if (!adminAuth.ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  const { searchParams } = new URL(request.url)
  // ?test=true → kdrama·curation 각 1개만 수집, 단계별 상세 로그 응답 포함
  const isTest = searchParams.get("test") === "true"

  const youtube = getYoutubeClient()
  const admin = createSupabaseAdminClient()

  const summary: Record<string, { collected: number; filtered: number; entities: number; logs?: unknown[] }> = {}
  let totalCollected = 0
  let totalFiltered = 0

  if (!isTest) {
    // ── kpop: kpop_artists (is_active, LIMIT 10)
    {
      const { data: artists } = await admin
        .from("kpop_artists")
        .select("id, name")
        .eq("is_active", true)
        .limit(10)

      let sCollected = 0, sFiltered = 0
      for (const artist of artists ?? []) {
        const r = await collectForEntity(youtube, admin, "kpop", artist.id, "artist", [
          `${artist.name} kpop MV`,
          `${artist.name} kpop comeback`,
          `${artist.name} official MV`,
        ])
        sCollected += r.collected
        sFiltered += r.filtered
      }
      summary.kpop = { collected: sCollected, filtered: sFiltered, entities: (artists ?? []).length }
      totalCollected += sCollected
      totalFiltered += sFiltered
    }

    // ── calendar: hallyu_calendar_events (향후 30일, artist_or_drama 있는 것, LIMIT 5)
    {
      const now = new Date().toISOString()
      const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: events } = await admin
        .from("hallyu_calendar_events")
        .select("id, artist_or_drama")
        .not("artist_or_drama", "is", null)
        .gte("event_date", now)
        .lte("event_date", in30)
        .limit(5)

      let sCollected = 0, sFiltered = 0
      for (const ev of events ?? []) {
        const artist = ev.artist_or_drama as string
        const r = await collectForEntity(youtube, admin, "calendar", ev.id, "event", [
          `${artist} kpop MV`,
          `${artist} kpop comeback`,
          `${artist} kpop teaser`,
        ])
        sCollected += r.collected
        sFiltered += r.filtered
      }
      summary.calendar = { collected: sCollected, filtered: sFiltered, entities: (events ?? []).length }
      totalCollected += sCollected
      totalFiltered += sFiltered
    }
  }

  // ── kdrama: dramas (is_active, 최신순, LIMIT 10 / test: LIMIT 1)
  {
    const { data: dramas } = await admin
      .from("dramas")
      .select("id, title")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(isTest ? 1 : 10)

    console.log(`[collect-youtube] kdrama 대상 ${(dramas ?? []).length}개: ${(dramas ?? []).map((d) => d.title).join(", ")}`)

    let sCollected = 0, sFiltered = 0
    const entityLogs: unknown[] = []
    for (const drama of dramas ?? []) {
      const r = await collectForEntity(youtube, admin, "kdrama", drama.id, "drama", [
        `${drama.title} 한국 드라마 공식 예고편`,
        `${drama.title} kdrama official trailer`,
      ], isTest)
      sCollected += r.collected
      sFiltered += r.filtered
      if (isTest && r.logs) entityLogs.push({ entity: drama.title, steps: r.logs })
    }
    summary.kdrama = { collected: sCollected, filtered: sFiltered, entities: (dramas ?? []).length, ...(isTest && { logs: entityLogs }) }
    totalCollected += sCollected
    totalFiltered += sFiltered
  }

  // ── curation: tour_spots (content_type_id IN (12, 14), LIMIT 5 / test: LIMIT 1)
  {
    const { data: spots } = await admin
      .from("tour_spots")
      .select("id, title")
      .in("content_type_id", [12, 14])
      .limit(isTest ? 1 : 5)

    console.log(`[collect-youtube] curation 대상 ${(spots ?? []).length}개: ${(spots ?? []).map((s) => s.title).join(", ")}`)

    let sCollected = 0, sFiltered = 0
    const entityLogs: unknown[] = []
    for (const spot of spots ?? []) {
      const r = await collectForEntity(youtube, admin, "curation", spot.id, "spot", [
        `${spot.title} Korea travel vlog`,
        `${spot.title} 한국 여행`,
      ], isTest)
      sCollected += r.collected
      sFiltered += r.filtered
      if (isTest && r.logs) entityLogs.push({ entity: spot.title, steps: r.logs })
    }
    summary.curation = { collected: sCollected, filtered: sFiltered, entities: (spots ?? []).length, ...(isTest && { logs: entityLogs }) }
    totalCollected += sCollected
    totalFiltered += sFiltered
  }

  console.log(`[collect-youtube] 완료 — 총 ${totalCollected}건 저장 / ${totalFiltered}건 필터됨`)

  return NextResponse.json({
    ok: true,
    total_collected: totalCollected,
    total_filtered: totalFiltered,
    summary,
  })
}
