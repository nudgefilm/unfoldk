"use client"

import { useEffect, useRef, useState } from "react"
import { Play, X, Youtube } from "lucide-react"

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
}

// 서비스별 상세 모달 하단 또는 메인 페이지에 삽입되는 YouTube 영상 섹션
// published 영상이 없으면 섹션 자체 미노출
// refId 생략 시 service 전체 published 영상 표시
export function YoutubeVideoSection({
  service,
  refId,
  refType,
  title = "Videos",
}: YoutubeVideoSectionProps) {
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [embedVideoId, setEmbedVideoId] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const qs = new URLSearchParams({ service })
    if (refId) qs.set("ref_id", refId)
    if (refType) qs.set("ref_type", refType)
    fetch(`/api/videos?${qs}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { videos: VideoItem[] }) => setVideos(body.videos ?? []))
      .catch(() => setVideos([]))
      .finally(() => setLoading(false))
  }, [service, refId, refType])  // eslint-disable-line react-hooks/exhaustive-deps

  // ESC 키로 embed 모달 닫기
  useEffect(() => {
    if (!embedVideoId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEmbedVideoId(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [embedVideoId])

  if (loading || videos.length === 0) return null

  return (
    <>
      <div className="mt-6 pt-5 border-t border-border/20">
        <div className="flex items-center gap-2 mb-3">
          <Youtube className="w-4 h-4" style={{ color: "#FF4B6E" }} />
          <p className="text-muted-foreground text-xs uppercase tracking-wider">{title}</p>
        </div>

        {/* 가로 스크롤 카드 */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {videos.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setEmbedVideoId(v.video_id)}
              className="flex-shrink-0 w-[180px] rounded-xl overflow-hidden bg-[#252528] hover:ring-1 hover:ring-[#FF4B6E]/50 transition-all group text-left"
            >
              {/* 썸네일 */}
              <div className="relative w-full aspect-video bg-[#1a1a1a]">
                {v.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.thumbnail_url}
                    alt={v.title ?? "video"}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Youtube className="w-6 h-6 text-muted-foreground/40" />
                  </div>
                )}
                {/* 재생 버튼 오버레이 */}
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
          ref={dialogRef}
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
