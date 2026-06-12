"use client"

import { useEffect, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Flag, RotateCcw, Trash2, Tag } from "lucide-react"
import Link from "next/link"

interface FeedRow {
  id: string
  user_id: string
  title: string
  content: string
  artist_keyword: string | null
  status: string
  report_count: number
  created_at: string
  users: { email: string } | null
}

type FilterTab = "all" | "reported" | "hidden"

const TAB_LABEL: Record<FilterTab, string> = { all: "전체", reported: "신고됨", hidden: "비공개" }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
}

export default function AdminHallyuCommunityPage() {
  const { toast } = useToast()
  const [feeds, setFeeds]   = useState<FeedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>("all")
  const [actionId, setActionId] = useState<string | null>(null)

  const fetchFeeds = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/community-feeds/list")
      if (!res.ok) return
      const body = await res.json() as { feeds: FeedRow[] }
      setFeeds(body.feeds ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchFeeds() }, [])

  const filtered = filter === "all"
    ? feeds
    : filter === "reported"
    ? feeds.filter(f => f.report_count >= 1)
    : feeds.filter(f => f.status === "hidden")

  async function doAction(id: string, action: "restore" | "delete") {
    if (action === "delete" && !confirm("완전 삭제하시겠습니까?")) return
    setActionId(id)
    try {
      const res = await fetch(`/api/admin/community-feeds/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) { toast({ title: "처리 실패" }); return }
      toast({ title: action === "restore" ? "부활됨" : "삭제됨" })
      await fetchFeeds()
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/hallyu-feed" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-foreground text-2xl font-semibold mb-0.5">커뮤니티 피드 관리</h1>
          <p className="text-muted-foreground text-sm">신고 누적 피드 검토 및 처리</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "reported", "hidden"] as FilterTab[]).map(t => (
          <button key={t} type="button" onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filter === t ? "text-white border-[#FF4B6E]" : "border-border/40 text-muted-foreground hover:text-foreground"
            }`}
            style={filter === t ? { backgroundColor: "#FF4B6E" } : undefined}>
            {TAB_LABEL[t]}
            {t === "reported" && <span className="ml-1.5 text-[10px] opacity-70">({feeds.filter(f => f.report_count >= 1).length})</span>}
            {t === "hidden"   && <span className="ml-1.5 text-[10px] opacity-70">({feeds.filter(f => f.status === "hidden").length})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">로딩 중...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Flag className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">해당 피드 없음</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.sort((a, b) => b.report_count - a.report_count).map(feed => (
            <div key={feed.id} className="bg-[#141418] border border-border/20 rounded-xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {feed.status === "hidden" && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">비공개</span>
                    )}
                    {feed.report_count >= 1 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                        <Flag className="w-2.5 h-2.5" /> 신고 {feed.report_count}회
                      </span>
                    )}
                    {feed.artist_keyword && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-[#FF4B6E] bg-[#FF4B6E]/10 px-2 py-0.5 rounded-full">
                        <Tag className="w-2.5 h-2.5" />{feed.artist_keyword}
                      </span>
                    )}
                  </div>
                  <p className="text-foreground font-medium text-sm mb-1">{feed.title}</p>
                  <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2">{feed.content}</p>
                  <p className="text-muted-foreground/60 text-[10px] mt-2">
                    @{feed.users?.email?.split("@")[0] ?? "unknown"} · {fmtDate(feed.created_at)}
                  </p>
                </div>

                <div className="flex sm:flex-col gap-2 shrink-0">
                  <Button size="sm" variant="outline"
                    onClick={() => doAction(feed.id, "restore")}
                    disabled={actionId === feed.id || feed.status === "published" && feed.report_count === 0}
                    className="h-8 px-3 text-xs border-border/40 text-muted-foreground hover:text-foreground flex items-center gap-1.5">
                    <RotateCcw className="w-3 h-3" /> 부활
                  </Button>
                  <Button size="sm" variant="outline"
                    onClick={() => doAction(feed.id, "delete")}
                    disabled={actionId === feed.id}
                    className="h-8 px-3 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 flex items-center gap-1.5">
                    <Trash2 className="w-3 h-3" /> 삭제
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Toaster />
    </div>
  )
}
