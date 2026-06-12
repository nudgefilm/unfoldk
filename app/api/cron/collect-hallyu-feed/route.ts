import { NextResponse } from "next/server"
import { XMLParser } from "fast-xml-parser"
import Anthropic from "@anthropic-ai/sdk"
import { verifyCronAuth } from "@/lib/cron/auth"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// Hallyu Feed RSS 수집 + Claude Sonnet 4.6 AI 큐레이션 — 하루 4회 (01/07/13/19 UTC)
// 흐름: RSS 파싱 → 신규 URL 필터 → Sonnet 즉시 요약 → summary 포함 insert (1회 완료)
// content_type: 'rss' (원문 기반) | 'generated' (UnfoldK 자체 생성)
export const maxDuration = 300
export const dynamic = "force-dynamic"

const FEEDS = [
  { source: "koreaboo",   url: "https://www.koreaboo.com/feed/" },
  { source: "seoulbeats", url: "https://seoulbeats.com/feed" },
  { source: "soompi",     url: "https://www.soompi.com/feed" },
] as const

const CLAUDE_MAX_PER_RUN = 5    // 1회 수집 시 Sonnet 최대 처리 건수 (타임아웃 방지)
const FETCH_TIMEOUT_MS   = 8000
const GENERATED_RATIO    = 0.3  // 신규 기사 건수의 30% 비중으로 generated 생성

const anthropic = new Anthropic()

// ── 카테고리 분류 ────────────────────────────────────────────────────────────
function classifyCategory(title: string): "kdrama" | "kbeauty" | "kpop" | "general" {
  const t = title.toLowerCase()
  if (/drama|series|episode/.test(t)) return "kdrama"
  if (/beauty|skincare|makeup/.test(t)) return "kbeauty"
  if (/\bmv\b|comeback|album|concert/.test(t)) return "kpop"
  return "general"
}

// ── RSS item 썸네일 추출 ──────────────────────────────────────────────────────
function extractRssThumbnail(item: Record<string, unknown>): string | null {
  const mc = item["media:content"] as Record<string, unknown> | Record<string, unknown>[] | undefined
  if (mc) {
    const first = Array.isArray(mc) ? mc[0] : mc
    const url = (first as Record<string, unknown>)?.["@_url"]
    if (typeof url === "string" && url) return url
  }
  const mt = item["media:thumbnail"] as Record<string, unknown> | undefined
  if (mt?.["@_url"] && typeof mt["@_url"] === "string") return mt["@_url"]
  const enc = item["enclosure"] as Record<string, unknown> | undefined
  if (enc?.["@_url"] && typeof enc["@_url"] === "string") return enc["@_url"]
  const ce = item["content:encoded"]
  if (ce) {
    const html =
      typeof ce === "object" && ce !== null
        ? String((ce as Record<string, unknown>)["__cdata"] ?? "")
        : String(ce ?? "")
    const match = html.match(/<img[^>]+src=["']([^"']+)["']/)
    if (match?.[1]) return match[1]
  }
  return null
}

// ── 원문 기사 fetch → og:image + 본문 텍스트 ─────────────────────────────────
async function fetchArticleContent(url: string): Promise<{ image: string | null; text: string }> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(url, {
      headers: { "User-Agent": "UnfoldK News Bot/1.0" },
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer))

    if (!res.ok) return { image: null, text: "" }
    const html = await res.text()

    const ogMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)

    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 3000)

    return { image: ogMatch?.[1] ?? null, text }
  } catch {
    return { image: null, text: "" }
  }
}

// ── YouTube 썸네일 fallback ──────────────────────────────────────────────────
async function findYoutubeThumbnail(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  artist: string
): Promise<string | null> {
  const { data } = await admin
    .from("youtube_videos")
    .select("thumbnail_url")
    .eq("status", "published")
    .ilike("title", `%${artist}%`)
    .limit(1)
    .single()
  return (data as { thumbnail_url?: string } | null)?.thumbnail_url ?? null
}

// ── Claude Sonnet 4.6: RSS 기사 요약 ─────────────────────────────────────────
const RSS_SYSTEM = `You are a K-culture news curator for UnfoldK (unfoldk.com), a platform for global Hallyu fans. Write in engaging English for international K-pop and K-drama fans.
Only write factual information. Do not fabricate quotes or events.`

interface RssAiResult {
  paragraph1: string
  paragraph2: string
  paragraph3: string
  related_artist: string
  category: "kpop" | "kdrama" | "kbeauty" | "general"
}

