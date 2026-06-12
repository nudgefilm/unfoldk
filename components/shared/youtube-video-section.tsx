"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Play, X, Youtube } from "lucide-react"

interface VideoItem {
  id: string
  video_id: string
  title: string
  thumbnail_url: string | null
  published_at: string | null
}

interface YoutubeVideoSectionProps {
  service: string
  refId?: string
  refType?: string
  title?: string
  id?: string
}

const PAGE_SIZE = 3

// YouTube 영상 섹션 — 서비스 메인 페이지 또는 상세 모달 하단에 삽입
// published 영상이 없으면 섹션 자체 미노출
// refId 생략 시 service 전체 published 영상 표시
// id prop: 앵커 링크 타겟용 (scroll-mt-24 적용)
export function YoutubeVideoSection({
  service,
  refId,
  refType,
  title = "Videos",
  id,
}: YoutubeVideoSectionProps) {
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [embedVideoId, setEmbedVideoId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setOffset(0)
    const qs = new URLSearchParams({ service })
    if (refId) qs.set("ref_id", refId)
    if (refType) qs.set("ref_type", refType)
    fetch(`/api/videos?${qs}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { videos: VideoItem[] }) => setVideos(body.videos ?? []))
      .catch(() => setVideos([]))
      .finally(() => setLoading(false))
  }, [service, refId, refType]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!embedVideoId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEmbedVideoId(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [embedVideoId])

  if (loading || videos.length === 0) return null

  const maxOffset = Math.max(0, videos.length - PAGE_SIZE)
  const canPrev = offset > 0
  const canNext = offset < maxOffset
  const visible = videos.slice(offset, offset + PAGE_SIZE)

  return (
    <>
      <div id={id} className="mt-6 pt-5 border-t border-border/20 scroll-mt-24">
        {/* 섹션 헤더 + 화살표 네비게이션 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Youtube className="w-4 h-4 shrink-0" style={{ color: "#FF4B6E" }} />
            <p className="text-muted-foreground text-xs uppercase tracking-wider">{title}</p>
          </div>
          {videos.length > PAGE_SIZE && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={!canPrev}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                aria-label="Previous videos"
                className={`w-7 h-7 rounded-full flex items-center justify-center border transition-colors ${
                  canPrev
                    ? "border-border/50 text-foreground hover:bg-secondary/50"
                    : "border-border/20 text-muted-foreground/30 cursor-not-allowed"
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setOffset((o) => Math.min(maxOffset, o + PAGE_SIZE))}
                aria-label="Next videos"
                className={`w-7 h-7 rounded-full flex items-center justify-center border transition-colors ${
                  canNext
                    ? "border-border/50 text-foreground hover:bg-secondary/50"
                    : "border-border/20 text-muted-foreground/30 cursor-not-allowed"
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* 카드 그리드 — 모바일 1열 / sm+ 3열 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {visible.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setEmbedVideoId(v.video_id)}
              className="rounded-xl overflow-hidden bg-[#252528] hover:ring-1 hover:ring-[#FF4B6E]/50 transition-all group text-left"
            >
              {/* 썸네일 */}
              <div className="relative w-full aspect-video bg-[#1a1a1a]">
                {v.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.thumbnail_url}
                    alt={v.title ?? "video"}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Youtube className="w-6 h-6 text-muted-foreground/40" />
                  </div>
                )}
                {/* Play 오버레이 */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "#FF4B6E" }}
                  >
                    <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                  </div>
                </div>
              </div>
              {/* 제목 */}
              <div className="p-2">
                <p className="text-foreground text-xs font-medium leading-snug line-clamp-2">
                  {v.title}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* YouTube Embed 모달 */}
      {embedVideoId && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85"
          onClick={() => setEmbedVideoId(null)}
        >
          <div
            className="relative w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setEmbedVideoId(null)}
              className="absolute -top-10 right-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-white" />
            </button>
            <div className="w-full aspect-video rounded-xl overflow-hidden">
              <iframe
                src={`https://www.youtube.com/embed/${embedVideoId}?autoplay=1&rel=0`}
                title="YouTube video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
