import { NextResponse } from "next/server"
import { XMLParser } from "fast-xml-parser"
import { verifyCronAuth } from "@/lib/cron/auth"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// Hallyu News RSS 수집 — Koreaboo / Seoulbeats / Soompi 매일 01:00 UTC
// 7일 이상 된 뉴스 자동 삭제
export const maxDuration = 60
export const dynamic = "force-dynamic"

const FEEDS = [
  { source: "koreaboo",   url: "https://www.koreaboo.com/feed/" },
  { source: "seoulbeats", url: "https://seoulbeats.com/feed" },
  { source: "soompi",     url: "https://www.soompi.com/feed" },
] as const

// 제목 기반 카테고리 자동 분류 (순서대로 검사 — 먼저 매칭된 쪽 우선)
function classifyCategory(title: string): "kdrama" | "kbeauty" | "kpop" | "general" {
  const t = title.toLowerCase()
  if (/drama|series|episode/.test(t)) return "kdrama"
  if (/beauty|skincare|makeup/.test(t)) return "kbeauty"
  if (/\bmv\b|comeback|album|concert/.test(t)) return "kpop"
  return "general"
}

// RSS item 에서 썸네일 URL 추출
// 시도 순서: media:content → media:thumbnail → enclosure → content:encoded img 태그
function extractThumbnail(item: Record<string, unknown>): string | null {
  // media:content
  const mc = item["media:content"] as Record<string, unknown> | Record<string, unknown>[] | undefined
  if (mc) {
    const first = Array.isArray(mc) ? mc[0] : mc
    const url = (first as Record<string, unknown>)?.["@_url"]
    if (typeof url === "string" && url) return url
  }
  // media:thumbnail
  const mt = item["media:thumbnail"] as Record<string, unknown> | undefined
  if (mt) {
    const url = mt["@_url"]
    if (typeof url === "string" && url) return url
  }
  // enclosure
  const enc = item["enclosure"] as Record<string, unknown> | undefined
  if (enc) {
    const url = enc["@_url"]
    if (typeof url === "string" && url) return url
  }
  // content:encoded — WordPress 기반 사이트 (seoulbeats 등)에서 첫 번째 img src 추출
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

// RSS XML → 파싱된 item 배열
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

export async function GET(request: Request) {
  // CRON_SECRET 인증 우선, 어드민 세션 폴백
  const cronAuth = verifyCronAuth(request)
  if (!cronAuth.ok) {
    const adminAuth = await requireAdmin()
    if (!adminAuth.ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  const admin = createSupabaseAdminClient()
  const summary: Record<string, { processed: number; inserted: number; error?: string }> = {}
  let totalInserted = 0

  for (const feed of FEEDS) {
    try {
      const items = await fetchRssFeed(feed.url)
      console.log(`[collect-hallyu-news] ${feed.source}: ${items.length}개 항목 파싱`)

      const rows = items.map((item) => {
        // link — CDATA 또는 직접 문자열
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
        const published_at = pubDate ? new Date(pubDate).toISOString() : null

        return {
          source: feed.source,
          title: title.trim(),
          url: link.trim(),
          thumbnail_url: extractThumbnail(item),
          published_at,
          category: classifyCategory(title),
        }
      }).filter((r) => r.url && r.title)

      if (rows.length === 0) {
        console.log(`[collect-hallyu-news] ${feed.source}: 유효 row 없음`)
        summary[feed.source] = { processed: 0, inserted: 0 }
        continue
      }

      // ignoreDuplicates: true → ON CONFLICT DO NOTHING → 신규 행만 data 에 반환
      const { data, error } = await admin
        .from("hallyu_news")
        .upsert(rows, { onConflict: "url", ignoreDuplicates: true })
        .select("id")

      if (error) {
        console.error(`[collect-hallyu-news] ${feed.source} upsert 실패:`, error.code, error.message)
        summary[feed.source] = { processed: rows.length, inserted: 0, error: `${error.code}: ${error.message}` }
      } else {
        const inserted = data?.length ?? 0
        summary[feed.source] = { processed: rows.length, inserted }
        totalInserted += inserted
        console.log(`[collect-hallyu-news] ${feed.source}: ${rows.length}개 처리, ${inserted}건 신규 저장`)
      }
    } catch (err) {
      console.error(`[collect-hallyu-news] ${feed.source} 수집 실패:`, err)
      summary[feed.source] = { processed: 0, inserted: 0, error: String(err) }
    }
  }

  // 7일 이상 된 뉴스 자동 삭제
  const { error: delErr } = await admin
    .from("hallyu_news")
    .delete()
    .lt("published_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
  if (delErr) {
    console.error("[collect-hallyu-news] 7일 이상 삭제 실패:", delErr.message)
  } else {
    console.log("[collect-hallyu-news] 7일 이상 뉴스 삭제 완료")
  }

  return NextResponse.json({ ok: true, total_inserted: totalInserted, summary })
}
