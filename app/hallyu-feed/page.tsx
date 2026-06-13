"use client"

import { useEffect, useState, useCallback } from "react"
import { Newspaper, ChevronLeft, ChevronRight, Flag, Pencil, Trash2, Tag, Calendar } from "lucide-react"
import { FooterSection } from "@/components/footer-section"
import { HallyuPassBanner } from "@/components/hallyu-pass-banner"
import { NewsCard, type NewsCardProps } from "@/components/hallyu-feed/news-card"
import { WriteFeedModal } from "@/components/hallyu-feed/write-feed-modal"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { hasProAccess } from "@/lib/auth/plan"

// ── AI Feed ───────────────────────────────────────────────────────────────────
type NewsItem = NewsCardProps

const CATEGORY_TABS = [
  { key: "",         label: "All" },
  { key: "kpop",    label: "K-pop" },
  { key: "kdrama",  label: "K-drama" },
  { key: "kbeauty", label: "K-beauty" },
  { key: "general", label: "General" },
] as const

const NEWS_LIMIT = 18

// ── Community Feed ────────────────────────────────────────────────────────────
interface CommunityPost {
  id: string
  user_id: string
  title: string
  content: string
  artist_keyword: string | null
  created_at: string
  users: { email: string } | null
}

const COMMUNITY_LIMIT = 12

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function authorLabel(post: CommunityPost) {
  const email = post.users?.email ?? ""
  return email ? email.split("@")[0] : "fan"
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function HallyuFeedPage() {
  const [activeTab, setActiveTab] = useState<"ai" | "community" | "my">("ai")

  // 인증
  const [userId, setUserId]     = useState<string | null>(null)
  const [isPro, setIsPro]       = useState(false)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        supabase.from("users").select("plan_type, is_admin, trial_ends_at").eq("id", user.id).maybeSingle()
          .then(({ data }) => {
            const row = data as { plan_type?: string; is_admin?: boolean; trial_ends_at?: string | null } | null
            setIsPro(hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin, trialEndsAt: row?.trial_ends_at }))
            setAuthReady(true)
          })
      } else {
        setAuthReady(true)
      }
    })
  }, [])

  // ── AI Feed 상태 ──────────────────────────────────────────────────────────
  const [news, setNews]         = useState<NewsItem[]>([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [category, setCategory] = useState("")
  const [newsPage, setNewsPage] = useState(0)
  const [newsHasMore, setNewsHasMore] = useState(false)
  const [newsTotal, setNewsTotal] = useState(0)

  const fetchNews = useCallback(async (cat: string, pg: number) => {
    setNewsLoading(true)
    const qs = new URLSearchParams({ limit: String(NEWS_LIMIT), offset: String(pg * NEWS_LIMIT) })
    if (cat) qs.set("category", cat)
    try {
      const res = await fetch(`/api/hallyu-feed?${qs}`)
      if (!res.ok) return
      const body = await res.json() as { news: NewsItem[] }
      setNews(body.news ?? [])
      setNewsHasMore((body.news ?? []).length === NEWS_LIMIT)
      if (pg === 0) {
        const cqs = new URLSearchParams({ count_only: "true" })
        if (cat) cqs.set("category", cat)
        fetch(`/api/hallyu-feed?${cqs}`)
          .then(r => r.json()).then((b: { count: number }) => setNewsTotal(b.count ?? 0)).catch(() => {})
      }
    } finally {
      setNewsLoading(false)
    }
  }, [])

  useEffect(() => { setNewsPage(0); fetchNews(category, 0) }, [category, fetchNews])

  function goNewsPage(p: number) { setNewsPage(p); fetchNews(category, p); window.scrollTo({ top: 0, behavior: "smooth" }) }

  const newsTotalPages = Math.ceil(newsTotal / NEWS_LIMIT)

  // ── Community Feed 상태 ───────────────────────────────────────────────────
  const [posts, setPosts]                 = useState<CommunityPost[]>([])
  const [communityLoading, setCommunityLoading] = useState(false)
  const [communityPage, setCommunityPage] = useState(0)
  const [communityTotal, setCommunityTotal] = useState(0)
  const [showWriteModal, setShowWriteModal] = useState(false)
  const [reportedIds, setReportedIds]     = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId]       = useState<string | null>(null)

  const fetchCommunity = useCallback(async (pg: number, myFeed = false) => {
    setCommunityLoading(true)
    const qs = new URLSearchParams({ limit: String(COMMUNITY_LIMIT), offset: String(pg * COMMUNITY_LIMIT) })
    if (myFeed) qs.set("my_feed", "true")
    try {
      const res = await fetch(`/api/community-feeds?${qs}`)
      if (!res.ok) return
      const body = await res.json() as { feeds: CommunityPost[]; total: number }
      setPosts(body.feeds ?? [])
      setCommunityTotal(body.total ?? 0)
    } finally {
      setCommunityLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === "community") { setCommunityPage(0); fetchCommunity(0, false) }
    if (activeTab === "my") { setCommunityPage(0); fetchCommunity(0, true) }
  }, [activeTab, fetchCommunity])

  function goCommunityPage(p: number, myFeed: boolean) {
    setCommunityPage(p); fetchCommunity(p, myFeed); window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function handleReport(feedId: string) {
    if (reportedIds.has(feedId)) return
    const res = await fetch(`/api/community-feeds/${feedId}/report`, { method: "POST" })
    if (res.ok || res.status === 409) setReportedIds(prev => new Set([...prev, feedId]))
  }

  async function handleDelete(feedId: string) {
    if (!confirm("Delete this post?")) return
    setDeletingId(feedId)
    const res = await fetch(`/api/community-feeds/${feedId}`, { method: "DELETE" })
    if (res.ok) {
      setPosts(prev => prev.filter(p => p.id !== feedId))
      setCommunityTotal(prev => Math.max(0, prev - 1))
    }
    setDeletingId(null)
  }

  const communityTotalPages = Math.ceil(communityTotal / COMMUNITY_LIMIT)
  const isMyTab = activeTab === "my"

  const TABS = [
    { key: "ai",        label: "AI Feed" },
    { key: "community", label: "Community" },
    ...(userId ? [{ key: "my", label: "My Feed" }] : []),
  ] as const

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-foreground">
      {/* 히어로 */}
      <section className="text-center py-16 px-4 border-b border-border/20">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Newspaper className="w-7 h-7" style={{ color: "#FF4B6E" }} />
          <h1 className="text-4xl font-bold text-foreground">Hallyu Feed</h1>
        </div>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          K-pop, K-drama &amp; K-beauty<br />
          curated by UnfoldK &amp; global Hallyu fans.
        </p>
        {activeTab === "ai" && newsTotal > 0 && (
          <p className="text-muted-foreground text-sm mt-3">{newsTotal.toLocaleString()} articles</p>
        )}
        {activeTab === "community" && communityTotal > 0 && (
          <p className="text-muted-foreground text-sm mt-3">{communityTotal.toLocaleString()} posts</p>
        )}
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* 메인 탭 */}
        <div className="flex gap-1 mb-8 border-b border-border/20">
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as "ai" | "community" | "my")}
              className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? "border-[#FF4B6E] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── AI Feed 탭 ────────────────────────────────────────────────────── */}
        {activeTab === "ai" && (
          <>
            <div className="flex gap-2 flex-wrap mb-8">
              {CATEGORY_TABS.map(tab => (
                <button
                  key={tab.key} type="button"
                  onClick={() => setCategory(tab.key)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    category === tab.key ? "text-white border-[#FF4B6E]" : "border-border/40 text-muted-foreground hover:text-foreground"
                  }`}
                  style={category === tab.key ? { backgroundColor: "#FF4B6E" } : undefined}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {newsLoading ? (
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
                {news.map((item, i) => (
                  <div key={item.id} className="break-inside-avoid mb-4">
                    <NewsCard {...item} index={i} />
                  </div>
                ))}
              </div>
            )}

            {!newsLoading && newsTotalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-10">
                <button type="button" onClick={() => goNewsPage(newsPage - 1)} disabled={newsPage <= 0}
                  className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors ${newsPage > 0 ? "border-border/50 text-foreground hover:bg-secondary/50" : "border-border/20 text-muted-foreground/30 cursor-not-allowed"}`}>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-muted-foreground">{newsPage + 1} / {newsTotalPages}</span>
                <button type="button" onClick={() => goNewsPage(newsPage + 1)} disabled={!newsHasMore}
                  className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors ${newsHasMore ? "border-border/50 text-foreground hover:bg-secondary/50" : "border-border/20 text-muted-foreground/30 cursor-not-allowed"}`}>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Community / My Feed 탭 ────────────────────────────────────────── */}
        {(activeTab === "community" || activeTab === "my") && (
          <>
            {/* 안내 + Write 버튼 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 p-5 bg-[#141418] border border-border/20 rounded-2xl">
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
                Share your Hallyu story — favorite artists, K-drama reviews,
                travel experiences &amp; more. Pro members can post.
              </p>
              {authReady && (
                isPro ? (
                  <button
                    type="button"
                    onClick={() => setShowWriteModal(true)}
                    className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: "#FF4B6E" }}
                  >
                    <Pencil className="w-4 h-4" />
                    Write a Feed
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => alert("Upgrade to Hallyu Pass to post in the community.")}
                    className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-border/40 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Write a Feed
                  </button>
                )
              )}
            </div>

            {communityLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse bg-[#1a1a1a] border border-border/20 rounded-2xl p-5 space-y-3">
                    <div className="h-4 bg-[#252528] rounded w-2/3" />
                    <div className="h-3 bg-[#252528] rounded w-full" />
                    <div className="h-3 bg-[#252528] rounded w-3/4" />
                  </div>
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-20">
                <Newspaper className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-foreground font-medium mb-1">
                  {isMyTab ? "No posts yet" : "Be the first to share!"}
                </p>
                <p className="text-muted-foreground text-sm">
                  {isMyTab ? "Your posts will appear here." : "Pro members can share their Hallyu stories."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map(post => (
                  <div key={post.id} className="bg-[#141418] border border-border/20 rounded-2xl p-5 hover:border-border/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-foreground font-semibold text-base mb-2 leading-snug">{post.title}</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3">{post.content}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-3">
                          {post.artist_keyword && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#FF4B6E] bg-[#FF4B6E]/10 px-2 py-0.5 rounded-full font-medium">
                              <Tag className="w-3 h-3" />
                              {post.artist_keyword}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/70">
                            <Calendar className="w-3 h-3" />
                            {formatDate(post.created_at)}
                          </span>
                          <span className="text-[11px] text-muted-foreground/60">@{authorLabel(post)}</span>
                        </div>
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex items-center gap-1 shrink-0">
                        {userId && post.user_id === userId ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(post.id)}
                            disabled={deletingId === post.id}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
                            title="Delete post"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : userId && (
                          <button
                            type="button"
                            onClick={() => handleReport(post.id)}
                            disabled={reportedIds.has(post.id)}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                              reportedIds.has(post.id)
                                ? "text-muted-foreground/30 cursor-not-allowed"
                                : "text-muted-foreground hover:text-yellow-400 hover:bg-yellow-400/10"
                            }`}
                            title={reportedIds.has(post.id) ? "Reported" : "Report post"}
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 커뮤니티 페이지네이션 */}
            {!communityLoading && communityTotalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-10">
                <button type="button" onClick={() => goCommunityPage(communityPage - 1, isMyTab)} disabled={communityPage <= 0}
                  className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors ${communityPage > 0 ? "border-border/50 text-foreground hover:bg-secondary/50" : "border-border/20 text-muted-foreground/30 cursor-not-allowed"}`}>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-muted-foreground">{communityPage + 1} / {communityTotalPages}</span>
                <button type="button" onClick={() => goCommunityPage(communityPage + 1, isMyTab)} disabled={communityPage >= communityTotalPages - 1}
                  className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors ${communityPage < communityTotalPages - 1 ? "border-border/50 text-foreground hover:bg-secondary/50" : "border-border/20 text-muted-foreground/30 cursor-not-allowed"}`}>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Write 모달 */}
      {showWriteModal && (
        <WriteFeedModal
          onClose={() => setShowWriteModal(false)}
          onSuccess={() => { fetchCommunity(0, false); setCommunityPage(0) }}
        />
      )}

      <HallyuPassBanner isPro={isPro} />
      <FooterSection />
    </div>
  )
}