async function generateRssSummary(title: string, content: string): Promise<RssAiResult | null> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      system: [{ type: "text", text: RSS_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{
        role: "user",
        content: `Based on this article, create a news summary with 3 paragraphs:

Paragraph 1: Core summary of the article (rewrite completely, do not copy original text, max 100 words)
Paragraph 2: Recent trends related to the artist/topic mentioned (use general K-pop industry knowledge, max 80 words)
Paragraph 3: Global fan community context or industry implications (max 80 words)

Also extract:
- Main artist or topic name (for related_artist field)
- Category: one of [kpop, kdrama, kbeauty, general]

Article title: ${title}
Article content: ${content || "(no content available, use title only)"}

Respond ONLY in JSON:
{
  "paragraph1": "...",
  "paragraph2": "...",
  "paragraph3": "...",
  "related_artist": "...",
  "category": "..."
}`,
      }],
    })
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")
    if (!textBlock) return null
    const raw = textBlock.text.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "")
    return JSON.parse(raw) as RssAiResult
  } catch (err) {
    console.error("[collect-hallyu-feed] Sonnet 요약 실패:", err instanceof Error ? err.message : String(err))
    return null
  }
}

// ── Claude Sonnet 4.6: generated 자체 콘텐츠 생성 ────────────────────────────
const GEN_SYSTEM = `You are a K-culture content writer for UnfoldK (unfoldk.com). Write original, engaging content for global Hallyu fans.
Only write factual, well-known information about K-pop and K-drama. Do not fabricate quotes, events, or statistics.`

interface GenAiResult {
  title: string
  paragraph1: string
  paragraph2: string
  paragraph3: string
  related_artist: string
  category: "kpop" | "kdrama" | "kbeauty" | "general"
}

