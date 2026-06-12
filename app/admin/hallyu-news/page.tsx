"use client"

import { useEffect, useState, useTransition } from "react"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { Button } from "@/components/ui/button"
import { RefreshCw, Sparkles, ExternalLink, Newspaper } from "lucide-react"

interface NewsRow {
  id: string
  source: string
  title: string
  url: string
  thumbnail_url: string | null
  published_at: string | null
  category: string | null
  summary: string | null
  content_type: string | null
}

const CATEGORY_FILTERS = ["all", "kpop", "kdrama", "kbeauty", "general"] as const
const CATEGORY_LABEL: Record<string, string> = {
  all: "전체", kpop: "K-Pop", kdrama: "K-Drama", kbeauty: "K-Beauty", general: "General",
}
const CONTENT_TYPE_FILTERS = ["all", "rss", "generated"] as const
const CONTENT_TYPE_LABEL: Record<string, string> = {
  all: "전체", rss: "RSS", generated: "Generated",
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
}

export default function HallyuNewsAdminPage() {
  const { toast } = useToast()
  const [news, setNews] = useState<NewsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<typeof CATEGORY_FILTERS[number]>("all")
  const [typeFilter, setTypeFilter] = useState<typeof CONTENT_TYPE_FILTERS[number]>("all")
  const [collecting, setCollecting] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)
  const [, startTransition] = useTransition()

  const fetchNews = () => {
    setLoading(true)
    const qs = new URLSearchParams({ limit: "50" })
    if (categoryFilter !== "all") qs.set("category", categoryFilter)
    // content_type 필터는 클라이언트 측 필터링
    fetch(`/api/hallyu-news?${qs}`)
      .then((r) => r.json())
      .then((b: { news: NewsRow[] }) => setNews(b.news ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchNews() }, [categoryFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredNews = typeFilter === "all"
    ? news
    : news.filter((n) => n.content_type === typeFilter)

  async function onCollect() {
    setCollecting(true)
    try {
      const res = await fetch("/api/cron/collect-hallyu-news")
      const body = await res.json()
      if (!res.ok) { toast({ title: "수집 실패", description: String(body.error ?? "오류") }); return }
      toast({
        title: `수집 완료 — 총 ${body.total_inserted}건 신규, AI ${body.ai_processed}건, Generated ${body.gen_inserted}건`,
      })
      startTransition(() => fetchNews())
    } finally {
      setCollecting(false)
    }
  }

  async function onReprocess() {
    setReprocessing(true)
    try {
      const res = await fetch("/api/admin/hallyu-news/reprocess", { method: "POST" })
      const body = await res.json()
      if (!res.ok) { toast({ title: "재처리 실패", description: String(body.error ?? "오류") }); return }
      toast({ title: `AI 요약 생성 완료 — ${body.processed}건 처리` })
      startTransition(() => fetchNews())
    } finally {
      setReprocessing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-foreground text-2xl font-semibold mb-1">Hallyu News 관리</h1>
          <p className="text-muted-foreground text-sm">수집된 뉴스 {filteredNews.length}건</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={onReprocess}
            disabled={reprocessing}
            variant="outline"
            className="shrink-0 h-9 px-4 text-sm flex items-center gap-2"
          >
            <Sparkles className={`w-4 h-4 ${reprocessing ? "animate-pulse" : ""}`} />
            {reprocessing ? "AI 처리 중…" : "AI 요약 생성"}
          </Button>
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
      </div>

      {/* content_type 탭 */}
      <div className="flex gap-2 flex-wrap">
        {CONTENT_TYPE_FILTERS.map((t) => (
          <button
            key={t} type="button"
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              typeFilter === t ? "text-white border-[#FF4B6E]" : "border-border/40 text-muted-foreground hover:text-foreground"
            }`}
            style={typeFilter === t ? { backgroundColor: "#FF4B6E" } : undefined}
          >
            {CONTENT_TYPE_LABEL[t]}
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
      ) : filteredNews.length === 0 ? (
        <div className="text-center py-12">
          <Newspaper className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">뉴스 없음 — 수집을 실행해 주세요.</p>
        </div>
      ) : (
        <div className="border border-border/30 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30 bg-[#141418]">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">타입</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">제목</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide hidden md:table-cell">카테고리</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide hidden md:table-cell">AI 요약</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide hidden md:table-cell">발행일</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredNews.map((row, i) => (
                <tr key={row.id} className={`border-b border-border/20 last:border-0 ${i % 2 === 0 ? "bg-[#0d0d0f]" : "bg-[#111113]"}`}>
                  <td className="px-4 py-3">
                    {row.content_type === "generated" ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: "#FF4B6E" }}>
                        Generated
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        {row.source}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground max-w-xs">
                    <p className="line-clamp-2 text-xs leading-relaxed">{row.title}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      {CATEGORY_LABEL[row.category ?? ""] ?? row.category ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {row.summary ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                        ✓ 완료
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                        ⏳ 대기
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell whitespace-nowrap">{fmtDate(row.published_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {row.content_type !== "generated" && (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[#252528] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
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
