"use client"

import { useEffect, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { Youtube } from "lucide-react"

interface VideoRow {
  id: string
  service: string
  ref_id: string | null
  ref_type: string | null
  video_id: string
  title: string | null
  thumbnail_url: string | null
  view_count: number | null
  published_at: string | null
  status: "pending" | "published" | "rejected"
  created_at: string
}

const SERVICES = ["all", "calendar", "kpop", "kdrama", "hangeul", "curation"] as const
type ServiceFilter = (typeof SERVICES)[number]
const STATUS_FILTERS = ["all", "pending", "published", "rejected"] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

const SERVICE_LABEL: Record<string, string> = {
  all: "전체",
  calendar: "HallyuCalendar",
  kpop: "KpopStats",
  kdrama: "KdramaMatch",
  hangeul: "HangeulGo",
  curation: "Curation K",
}

export default function VideosAdminPage() {
  const { toast } = useToast()
  const [videos, setVideos] = useState<VideoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending")
  const [page, setPage] = useState(1)
  const [, startTransition] = useTransition()

  // 영상 수집 폼
  const [collectService, setCollectService] = useState("kpop")
  const [collectRefId, setCollectRefId] = useState("")
  const [collectRefType, setCollectRefType] = useState("")
  const [collectQuery, setCollectQuery] = useState("")
  const [collecting, setCollecting] = useState(false)

  const PAGE_SIZE = 20

  const fetchVideos = () => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (serviceFilter !== "all") qs.set("service", serviceFilter)
    if (statusFilter !== "all") qs.set("status", statusFilter)
    fetch(`/api/admin/videos?${qs}`)
      .then((r) => r.json())
      .then((body: { videos: VideoRow[] }) => setVideos(body.videos ?? []))
      .catch((err) => console.error("[videos] fetch 실패:", err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchVideos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(videos.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = videos.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const pendingCount = videos.filter((v) => v.status === "pending").length

  async function patch(id: string, status: string) {
    const res = await fetch(`/api/admin/videos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast({ title: "변경 실패", description: String(body.error ?? "오류") })
      return false
    }
    return true
  }

  function onPublish(id: string) {
    startTransition(async () => {
      const ok = await patch(id, "published")
      if (ok) {
        setVideos((prev) => prev.map((v) => v.id === id ? { ...v, status: "published" } : v))
        toast({ title: "승인 완료" })
      }
    })
  }

  function onReject(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/videos/${id}`, { method: "DELETE" })
      if (res.ok) {
        setVideos((prev) => prev.filter((v) => v.id !== id))
        toast({ title: "삭제 완료" })
      } else {
        toast({ title: "삭제 실패" })
      }
    })
  }

  async function onCollect() {
    if (!collectQuery.trim()) {
      toast({ title: "검색어를 입력하세요" })
      return
    }
    setCollecting(true)
    try {
      const res = await fetch("/api/youtube/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: collectService,
          ref_id: collectRefId.trim() || undefined,
          ref_type: collectRefType.trim() || undefined,
          query: collectQuery.trim(),
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        toast({ title: "수집 실패", description: String(body.error ?? "오류") })
        return
      }
      const filteredMsg = body.filtered > 0 ? ` (${body.filtered}건 조회수·블랙리스트 제외)` : ""
      toast({ title: `수집 완료 — ${body.collected}건 저장됨${filteredMsg}` })
      fetchVideos()
    } finally {
      setCollecting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold mb-1">YouTube 영상 관리</h1>
        <p className="text-muted-foreground text-sm">
          미승인 {pendingCount}건 · 전체 {videos.length}건
        </p>
      </div>

      {/* 영상 수집 폼 */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
        <div>
          <p className="text-foreground text-sm font-medium">YouTube 영상 수집</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            kpop: MV/teaser/official/comeback · calendar: MV/showcase/concert · kdrama: trailer/OST · hangeul: clip/scene · curation: travel/vlog/Korea
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select
            value={collectService}
            onChange={(e) => setCollectService(e.target.value)}
            className="h-9 rounded-lg px-3 text-sm bg-[#0d0d0f] border border-[#2a2a2a] text-foreground"
          >
            {SERVICES.filter((s) => s !== "all").map((s) => (
              <option key={s} value={s}>{SERVICE_LABEL[s]}</option>
            ))}
          </select>
          <Input
            placeholder="ref_id (선택)"
            value={collectRefId}
            onChange={(e) => setCollectRefId(e.target.value)}
            className="h-9 text-sm bg-[#0d0d0f] border-[#2a2a2a]"
          />
          <Input
            placeholder="ref_type (선택)"
            value={collectRefType}
            onChange={(e) => setCollectRefType(e.target.value)}
            className="h-9 text-sm bg-[#0d0d0f] border-[#2a2a2a]"
          />
          <Input
            placeholder="검색어 (필수)"
            value={collectQuery}
            onChange={(e) => setCollectQuery(e.target.value)}
            className="h-9 text-sm bg-[#0d0d0f] border-[#2a2a2a]"
            onKeyDown={(e) => { if (e.key === "Enter") onCollect() }}
          />
        </div>
        <Button
          onClick={onCollect}
          disabled={collecting}
          className="h-9 px-4 text-sm text-white"
          style={{ backgroundColor: "#FF4B6E" }}
        >
          {collecting ? "수집 중…" : "영상 수집"}
        </Button>
      </div>

      {/* 서비스 탭 필터 */}
      <div className="flex gap-2 flex-wrap">
        {SERVICES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { setServiceFilter(s); setPage(1) }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              serviceFilter === s
                ? "text-white border-[#FF4B6E]"
                : "border-border/40 text-muted-foreground hover:text-foreground"
            }`}
            style={serviceFilter === s ? { backgroundColor: "#FF4B6E" } : undefined}
          >
            {SERVICE_LABEL[s]}
          </button>
        ))}
      </div>

      {/* 상태 탭 필터 */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((sf) => (
          <button
            key={sf}
            type="button"
            onClick={() => { setStatusFilter(sf); setPage(1) }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === sf
                ? "border-border/70 text-foreground bg-[#1a1a1a]"
                : "border-border/30 text-muted-foreground hover:text-foreground"
            }`}
          >
            {sf === "all" ? "전체" : sf === "pending" ? `미승인 (${pendingCount})` : sf === "published" ? "승인됨" : "거절됨"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">로딩 중...</p>
      ) : paged.length === 0 ? (
        <p className="text-muted-foreground text-sm">영상 없음</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {paged.map((v) => (
            <div key={v.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
              {/* 썸네일 */}
              <a
                href={`https://www.youtube.com/watch?v=${v.video_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block relative aspect-video bg-[#0d0d0f] group"
              >
                {v.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.thumbnail_url}
                    alt={v.title ?? "video"}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Youtube className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                )}
              </a>

              <div className="p-3 space-y-2">
                <p className="text-foreground text-sm font-medium leading-snug line-clamp-2">
                  {v.title ?? "제목 없음"}
                </p>
                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                  <span className="px-1.5 py-0.5 rounded bg-[#252528] text-foreground/70 uppercase tracking-wide">
                    {v.service}
                  </span>
                  {v.ref_type && (
                    <span>{v.ref_type}</span>
                  )}
                  {v.ref_id && (
                    <span className="truncate max-w-[80px]" title={v.ref_id}>{v.ref_id.slice(0, 8)}…</span>
                  )}
                  {v.view_count !== null && v.view_count > 0 && (
                    <span className="text-sky-400">
                      {v.view_count >= 1_000_000
                        ? `${(v.view_count / 1_000_000).toFixed(1)}M views`
                        : v.view_count >= 1_000
                          ? `${(v.view_count / 1_000).toFixed(0)}K views`
                          : `${v.view_count} views`}
                    </span>
                  )}
                  {v.status === "published" && (
                    <span className="text-green-400 border border-green-400/30 px-1.5 py-0.5 rounded">승인됨</span>
                  )}
                  {v.status === "rejected" && (
                    <span className="text-red-400 border border-red-400/30 px-1.5 py-0.5 rounded">거절됨</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {v.status !== "published" && (
                    <Button
                      size="sm"
                      onClick={() => onPublish(v.id)}
                      className="h-7 px-3 text-xs text-white flex-1"
                      style={{ backgroundColor: "#22c55e" }}
                    >
                      승인
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onReject(v.id)}
                    className="h-7 px-3 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10 flex-1"
                  >
                    삭제
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && videos.length > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <p className="text-muted-foreground text-sm">
            {((safePage - 1) * PAGE_SIZE + 1)}–{Math.min(safePage * PAGE_SIZE, videos.length)} / {videos.length}건
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                safePage <= 1 ? "border-border/20 text-muted-foreground/40 cursor-not-allowed" : "border-border/40 text-foreground hover:bg-secondary/50"
              }`}
            >
              이전
            </button>
            <span className="text-sm text-muted-foreground">{safePage} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                safePage >= totalPages ? "border-border/20 text-muted-foreground/40 cursor-not-allowed" : "border-border/40 text-foreground hover:bg-secondary/50"
              }`}
            >
              다음
            </button>
          </div>
        </div>
      )}

      <Toaster />
    </div>
  )
}
