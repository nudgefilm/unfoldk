import { NextResponse } from "next/server"
import { XMLParser } from "fast-xml-parser"
import Anthropic from "@anthropic-ai/sdk"
import { verifyCronAuth } from "@/lib/cron/auth"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// Hallyu Feed 수집 파이프라인 — 하루 1회 (01:00 UTC)
// RSS는 키워드 추출 전용 (DB 저장 안 함). 유저에게는 Sonnet 4.6 독자 콘텐츠만 노출.
// 흐름: RSS 제목 파싱 → 키워드 추출 → Sonnet 독자 콘텐츠 생성 → DB insert
export const maxDuration = 300
export const dynamic = "force-dynamic"

const FEEDS = [
  { source: "koreaboo",   url: "https://www.koreaboo.com/feed/" },
  { source: "seoulbeats", url: "https://seoulbeats.com/feed" },
  { source: "soompi",     url: "https://www.soompi.com/feed" },
] as const

const MAX_FROM_RSS      = 5  // RSS 키워드 기반 생성 건수
const MAX_FROM_INTERNAL = 3  // 내부 데이터 기반 생성 건수
const anthropic = new Anthropic()

// ── RSS XML 파싱 → 제목 목록만 추출 ─────────────────────────────────────────
async function fetchRssTitles(feedUrl: string): Promise<string[]> {
  try {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "UnfoldK News Bot/1.0" },
      next: { revalidate: 0 },
    })
    if (!res.ok) return []
    const xml = await res.text()
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      isArray: (name) => name === "item",
      cdataPropName: "__cdata",
      parseAttributeValue: false,
    })
    const doc = parser.parse(xml)
    const channel = doc?.rss?.channel ?? doc?.feed
    const items: unknown[] = channel?.item ?? []
    return items
      .filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
      .map((item) => {
        const raw = item["title"]
        return typeof raw === "object"
          ? String((raw as Record<string, unknown>)["__cdata"] ?? "")
          : String(raw ?? "")
      })
      .filter(Boolean)
      .slice(0, 15)
  } catch {
    return []
  }
}

// ── Claude Sonnet 4.6 독자 콘텐츠 생성 ──────────────────────────────────────
const GEN_SYSTEM = `You are a K-culture content writer for UnfoldK (unfoldk.com). Write original, engaging content for global Hallyu fans.
Use the provided keywords only as topic inspiration. Write completely original content — do not summarize or paraphrase any source.
Only use factual, well-known information about K-pop and K-drama. Do not fabricate quotes, events, or statistics.`

interface GenResult {
  title: string
  paragraph1: string
  paragraph2: string
  paragraph3: string
  related_artist: string
  category: "kpop" | "kdrama" | "kbeauty" | "general"
}

async function generateContent(keyword: string): Promise<GenResult | null> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: [{ type: "text", text: GEN_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{
        role: "user",
        content: `Write an original K-culture article inspired by this topic/keyword: ${keyword}

Structure:
Paragraph 1: Introduction and context (max 100 words)
Paragraph 2: Recent trends and industry analysis (max 80 words)
Paragraph 3: Global fan community impact (max 80 words)

Generate a compelling headline.
Category: one of [kpop, kdrama, kbeauty, general]

Respond ONLY in JSON:
{
  "title": "...",
  "paragraph1": "...",
  "paragraph2": "...",
  "paragraph3": "...",
  "related_artist": "...",
  "category": "..."
}`,
      }],
    })
    const block = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")
    if (!block) return null
    const raw = block.text.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "")
    return JSON.parse(raw) as GenResult
  } catch (err) {
    console.error("[collect-hallyu-feed] 생성 실패:", err instanceof Error ? err.message : String(err))
    return null
  }
}

