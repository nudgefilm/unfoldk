"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { FooterSection } from "@/components/footer-section"

interface SummaryJson { p1: string; p2: string; p3: string }

interface NewsDetail {
  id: string
  title: string
  published_at: string | null
  category: string | null
  summary: string | null
  related_artist: string | null
  related_link: { href: string; label: string } | null
}

const CATEGORY_BADGE: Record<string, string> = {
  kpop:    "bg-purple-500/20 text-purple-300",
  kdrama:  "bg-blue-500/20 text-blue-300",
  kbeauty: "bg-pink-500/20 text-pink-300",
  general: "bg-zinc-500/20 text-zinc-300",
}
const CATEGORY_LABEL: Record<string, string> = {
  kpop: "K-Pop", kdrama: "K-Drama", kbeauty: "K-Beauty", general: "General",
}

function formatDate(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  })
}

function parseSummary(raw: string | null): SummaryJson | null {
  if (!raw) return null
  try { return JSON.parse(raw) as SummaryJson } catch { return null }
}

function decodeHtml(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
}

export default function HallyuFeedDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [news, setNews] = useState<NewsDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    fetch(`/api/hallyu-feed/${id}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((b: { news: NewsDetail }) => setNews(b.news))
      .catch(() => router.replace("/hallyu-feed"))
      .finally(() => setLoading(false))
  }, [id, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#FF4B6E] border-t-transparent animate-spin" />
      </div>
    )
  }
  if (!news) return null

  const summary = parseSummary(news.summary)

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-foreground">
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        {/* 뒤로가기 */}
        <Link
          href="/hallyu-feed"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Hallyu Feed
        </Link>

        {/* 카테고리 + 출처 배지 + 날짜 */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {news.category && (
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${CATEGORY_BADGE[news.category] ?? CATEGORY_BADGE.general}`}>
              {CATEGORY_LABEL[news.category] ?? news.category}
            </span>
          )}
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: "#FF4B6E" }}>
            Curated by UnfoldK
          </span>
          <span className="text-muted-foreground text-xs">{formatDate(news.published_at)}</span>
        </div>

        {/* 헤드라인 */}
        <h1 className="text-foreground text-2xl sm:text-3xl font-bold leading-snug mb-8">
          {decodeHtml(news.title)}
        </h1>

        {/* 본문 */}
        <div className="space-y-5 text-foreground/90 text-base leading-relaxed">
          {summary ? (
            <>
              <p>{decodeHtml(summary.p1)}</p>
              <p>{decodeHtml(summary.p2)}</p>
              <p>{decodeHtml(summary.p3)}</p>
            </>
          ) : (
            <p className="text-muted-foreground italic">Content is being prepared.</p>
          )}
        </div>

        {/* 관련 링크 (category 기반 해석, 매칭 실패 시 미노출) */}
        {news.related_link && (
          <div className="mt-8 pt-6 border-t border-border/20">
            <Link
              href={news.related_link.href}
              className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: "#FF4B6E" }}
            >
              {news.related_link.label}
            </Link>
          </div>
        )}

        {/* 출처 */}
        <div className="mt-8 pt-6 border-t border-border/20">
          <p className="text-muted-foreground text-xs">Curated by UnfoldK</p>
        </div>
      </main>

      <FooterSection />
    </div>
  )
}
