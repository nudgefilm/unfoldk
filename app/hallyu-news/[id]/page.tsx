"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, ExternalLink } from "lucide-react"
import Link from "next/link"
import { FooterSection } from "@/components/footer-section"

interface SummaryJson { p1: string; p2: string; p3: string }

interface NewsDetail {
  id: string
  source: string
  title: string
  url: string
  thumbnail_url: string | null
  image_url: string | null
  published_at: string | null
  category: string | null
  summary: string | null
  related_artist: string | null
  sources: string[] | null
  content_type: string | null
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

export default function HallyuNewsDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [news, setNews] = useState<NewsDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    if (!id) return
    fetch(`/api/hallyu-news/${id}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((b: { news: NewsDetail }) => setNews(b.news))
      .catch(() => router.replace("/hallyu-news"))
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
  const heroImage = (!imgError && (news.image_url ?? news.thumbnail_url)) || null
  const isGenerated = news.content_type === "generated"

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-foreground">
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        {/* 뒤로가기 */}
        <Link
          href="/hallyu-news"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Hallyu News
        </Link>

        {/* 카테고리 + generated 배지 + 날짜 */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {news.category && (
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${CATEGORY_BADGE[news.category] ?? CATEGORY_BADGE.general}`}>
              {CATEGORY_LABEL[news.category] ?? news.category}
            </span>
          )}
          {isGenerated && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: "#FF4B6E" }}>
              Curated by UnfoldK
            </span>
          )}
          <span className="text-muted-foreground text-xs">{formatDate(news.published_at)}</span>
        </div>

        {/* 헤드라인 */}
        <h1 className="text-foreground text-2xl sm:text-3xl font-bold leading-snug mb-6">
          {news.title}
        </h1>

        {/* 히어로 이미지 */}
        {heroImage && (
          <div className="rounded-2xl overflow-hidden mb-8 bg-[#141418]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImage}
              alt={news.title}
              className="w-full object-cover max-h-96"
              onError={() => setImgError(true)}
            />
          </div>
        )}

        {/* 본문 */}
        <div className="space-y-5 text-foreground/90 text-base leading-relaxed">
          {summary ? (
            <>
              <p>{summary.p1}</p>
              <p>{summary.p2}</p>
              <p>{summary.p3}</p>
            </>
          ) : (
            <p className="text-muted-foreground italic">
              Full article available at the original source.
            </p>
          )}
        </div>

        {/* 관련 아티스트 링크 */}
        {news.related_artist && (
          <div className="mt-8 pt-6 border-t border-border/20">
            <Link
              href="/kpop"
              className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: "#FF4B6E" }}
            >
              View {news.related_artist} stats →
            </Link>
          </div>
        )}

        {/* 출처 + 원문 링크 */}
        <div className="mt-8 pt-6 border-t border-border/20 flex items-start justify-between gap-4 flex-wrap">
          <p className="text-muted-foreground text-xs">
            {news.sources?.length
              ? `Sources: ${news.sources.join(" · ")}`
              : news.source.charAt(0).toUpperCase() + news.source.slice(1)}
          </p>
          {!isGenerated && (
            <a
              href={news.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Read original <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </main>

      <FooterSection />
    </div>
  )
}
