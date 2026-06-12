"use client"

import { useEffect, useState, useTransition } from "react"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { Button } from "@/components/ui/button"
import { RefreshCw, ExternalLink, Newspaper } from "lucide-react"

interface NewsRow {
  id: string
  source: string
  title: string
  url: string
  thumbnail_url: string | null
  published_at: string | null
  category: string | null
}

const SOURCE_FILTERS = ["all", "koreaboo", "allkpop", "soompi"] as const
const SOURCE_LABEL: Record<string, string> = {
  all: "전체", koreaboo: "Koreaboo", allkpop: "Allkpop", soompi: "Soompi",
}
const CATEGORY_FILTERS = ["all", "kpop", "kdrama", "kbeauty", "general"] as const
const CATEGORY_LABEL: Record<string, string> = {
  all: "전체", kpop: "K-Pop", kdrama: "K-Drama", kbeauty: "K-Beauty", general: "General",
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
}

export default function HallyuNewsAdminPage() {
  const { toast } = useToast()
  const [news, setNews] = useState<NewsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sourceFilter, setSourceFilter] = useState<typeof SOURCE_FILTERS[number]>("all")
  const [categoryFilter, setCategoryFilter] = useState<typeof CATEGORY_FILTERS[number]>("all")
  const [collecting, setCollecting] = useState(false)
  const [, startTransition] = useTransition()

  const fetchNews = () => {
    setLoading(true)
    const qs = new URLSearchParams({ limit: "50" })
    if (sourceFilter !== "all") qs.set("source", sourceFilter)
    if (categoryFilter !== "all") qs.set("category", categoryFilter)
    fetch(`/api/hallyu-news?${qs}`)
      .then((r) => r.json())
      .then((b: { news: NewsRow[] }) => setNews(b.news ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchNews() }, [sourceFilter, categoryFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  async function onCollect() {
    setCollecting(true)
    try {
      const res = await fetch("/api/cron/collect-hallyu-news")
      const body = await res.json()
      if (!res.ok) { toast({ title: "수집 실패", description: String(body.error ?? "오류") }); return }
      const s = body.summary as Record<string, { inserted: number }>
      const lines = Object.entries(s).map(([src, d]) => `${SOURCE_LABEL[src] ?? src} ${d.inserted}건`).join(" · ")
      toast({ title: `수집 완료 — 총 ${body.total_inserted}건`, description: lines })
      startTransition(() => fetchNews())
    } finally {
      setCollecting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-semibold mb-1">Hallyu News 관리</h1>
          <p className="text-muted-foreground text-sm">수집된 뉴스 {news.length}건</p>
        </div>
        <Button
          onClick={onCollect}
          disabled={collecting}
          className="shrink-0 h-9 px-4 text-sm text-white flex items-center gap-2"
          style={{ backgroundColor: "#FF4B6E" }}
        >
          <RefreshCw className={`w-4 h-4 ${collecting ? "animate-spin" : ""}`} />
          {collecting ? "수집 중…" : "뉴스 수집 실행"}
        </Button>
      </div>

      {/* 출처 탭 */}
      <div className="flex gap-2 flex-wrap">
        {SOURCE_FILTERS.map((s) => (
          <button
            key={s} type="button"
            onClick={() => setSourceFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              sourceFilter === s ? "text-white border-[#FF4B6E]" : "border-border/40 text-muted-foreground hover:text-foreground"
            }`}
            style={sourceFilter === s ? { backgroundColor: "#FF4B6E" } : undefined}
          >
            {SOURCE_LABEL[s]}
          </button>
        ))}
      </div>

      {/* 카테고리 탭 */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORY_FILTERS.map((c) => (
          <button
            key={c} type="button"
            onClick={() => setCategoryFilter(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              categoryFilter === c ? "border-border/70 text-foreground bg-[#1a1a1a]" : "border-border/30 text-muted-foreground hover:text-foreground"
            }`}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">로딩 중...</p>
      ) : news.length === 0 ? (
        <div className="text-center py-12">
          <Newspaper className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">뉴스 없음 — 수집을 실행해 주세요.</p>
        </div>
      ) : (
        <div className="border border-border/30 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30 bg-[#141418]">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">출처</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">제목</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide hidden md:table-cell">카테고리</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide hidden md:table-cell">발행일</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {news.map((row, i) => (
                <tr key={row.id} className={`border-b border-border/20 last:border-0 ${i % 2 === 0 ? "bg-[#0d0d0f]" : "bg-[#111113]"}`}>
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{SOURCE_LABEL[row.source] ?? row.source}</td>
                  <td className="px-4 py-3 text-foreground max-w-xs">
                    <p className="line-clamp-2 text-xs leading-relaxed">{row.title}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      {CATEGORY_LABEL[row.category ?? ""] ?? row.category ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell whitespace-nowrap">{fmtDate(row.published_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[#252528] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Toaster />
    </div>
  )
}
