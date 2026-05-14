"use client"

// /kpop/artists — 활성 아티스트 전체 브라우징 페이지
// CLAUDE.md §6 KpopStats 노출 원칙: 리스너순 정렬, 그룹/솔로 필터, 페이지네이션.
// 데이터: /api/kpop/artists?sort=listeners&type=group|solo&page=N&pageSize=30

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { FooterSection } from "@/components/footer-section"

const PAGE_SIZE = 30

interface ArtistListItem {
  id: string
  name: string
  name_ko: string | null
  thumbnail_url: string | null
  member_count: number | null
  has_youtube: boolean
  latest_subscribers: number | null
  latest_total_views: number | null
  latest_listeners: number | null
}

interface ApiResponse {
  items: ArtistListItem[]
  total: number
  page: number
  pageSize: number
}

type TypeFilter = "all" | "group" | "solo"
type SortKey = "listeners" | "name"

function formatBigNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—"
  const abs = Math.abs(n)
  if (abs >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B"
  if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
  if (abs >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K"
  return n.toLocaleString()
}

export default function ArtistsListPage() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [sort, setSort] = useState<SortKey>("listeners")
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<ArtistListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({
      sort,
      page: String(page),
      pageSize: String(PAGE_SIZE),
    })
    if (typeFilter !== "all") params.set("type", typeFilter)

    fetch(`/api/kpop/artists?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ApiResponse | null) => {
        if (data) {
          setItems(data.items)
          setTotal(data.total)
        } else {
          setItems([])
          setTotal(0)
        }
      })
      .catch((err) => {
        console.error("[kpop/artists] fetch 실패:", err)
        setItems([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [typeFilter, sort, page])

  // 필터·정렬 변경 시 1페이지로 리셋
  const handleTypeChange = (v: TypeFilter) => {
    setTypeFilter(v)
    setPage(1)
  }
  const handleSortChange = (v: SortKey) => {
    setSort(v)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0d0d0f" }}>
      <main className="max-w-[1200px] mx-auto px-6 py-12">
        {/* Back link */}
        <Link
          href="/kpop"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to KpopStats
        </Link>

        <section className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">All Artists</h1>
          <p className="text-muted-foreground text-sm">
            Browse all K-pop artists tracked on Unfold K.
          </p>
        </section>

        {/* Filter / Sort 컨트롤 */}
        <section className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Type:</span>
            {(["all", "group", "solo"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTypeChange(t)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  typeFilter === t
                    ? "bg-[#FF4B6E] border-[#FF4B6E] text-white"
                    : "bg-[#1a1a1a] border-border/30 text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "all" ? "All" : t === "group" ? "Group" : "Solo"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Sort:</span>
            {(["listeners", "name"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSortChange(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  sort === s
                    ? "bg-[#FF4B6E] border-[#FF4B6E] text-white"
                    : "bg-[#1a1a1a] border-border/30 text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "listeners" ? "Listeners" : "Name"}
              </button>
            ))}
          </div>

          <div className="ml-auto text-muted-foreground text-sm">
            {loading ? "Loading..." : `${total.toLocaleString()} artists`}
          </div>
        </section>

        {/* 아티스트 카드 그리드 */}
        <section className="mb-8">
          {loading ? (
            <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : items.length === 0 ? (
            <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center text-muted-foreground text-sm">
              No artists match the current filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((a) => (
                <Link
                  key={a.id}
                  href={`/kpop/${a.id}`}
                  className="bg-[#1a1a1a] border border-border/30 rounded-xl p-4 flex items-center gap-3 hover:bg-[#2a2a2c] hover:border-primary/40 transition-colors"
                >
                  {a.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.thumbnail_url}
                      alt={a.name}
                      className="w-12 h-12 rounded-full object-cover flex-shrink-0 bg-[#252525]"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#252525] flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground font-medium truncate">{a.name}</p>
                    {a.name_ko && (
                      <p className="text-muted-foreground text-xs truncate">{a.name_ko}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs">
                      <span className="text-muted-foreground">
                        <span className="text-foreground">{formatBigNumber(a.latest_listeners)}</span>{" "}
                        listeners
                      </span>
                      {a.has_youtube ? (
                        <span className="text-muted-foreground">
                          <span className="text-foreground">
                            {formatBigNumber(a.latest_subscribers)}
                          </span>{" "}
                          subs
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">YouTube coming soon</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <nav className="flex items-center justify-center gap-2 mb-12" aria-label="Pagination">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="p-2 rounded-lg bg-[#1a1a1a] border border-border/30 text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#2a2a2c]"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-muted-foreground text-sm px-4">
              Page <span className="text-foreground font-medium">{page}</span> /{" "}
              {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-2 rounded-lg bg-[#1a1a1a] border border-border/30 text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#2a2a2c]"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </nav>
        )}
      </main>

      <FooterSection />
    </div>
  )
}
