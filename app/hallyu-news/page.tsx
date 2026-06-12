"use client"

import { useEffect, useState, useCallback } from "react"
import { Newspaper, ChevronLeft, ChevronRight } from "lucide-react"
import { FooterSection } from "@/components/footer-section"
import { HallyuPassBanner } from "@/components/hallyu-pass-banner"
import { NewsCard, type NewsCardProps } from "@/components/hallyu-news/news-card"

type NewsItem = NewsCardProps

const CATEGORY_TABS = [
  { key: "",         label: "All" },
  { key: "kpop",    label: "K-pop" },
  { key: "kdrama",  label: "K-drama" },
  { key: "kbeauty", label: "K-beauty" },
  { key: "general", label: "General" },
] as const

const LIMIT = 18

export default function HallyuNewsPage() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState("")
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)

  const fetchNews = useCallback(async (cat: string, pg: number) => {
    setLoading(true)
    const qs = new URLSearchParams({ limit: String(LIMIT), offset: String(pg * LIMIT) })
    if (cat) qs.set("category", cat)
    try {
      const res = await fetch(`/api/hallyu-news?${qs}`)
      if (!res.ok) return
      const body = await res.json() as { news: NewsItem[] }
      setNews(body.news ?? [])
      setHasMore((body.news ?? []).length === LIMIT)
      if (pg === 0) {
        const cqs = new URLSearchParams({ count_only: "true" })
        if (cat) cqs.set("category", cat)
        fetch(`/api/hallyu-news?${cqs}`)
          .then((r) => r.json())
          .then((b: { count: number }) => setTotal(b.count ?? 0))
          .catch(() => {})
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setPage(0)
    fetchNews(category, 0)
  }, [category, fetchNews])

  function goPage(p: number) {
    setPage(p)
    fetchNews(category, p)
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
          The latest K-pop, K-drama &amp; K-beauty headlines — curated by UnfoldK.
        </p>
        {total > 0 && (
          <p className="text-muted-foreground text-sm mt-3">{total.toLocaleString()} articles</p>
        )}
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* 카테고리 탭 */}
        <div className="flex gap-2 flex-wrap mb-8">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setCategory(tab.key)}
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

        {/* Masonry 그리드 */}
        {loading ? (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="break-inside-avoid mb-4 bg-[#1a1a1a] border border-border/30 rounded-2xl overflow-hidden animate-pulse">
                <div className="h-40 bg-[#252528]" />
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
            <p className="text-muted-foreground text-sm">News is collected daily. Check back soon!</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
            {news.map((item) => (
              <div key={item.id} className="break-inside-avoid mb-4">
                <NewsCard {...item} />
              </div>
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
            <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
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