// ── 내부 데이터 기반 키워드 수집 ────────────────────────────────────────────
async function fetchInternalKeywords(admin: ReturnType<typeof createSupabaseAdminClient>): Promise<string[]> {
  const keywords: string[] = []

  // kpop_artists — 최근 lastfm_listeners 높은 아티스트 1~2명
  const { data: artists } = await admin
    .from("kpop_artists")
    .select("name")
    .eq("is_active", true)
    .order("id", { ascending: false })
    .limit(50)
  if (artists && artists.length > 0) {
    const picks = (artists as { name: string }[])
      .sort(() => Math.random() - 0.5)
      .slice(0, 2)
      .map(a => `${a.name} K-pop artist latest trends`)
    keywords.push(...picks)
  }

  // hallyu_calendar_events — 다음 30일 이내 이벤트 1건
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: events } = await admin
    .from("hallyu_calendar_events")
    .select("title, artist_name, event_type")
    .gte("event_date", new Date().toISOString().slice(0, 10))
    .lte("event_date", soon.slice(0, 10))
    .order("event_date", { ascending: true })
    .limit(5)
  if (events && events.length > 0) {
    const ev = (events as { title: string; artist_name?: string; event_type?: string }[])[
      Math.floor(Math.random() * events.length)
    ]
    const label = ev.artist_name ? `${ev.artist_name} ${ev.event_type ?? "event"}` : ev.title
    keywords.push(`${label} Hallyu news`)
  }

  // dramas — 최근 high-rated 드라마 1건
  const { data: dramas } = await admin
    .from("dramas")
    .select("title, genre, year")
    .gte("year", new Date().getFullYear() - 1)
    .order("rating", { ascending: false })
    .limit(10)
  if (dramas && dramas.length > 0) {
    const d = (dramas as { title: string; genre?: string; year?: number }[])[
      Math.floor(Math.random() * dramas.length)
    ]
    keywords.push(`${d.title} K-drama ${d.genre ?? ""}`.trim())
  }

  return keywords.filter(Boolean)
}

// ── URL 존재 여부 확인 (generated는 고유 slug 사용) ───────────────────────────
function makeGeneratedUrl(slug: string): string {
  return `https://unfoldk.com/hallyu-feed/gen-${slug}`
}

// ── 메인 핸들러 ──────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const cronAuth = verifyCronAuth(request)
  if (!cronAuth.ok) {
    const adminAuth = await requireAdmin()
    if (!adminAuth.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const admin = createSupabaseAdminClient()

  // ── 1. RSS에서 제목 수집 → 키워드 풀 생성 ───────────────────────────────
  const titlePool: string[] = []
  for (const feed of FEEDS) {
    const titles = await fetchRssTitles(feed.url)
    titlePool.push(...titles)
    console.log(`[collect-hallyu-feed] ${feed.source}: ${titles.length}개 제목 수집`)
  }

  // 중복 제거 후 랜덤 선택
  const uniqueTitles = [...new Set(titlePool)]
  const rssKeywords = uniqueTitles.sort(() => Math.random() - 0.5).slice(0, MAX_FROM_RSS)

  // ── 2. 내부 데이터 기반 키워드 추가 ──────────────────────────────────────
  const internalKeywords = await fetchInternalKeywords(admin)
  const internalPicks = internalKeywords.slice(0, MAX_FROM_INTERNAL)

  const allKeywords = [...rssKeywords, ...internalPicks]
  console.log(`[collect-hallyu-feed] 생성 대상 키워드: ${allKeywords.length}개`)

  if (allKeywords.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, message: "키워드 없음" })
  }

  // ── 3. 각 키워드로 독자 콘텐츠 생성 → DB insert ──────────────────────────
  let inserted = 0

  for (let i = 0; i < allKeywords.length; i++) {
    const keyword = allKeywords[i]
    const gen = await generateContent(keyword)
    if (!gen?.title) continue

    const slug = `${Date.now()}-${i}`
    const { error } = await admin.from("hallyu_news").insert({
      source:         "unfoldk",
      title:          gen.title,
      url:            makeGeneratedUrl(slug),
      thumbnail_url:  null,
      image_url:      null,
      published_at:   new Date().toISOString(),
      category:       gen.category,
      content_type:   "generated",
      sources:        ["Curated by UnfoldK"],
      summary:        JSON.stringify({ p1: gen.paragraph1, p2: gen.paragraph2, p3: gen.paragraph3 }),
      related_artist: gen.related_artist || null,
    })

    if (!error) {
      inserted++
      console.log(`[collect-hallyu-feed] 생성 완료 [${i + 1}/${allKeywords.length}]: "${gen.title.slice(0, 50)}…"`)
    } else {
      console.error(`[collect-hallyu-feed] insert 실패:`, error.code, error.message)
    }
  }

  // ── 4. 7일 이상 된 콘텐츠 자동 삭제 ─────────────────────────────────────
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count: deletedCount } = await admin
    .from("hallyu_news")
    .delete({ count: "exact" })
    .lt("published_at", cutoff)

  console.log(`[collect-hallyu-feed] 완료 — 생성 ${inserted}건, 삭제 ${deletedCount ?? 0}건`)

  return NextResponse.json({ ok: true, inserted, deleted: deletedCount ?? 0 })
}
