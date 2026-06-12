"use client"

import { useEffect, useState, useCallback } from "react"
import { Newspaper, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react"
import { FooterSection } from "@/components/footer-section"
import { HallyuPassBanner } from "@/components/hallyu-pass-banner"

interface NewsItem {
  id: string
  source: string
  title: string
  url: string
  thumbnail_url: string | null
  published_at: string | null
  category: string | null
}

const CATEGORY_TABS = [
  { key: "",        label: "All" },
  { key: "kpop",   label: "K-pop" },
  { key: "kdrama", label: "K-drama" },
  { key: "kbeauty",label: "K-beauty" },
  { key: "general",label: "General" },
] as const

const SOURCE_FILTERS = [
  { key: "",            label: "All Sources" },
  { key: "koreaboo",   label: "Koreaboo" },
  { key: "seoulbeats", label: "Seoulbeats" },
  { key: "soompi",     label: "Soompi" },
] as const

const CATEGORY_BADGE: Record<string, string> = {
  kpop:    "bg-purple-500/20 text-purple-300",
  kdrama:  "bg-blue-500/20 text-blue-300",
  kbeauty: "bg-pink-500/20 text-pink-300",
  general: "bg-zinc-500/20 text-zinc-300",
}

const LIMIT = 18

function formatDate(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function sourceLabel(src: string): string {
  const map: Record<string, string> = {
    koreaboo:   "Koreaboo",
    seoulbeats: "Seoulbeats",
    soompi:     "Soompi",
  }
  return map[src] ?? src
}

// PLACEHOLDER_URL — 출처별 기본 이미지
const SOURCE_PLACEHOLDER: Record<string, string> = {
  koreaboo:   "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=60",
  seoulbeats: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400&q=60",
  soompi:     "https://images.unsplash.com/photo-1519671845340-8e30b9ed4ce1?w=400&q=60",
}

export default function HallyuNewsPage() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState("")
  const [source, setSource] = useState("")
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)

  const fetchNews = useCallback(
    async (cat: string, src: string, pg: number) => {
      setLoading(true)
      const qs = new URLSearchParams({ limit: String(LIMIT), offset: String(pg * LIMIT) })
      if (cat) qs.set("category", cat)
      if (src) qs.set("source", src)
      try {
        const res = await fetch(`/api/hallyu-news?${qs}`)
        if (!res.ok) return
        const body = await res.json() as { news: NewsItem[]; limit: number; offset: number }
        setNews(body.news ?? [])
        setHasMore((body.news ?? []).length === LIMIT)
        if (pg === 0) {
          // 총 건수 별도 fetch
          const cqs = new URLSearchParams({ count_only: "true" })
          if (cat) cqs.set("category", cat)
          if (src) cqs.set("source", src)
          fetch(`/api/hallyu-news?${cqs}`)
            .then((r) => r.json())
            .then((b: { count: number }) => setTotal(b.count ?? 0))
            .catch(() => {})
        }
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    setPage(0)
    fetchNews(category, source, 0)
  }, [category, source, fetchNews])

  function handleFilter(cat: string, src: string) {
    setCategory(cat)
    setSource(src)
  }

  function goPage(p: number) {
    setPage(p)
    fetchNews(category, source, p)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-foreground">
      {/* 히어로 */}
      <section className="text-center py-16 px-4 border-b border-border/20">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Newspaper className="w-7 h-7" style={{ color: "#FF4B6E" }} />
          <h1 className="text-4xl font-bold text-foreground">Hallyu News</h1>
        </div>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          The latest K-pop, K-drama &amp; K-beauty headlines — curated from top Hallyu sources.
        </p>
        {total > 0 && (
          <p className="text-muted-foreground text-sm mt-3">{total.toLocaleString()} articles</p>
        )}
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* 카테고리 탭 */}
        <div className="flex gap-2 flex-wrap mb-4">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleFilter(tab.key, source)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                category === tab.key
                  ? "text-white border-[#FF4B6E]"
                  : "border-border/40 text-muted-foreground hover:text-foreground"
              }`}
              style={category === tab.key ? { backgroundColor: "#FF4B6E" } : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 출처 필터 */}
        <div className="flex gap-2 flex-wrap mb-8">
          {SOURCE_FILTERS.map((sf) => (
            <button
              key={sf.key}
              type="button"
              onClick={() => handleFilter(category, sf.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                source === sf.key
                  ? "border-border/70 text-foreground bg-[#1a1a1a]"
                  : "border-border/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              {sf.label}
            </button>
          ))}
        </div>

        {/* 뉴스 그리드 */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-[#1a1a1a] border border-border/30 rounded-2xl overflow-hidden animate-pulse">
                <div className="aspect-video bg-[#252528]" />
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-[#252528] rounded w-1/3" />
                  <div className="h-4 bg-[#252528] rounded w-full" />
                  <div className="h-4 bg-[#252528] rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : news.length === 0 ? (
          <div className="text-center py-20">
            <Newspaper className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-foreground font-medium mb-1">No news yet</p>
            <p className="text-muted-foreground text-sm">
              News is collected daily. Check back soon!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {news.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-[#1a1a1a] border border-border/30 rounded-2xl overflow-hidden hover:border-[#FF4B6E]/40 transition-all hover:shadow-[0_0_0_1px_rgba(255,75,110,0.15)] flex flex-col"
              >
                {/* 썸네일 */}
                <div className="relative aspect-video bg-[#141418] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.thumbnail_url ?? SOURCE_PLACEHOLDER[item.source] ?? SOURCE_PLACEHOLDER.koreaboo}
                    alt={item.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    onError={(e) => {
                      const img = e.currentTarget
                      const fallback = SOURCE_PLACEHOLDER[item.source] ?? SOURCE_PLACEHOLDER.koreaboo
                      if (img.src !== fallback) img.src = fallback
                    }}
                  />
                  {/* ExternalLink 오버레이 */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ExternalLink className="w-6 h-6 text-white" />
                  </div>
                </div>

                {/* 콘텐츠 */}
                <div className="p-4 flex flex-col gap-2 flex-1">
                  {/* 카테고리 배지 */}
                  {item.category && (
                    <span className={`self-start text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${CATEGORY_BADGE[item.category] ?? CATEGORY_BADGE.general}`}>
                      {item.category === "kdrama" ? "K-Drama" : item.category === "kbeauty" ? "K-Beauty" : item.category === "kpop" ? "K-Pop" : "General"}
                    </span>
                  )}

                  {/* 제목 */}
                  <p className="text-foreground text-sm font-semibold leading-snug line-clamp-3 flex-1 group-hover:text-[#FF4B6E] transition-colors">
                    {item.title}
                  </p>

                  {/* 출처 + 날짜 */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-2 border-t border-border/20">
                    <span className="font-medium">{sourceLabel(item.source)}</span>
                    <span>{formatDate(item.published_at)}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-10">
            <button
              type="button"
              onClick={() => goPage(page - 1)}
              disabled={page <= 0}
              className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors ${
                page > 0
                  ? "border-border/50 text-foreground hover:bg-secondary/50"
                  : "border-border/20 text-muted-foreground/30 cursor-not-allowed"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => goPage(page + 1)}
              disabled={!hasMore}
              className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors ${
                hasMore
                  ? "border-border/50 text-foreground hover:bg-secondary/50"
                  : "border-border/20 text-muted-foreground/30 cursor-not-allowed"
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>

      <HallyuPassBanner isPro={false} />
      <FooterSection />
    </div>
  )
}
