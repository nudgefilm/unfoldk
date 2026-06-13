"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

export interface Top30Artist {
  id: string
  name: string
  rank: number
  listeners: number
}

function formatListeners(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

function getBarBg(rank: number): string {
  if (rank <= 3) return "linear-gradient(to top, #f43f5e, #ec4899)"
  if (rank <= 10) return "rgba(255,75,110,0.58)"
  return "rgba(255,75,110,0.24)"
}

export function KpopTop30Chart({ artists }: { artists: Top30Artist[] }) {
  const [page, setPage] = useState(0)

  const pages = [artists.slice(0, 15), artists.slice(15, 30)].filter(p => p.length > 0)
  const totalPages = pages.length

  if (totalPages === 0) return null

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
          This Week&apos;s K-pop TOP 30
        </span>
        <Link
          href="/kpop"
          className="text-xs font-medium hover:opacity-80 transition-opacity"
          style={{ color: "#FF4B6E" }}
        >
          View full chart →
        </Link>
      </div>

      {/* Chart box: 200px 고정, overflow-hidden으로 슬라이드 클리핑 */}
      <div
        className="relative rounded-2xl bg-white/[0.025] border border-border/20 overflow-hidden"
        style={{ height: 200 }}
      >
        {/* 슬라이딩 래퍼 */}
        <div
          className="flex transition-transform duration-300 ease-in-out h-full"
          style={{
            width: `${totalPages * 100}%`,
            transform: `translateX(-${(page / totalPages) * 100}%)`,
          }}
        >
          {pages.map((pageArtists, pageIdx) => {
            const pageMax = Math.max(...pageArtists.map(a => a.listeners), 1)
            return (
              <div
                key={pageIdx}
                className="flex gap-px"
                style={{ width: `${100 / totalPages}%`, height: "100%", padding: "8px 12px 0" }}
              >
                {pageArtists.map(artist => {
                  // 구획 내 최대값 기준 상대 비율
                  const barH = Math.max((artist.listeners / pageMax) * 100, 1.5)
                  return (
                    <Link
                      key={artist.id}
                      href={`/kpop/${artist.id}`}
                      className="group relative flex-1 flex flex-col"
                      style={{ height: "100%" }}
                    >
                      {/* 순위 번호 */}
                      <div className="h-4 flex items-center justify-center shrink-0">
                        <span className="text-[8px] font-bold text-muted-foreground/40 tabular-nums">
                          {artist.rank}
                        </span>
                      </div>

                      {/* 막대 영역 (flex-1) */}
                      <div className="flex-1 flex flex-col justify-end items-center pb-0.5">
                        <div
                          className="rounded-t-sm transition-opacity group-hover:opacity-70"
                          style={{
                            height: `${barH}%`,
                            background: getBarBg(artist.rank),
                            // 칼럼 너비에 비례하되 최대 36px
                            width: "clamp(3px, 68%, 36px)",
                            minHeight: 2,
                          }}
                        />
                      </div>

                      {/* 아티스트명 (세로 텍스트, 아래→위) */}
                      <div className="h-11 flex justify-center overflow-hidden shrink-0">
                        <span
                          className="text-[8px] text-muted-foreground/55 group-hover:text-muted-foreground/85 transition-colors font-medium"
                          style={{
                            writingMode: "vertical-rl",
                            transform: "rotate(180deg)",
                            display: "block",
                            maxHeight: 44,
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {artist.name}
                        </span>
                      </div>

                      {/* 호버 툴팁 */}
                      <div
                        className="absolute left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20"
                        style={{ bottom: 52 }}
                      >
                        <div className="bg-[#1c1c1f] border border-border/50 rounded-xl px-3 py-2 text-xs whitespace-nowrap shadow-xl">
                          <p className="font-semibold text-foreground">{artist.rank}. {artist.name}</p>
                          <p className="text-muted-foreground/70 mt-0.5">{formatListeners(artist.listeners)} listeners</p>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* 이전 버튼 */}
        {page > 0 && (
          <button
            type="button"
            onClick={() => setPage(p => p - 1)}
            className="absolute top-1/2 -translate-y-1/2 left-2 w-7 h-7 rounded-full flex items-center justify-center border border-border/40 hover:bg-white/5 transition-colors z-10"
            style={{ backgroundColor: "rgba(20,20,24,0.9)" }}
          >
            <ChevronLeft className="w-4 h-4 text-foreground/60" />
          </button>
        )}

        {/* 다음 버튼 */}
        {page < totalPages - 1 && (
          <button
            type="button"
            onClick={() => setPage(p => p + 1)}
            className="absolute top-1/2 -translate-y-1/2 right-2 w-7 h-7 rounded-full flex items-center justify-center border border-border/40 hover:bg-white/5 transition-colors z-10"
            style={{ backgroundColor: "rgba(20,20,24,0.9)" }}
          >
            <ChevronRight className="w-4 h-4 text-foreground/60" />
          </button>
        )}
      </div>

      {/* 페이지 인디케이터 도트 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-2.5">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPage(i)}
              className="rounded-full transition-all duration-200"
              style={{
                width: i === page ? 16 : 6,
                height: 6,
                backgroundColor: i === page ? "#FF4B6E" : "rgba(255,255,255,0.15)",
              }}
              aria-label={`Page ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
