import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { google } from "googleapis"

// YouTube 영상 자동 수집 — 5개 서비스 대상 주간 수집
// vercel.json: 매주 월 UTC 02:00 (= KST 월 11:00)
// 수동 호출: Authorization: Bearer ${CRON_SECRET}
//
// YouTube API 쿼터 계산 (일일 10,000 units):
// kpop:     10 아티스트 × 3 쿼리 × 100 units = 3,000 units
// calendar:  5 이벤트   × 3 쿼리 × 100 units = 1,500 units
// kdrama:   10 드라마   × 3 쿼리 × 100 units = 3,000 units
// hangeul:   5 드라마   × 2 쿼리 × 100 units = 1,000 units
// curation:  5 스팟     × 2 쿼리 × 100 units = 1,000 units
// 합계: 9,500 units (일일 한도 10,000 이내)
export const maxDuration = 300
export const dynamic = "force-dynamic"

const MIN_VIEW_COUNT: Record<string, number> = {
  kpop:     200_000,
  calendar: 100_000,
  kdrama:   100_000,
  hangeul:   50_000,
  curation:  10_000,
}

const TITLE_BLACKLIST = ["reaction", "fan made"]

interface VideoDetail {
  videoId: string
  title: string
  thumbnailUrl: string | null
  publishedAt: string | null
  viewCount: number
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
): Promise<{ collected: number; filtered: number }> {
  const publishedAfter = new Date()
  publishedAfter.setFullYear(publishedAfter.getFullYear() - 1)

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
      })
      for (const item of res.data.items ?? []) {
        if (item.id?.videoId) videoIdSet.add(item.id.videoId)
      }
    } catch (err) {
      console.error(`[collect-youtube] search.list 실패 (${service} / "${q}"):`, err)
    }
  }

  const videoIds = Array.from(videoIdSet)
  if (videoIds.length === 0) return { collected: 0, filtered: 0 }

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
  } catch (err) {
    console.error(`[collect-youtube] videos.list 실패 (${service}/${refId}):`, err)
    return { collected: 0, filtered: videoIds.length }
  }

  // Step 3: 블랙리스트 + 조회수 필터
  const minViews = MIN_VIEW_COUNT[service] ?? 10_000
  const passed = details.filter((v) => {
    const lower = v.title.toLowerCase()
    if (TITLE_BLACKLIST.some((kw) => lower.includes(kw))) return false
    return v.viewCount >= minViews
  })

  if (passed.length === 0) return { collected: 0, filtered: details.length }

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
    return { collected: 0, filtered: passed.length }
  }

  return { collected: data?.length ?? 0, filtered: details.length - passed.length }
}

export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  const youtube = getYoutubeClient()
  const admin = createSupabaseAdminClient()

  const summary: Record<string, { collected: number; filtered: number; entities: number }> = {}
  let totalCollected = 0
  let totalFiltered = 0

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
        `${artist.name} MV`,
        `${artist.name} comeback`,
        `${artist.name} official`,
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
        `${artist} MV`,
        `${artist} comeback`,
        `${artist} teaser`,
      ])
      sCollected += r.collected
      sFiltered += r.filtered
    }
    summary.calendar = { collected: sCollected, filtered: sFiltered, entities: (events ?? []).length }
    totalCollected += sCollected
    totalFiltered += sFiltered
  }

  // ── kdrama: dramas (is_active, 최신순, LIMIT 10)
  {
    const { data: dramas } = await admin
      .from("dramas")
      .select("id, title")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(10)

    let sCollected = 0, sFiltered = 0
    for (const drama of dramas ?? []) {
      const r = await collectForEntity(youtube, admin, "kdrama", drama.id, "drama", [
        `${drama.title} trailer`,
        `${drama.title} official`,
        `${drama.title} OST`,
      ])
      sCollected += r.collected
      sFiltered += r.filtered
    }
    summary.kdrama = { collected: sCollected, filtered: sFiltered, entities: (dramas ?? []).length }
    totalCollected += sCollected
    totalFiltered += sFiltered
  }

  // ── hangeul: korean_phrases (drama_id 기준 중복 제거, LIMIT 5)
  {
    const { data: phrases } = await admin
      .from("korean_phrases")
      .select("drama_id, drama_name")
      .not("drama_id", "is", null)
      .not("drama_name", "is", null)
      .limit(200)

    // drama_id 기준 중복 제거
    const seen = new Set<string>()
    const uniqueDramas: Array<{ drama_id: string; drama_name: string }> = []
    for (const p of phrases ?? []) {
      if (!seen.has(p.drama_id) && uniqueDramas.length < 5) {
        seen.add(p.drama_id)
        uniqueDramas.push({ drama_id: p.drama_id, drama_name: p.drama_name as string })
      }
    }

    let sCollected = 0, sFiltered = 0
    for (const d of uniqueDramas) {
      const r = await collectForEntity(youtube, admin, "hangeul", d.drama_id, "expression", [
        `${d.drama_name} trailer`,
        `${d.drama_name} clip`,
      ])
      sCollected += r.collected
      sFiltered += r.filtered
    }
    summary.hangeul = { collected: sCollected, filtered: sFiltered, entities: uniqueDramas.length }
    totalCollected += sCollected
    totalFiltered += sFiltered
  }

  // ── curation: tour_spots (content_type_id IN (12, 14), LIMIT 5)
  {
    const { data: spots } = await admin
      .from("tour_spots")
      .select("id, title")
      .in("content_type_id", [12, 14])
      .limit(5)

    let sCollected = 0, sFiltered = 0
    for (const spot of spots ?? []) {
      const r = await collectForEntity(youtube, admin, "curation", spot.id, "spot", [
        `${spot.title} Korea travel`,
        `${spot.title} 여행`,
      ])
      sCollected += r.collected
      sFiltered += r.filtered
    }
    summary.curation = { collected: sCollected, filtered: sFiltered, entities: (spots ?? []).length }
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
