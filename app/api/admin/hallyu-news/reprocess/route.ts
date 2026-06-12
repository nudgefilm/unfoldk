import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const REPROCESS_LIMIT = 20
const FETCH_TIMEOUT_MS = 8000

const anthropic = new Anthropic()

const SYSTEM_PROMPT = `You are a K-culture news curator for UnfoldK (unfoldk.com), a platform for global Hallyu fans. Write in engaging English for international K-pop and K-drama fans.
Only write factual information. Do not fabricate quotes or events.`

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

interface AiResult {
  paragraph1: string
  paragraph2: string
  paragraph3: string
  related_artist: string
  category: "kpop" | "kdrama" | "kbeauty" | "general"
}

async function generateAiSummary(title: string, content: string): Promise<AiResult | null> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
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
    return JSON.parse(raw) as AiResult
  } catch (err) {
    console.error("[reprocess] Claude 호출 실패:", err instanceof Error ? err.message : String(err))
    return null
  }
}

function classifyCategory(title: string): "kdrama" | "kbeauty" | "kpop" | "general" {
  const t = title.toLowerCase()
  if (/drama|series|episode/.test(t)) return "kdrama"
  if (/beauty|skincare|makeup/.test(t)) return "kbeauty"
  if (/\bmv\b|comeback|album|concert/.test(t)) return "kpop"
  return "general"
}

function formatSourceDate(isoOrRfc: string | null | undefined): string {
  if (!isoOrRfc) return ""
  try {
    return new Date(isoOrRfc).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    })
  } catch { return "" }
}

export async function POST() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const admin = createSupabaseAdminClient()

  const { data: unprocessed } = await admin
    .from("hallyu_news")
    .select("id, title, url, source, published_at")
    .eq("content_type", "rss")
    .is("summary", null)
    .order("published_at", { ascending: false })
    .limit(REPROCESS_LIMIT)

  const toProcess = unprocessed ?? []
  let processed = 0

  for (const row of toProcess) {
    const { image: ogImage, text: articleText } = await fetchArticleContent(row.url as string)
    const ai = await generateAiSummary(row.title as string, articleText)

    let imageUrl: string | null = ogImage
    if (!imageUrl && ai?.related_artist) {
      const { data: vid } = await admin
        .from("youtube_videos")
        .select("thumbnail_url")
        .eq("status", "published")
        .ilike("title", `%${ai.related_artist}%`)
        .limit(1)
        .single()
      imageUrl = (vid as { thumbnail_url?: string } | null)?.thumbnail_url ?? null
    }

    const srcLabel =
      (row.source as string).charAt(0).toUpperCase() + (row.source as string).slice(1)
    const dateLabel = formatSourceDate(row.published_at as string)
    const sourcesArr = dateLabel ? [`${srcLabel} · ${dateLabel}`] : [srcLabel]

    await admin.from("hallyu_news").update({
      image_url: imageUrl,
      sources: sourcesArr,
      summary: ai
        ? JSON.stringify({ p1: ai.paragraph1, p2: ai.paragraph2, p3: ai.paragraph3 })
        : null,
      related_artist: ai?.related_artist ?? null,
      category: ai?.category ?? classifyCategory(row.title as string),
    }).eq("id", row.id)

    processed++
  }

  return NextResponse.json({ ok: true, processed, total: toProcess.length })
}