async function generateOriginalContent(keyword: string): Promise<GenAiResult | null> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: [{ type: "text", text: GEN_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{
        role: "user",
        content: `Write an original K-culture article based on this topic/artist: ${keyword}

Structure:
Paragraph 1: Introduction and background (max 100 words)
Paragraph 2: Recent activities and trends (max 80 words)
Paragraph 3: Global fan community impact (max 80 words)

Generate a compelling headline for this article.
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
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")
    if (!textBlock) return null
    const raw = textBlock.text.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "")
    return JSON.parse(raw) as GenAiResult
  } catch (err) {
    console.error("[collect-hallyu-feed] Sonnet generated 실패:", err instanceof Error ? err.message : String(err))
    return null
  }
}

// ── RSS XML 파싱 ─────────────────────────────────────────────────────────────
interface RssItem {
  source: string
  title: string
  url: string
  thumbnail_url: string | null
  published_at: string | null
  srcLabel: string
  dateLabel: string
}

async function fetchRssFeed(feedUrl: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(feedUrl, {
    headers: { "User-Agent": "UnfoldK News Bot/1.0" },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`RSS fetch 실패 (${feedUrl}): ${res.status}`)
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
  return items.filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
}

function formatSourceDate(isoOrRfc: string | null | undefined): string {
  if (!isoOrRfc) return ""
  try {
    return new Date(isoOrRfc).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    })
  } catch { return "" }
}

// ── 메인 핸들러 ──────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const cronAuth = verifyCronAuth(request)
  if (!cronAuth.ok) {
    const adminAuth = await requireAdmin()
    if (!adminAuth.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const admin = createSupabaseAdminClient()
  const feedSummary: Record<string, { parsed: number; new: number; error?: string }> = {}

  // ── 1. 전체 피드 파싱 → 후보 아이템 수집 ─────────────────────────────────
  const candidates: RssItem[] = []

  for (const feed of FEEDS) {
    try {
      const items = await fetchRssFeed(feed.url)
      const srcLabel = feed.source.charAt(0).toUpperCase() + feed.source.slice(1)
      let parsed = 0

      for (const item of items) {
        const rawLink = item["link"]
        const link =
          typeof rawLink === "object" && rawLink !== null
            ? String((rawLink as Record<string, unknown>)["__cdata"] ?? "")
            : String(rawLink ?? "")
        const title =
          typeof item["title"] === "object"
            ? String((item["title"] as Record<string, unknown>)["__cdata"] ?? "")
            : String(item["title"] ?? "")
        const pubDate = item["pubDate"] as string | undefined
        const url = link.trim()
        const titleTrimmed = title.trim()

        if (!url || !titleTrimmed) continue

        candidates.push({
          source: feed.source,
          title: titleTrimmed,
          url,
          thumbnail_url: extractRssThumbnail(item),
          published_at: pubDate ? new Date(pubDate).toISOString() : null,
          srcLabel,
          dateLabel: formatSourceDate(pubDate),
        })
        parsed++
      }

      feedSummary[feed.source] = { parsed, new: 0 }
      console.log(`[collect-hallyu-feed] ${feed.source}: ${parsed}개 파싱`)
    } catch (err) {
      console.error(`[collect-hallyu-feed] ${feed.source} 수집 실패:`, err)
      feedSummary[feed.source] = { parsed: 0, new: 0, error: String(err) }
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, total_inserted: 0, gen_inserted: 0, feed_summary: feedSummary })
  }

  // ── 2. 신규 URL 필터 (기존 DB에 없는 것만) ───────────────────────────────
  const allUrls = candidates.map((c) => c.url)
  const { data: existing } = await admin
    .from("hallyu_news")
    .select("url")
    .in("url", allUrls)
  const existingSet = new Set((existing ?? []).map((r: { url: string }) => r.url))
  const newItems = candidates.filter((c) => !existingSet.has(c.url)).slice(0, CLAUDE_MAX_PER_RUN)

  console.log(`[collect-hallyu-feed] 신규 처리 대상: ${newItems.length}건 / 전체 후보: ${candidates.length}건`)

  if (newItems.length === 0) {
    return NextResponse.json({ ok: true, total_inserted: 0, gen_inserted: 0, feed_summary: feedSummary })
  }

  // ── 3. 신규 기사 원문 fetch + Sonnet 즉시 요약 → 완성된 row 생성 ──────────
  const collectedArtists: string[] = []
  const rows: Record<string, unknown>[] = []

  for (const item of newItems) {
    const { image: ogImage, text: articleText } = await fetchArticleContent(item.url)
    const ai = await generateRssSummary(item.title, articleText)

    if (ai?.related_artist) collectedArtists.push(ai.related_artist)

    // 이미지: og:image → YouTube 썸네일 → null
    let imageUrl: string | null = ogImage
    if (!imageUrl && ai?.related_artist) {
      imageUrl = await findYoutubeThumbnail(admin, ai.related_artist)
    }

    const sourcesArr = item.dateLabel
      ? [`${item.srcLabel} · ${item.dateLabel}`]
      : [item.srcLabel]

    rows.push({
      source: item.source,
      title: item.title,
      url: item.url,
      thumbnail_url: item.thumbnail_url,
      image_url: imageUrl,
      published_at: item.published_at,
      content_type: "rss",
      sources: sourcesArr,
      category: ai?.category ?? classifyCategory(item.title),
      related_artist: ai?.related_artist ?? null,
      summary: ai
        ? JSON.stringify({ p1: ai.paragraph1, p2: ai.paragraph2, p3: ai.paragraph3 })
        : null,
    })

    feedSummary[item.source].new++
    console.log(`[collect-hallyu-feed] 처리 완료: "${item.title.slice(0, 40)}…"`)
  }

  // ── 4. 완성된 row 일괄 insert ─────────────────────────────────────────────
  const { error: insertErr } = await admin
    .from("hallyu_news")
    .insert(rows)

  if (insertErr) {
    console.error("[collect-hallyu-feed] insert 실패:", insertErr.code, insertErr.message)
    return NextResponse.json({
      ok: false,
      error: `${insertErr.code}: ${insertErr.message}`,
      feed_summary: feedSummary,
    }, { status: 500 })
  }

  const totalInserted = rows.length

  // ── 5. Generated 자체 콘텐츠 생성 (신규 기사 × 30%) ─────────────────────
  const genCount = Math.max(1, Math.round(totalInserted * GENERATED_RATIO))
  const keywords = collectedArtists.length > 0
    ? collectedArtists.slice(0, genCount)
    : ["K-pop trends", "K-drama spotlight", "Hallyu global reach"].slice(0, genCount)

  let genInserted = 0
  for (const keyword of keywords) {
    const gen = await generateOriginalContent(keyword)
    if (!gen?.title) continue

    const imageUrl = await findYoutubeThumbnail(admin, gen.related_artist || keyword)

    const { error: genErr } = await admin.from("hallyu_news").insert({
      source: "unfoldk",
      title: gen.title,
      url: `https://unfoldk.com/hallyu-feed/gen-${Date.now()}-${genInserted}`,
      thumbnail_url: null,
      image_url: imageUrl,
      published_at: new Date().toISOString(),
      category: gen.category,
      content_type: "generated",
      sources: ["Curated by UnfoldK"],
      summary: JSON.stringify({ p1: gen.paragraph1, p2: gen.paragraph2, p3: gen.paragraph3 }),
      related_artist: gen.related_artist || null,
    })

    if (!genErr) {
      genInserted++
      console.log(`[collect-hallyu-feed] Generated 생성: "${gen.title.slice(0, 40)}…"`)
    }
  }

  // ── 6. 7일 이상 된 뉴스 자동 삭제 ────────────────────────────────────────
  await admin
    .from("hallyu_news")
    .delete()
    .lt("published_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

  return NextResponse.json({
    ok: true,
    total_inserted: totalInserted,
    gen_inserted: genInserted,
    feed_summary: feedSummary,
  })
}
