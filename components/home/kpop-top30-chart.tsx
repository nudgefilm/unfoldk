"use client"

import React, { useState, useRef } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

export interface Top30Artist {
  id: string
  name: string
  rank: number
  listeners: number
}

// 240px 컨테이너 - 20px top padding(순위 번호 공간) = 220px 최대 막대 높이
const MAX_BAR_HEIGHT = 220

function formatListeners(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

// 높이 비율 기반 opacity (높은 막대 → 진한 핑크, 낮은 막대 → 연한 핑크)
function getBarBackground(rank: number, heightRatio: number): string {
  const opacity = 0.4 + heightRatio * 0.6
  if (rank <= 3) {
    return `linear-gradient(to top, rgba(244,63,94,${opacity}), rgba(236,72,153,${opacity}))`
  }
  return `rgba(255,75,110,${opacity})`
}

interface TooltipState {
  artist: Top30Artist
  left: number  // px from outer div left
  top: number   // px from outer div top (bar 상단 위치)
}

export function KpopTop30Chart({ artists }: { artists: Top30Artist[] }) {
  const [page, setPage] = useState(0)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const outerRef = useRef<HTMLDivElement>(null)

  const pages = [artists.slice(0, 15), artists.slice(15, 30)].filter(p => p.length > 0)
  const totalPages = pages.length

  if (totalPages === 0) return null

  // overflow:hidden 컨테이너 밖(outerRef 기준) 절대 좌표로 툴팁 위치 계산
  const handleBarEnter = (
    e: React.MouseEvent<HTMLAnchorElement>,
    artist: Top30Artist,
  ) => {
    if (!outerRef.current) return
    const outerRect = outerRef.current.getBoundingClientRect()
    const barRect = e.currentTarget.getBoundingClientRect()
    setTooltip({
      artist,
      left: barRect.left + barRect.width / 2 - outerRect.left,
      top: barRect.top - outerRect.top - 8,  // 막대 상단에서 8px 위
    })
  }

  return (
    <div>
      {/* 헤더 */}
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

      {/* 외부 래퍼: relative + overflow:visible → 툴팁이 차트 밖으로 노출 */}
      <div ref={outerRef} className="relative">
        {/* 차트 컨테이너: overflow:hidden은 슬라이더 마스킹 전용 */}
        <div
          className="relative rounded-2xl border border-border/20 overflow-hidden"
          style={{ height: 240, background: "rgba(10,10,14,0.45)" }}
        >
          {/* 슬라이딩 래퍼 */}
          <div
            className="flex h-full transition-transform duration-300 ease-in-out"
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
                  className="flex gap-1"
                  style={{ width: `${100 / totalPages}%`, height: "100%", padding: "0 12px" }}
                >
                  {pageArtists.map(artist => {
                    const heightRatio = artist.listeners / pageMax
                    const barH = Math.max(heightRatio * MAX_BAR_HEIGHT, 4)
                    // 순위에 따라 너비 미세 감소 (1위: 100%, 30위: ~77%)
                    const barWidthPct = Math.max(70, 100 - (artist.rank - 1) * 0.8)
                    const showName = barH >= 36

                    return (
                      // flex-col: 순위 행(고정) + 막대 영역(flex-1) → 순위가 항상 같은 라인
                      <div key={artist.id} className="flex-1 flex flex-col">
                        {/* 순위 번호: 모든 막대 동일 상단 라인 */}
                        <div className="h-5 flex items-center justify-center shrink-0">
                          <span
                            className="text-[9px] font-bold select-none tabular-nums"
                            style={{ color: "rgba(255,255,255,0.50)" }}
                          >
                            {artist.rank}
                          </span>
                        </div>

                        {/* 막대 영역: 바닥 기준 절대 위치 */}
                        <div className="flex-1 relative">
                          <Link
                            href={`/kpop/${artist.id}`}
                            className="group absolute bottom-0 left-0 right-0"
                            style={{ height: barH }}
                            onMouseEnter={e => handleBarEnter(e, artist)}
                            onMouseLeave={() => setTooltip(null)}
                          >
                            {/* 막대 본체 */}
                            <div
                              className="absolute bottom-0 top-0 rounded-t-sm overflow-hidden flex flex-col justify-end items-center pb-1 transition-opacity group-hover:opacity-75"
                              style={{
                                width: `${barWidthPct}%`,
                                left: "50%",
                                transform: "translateX(-50%)",
                                background: getBarBackground(artist.rank, heightRatio),
                              }}
                            >
                              {/* 아티스트명: 막대 내부 하단, 세로 텍스트 (아래→위) */}
                              {showName && (
                                <span
                                  className="text-white/90 font-medium block"
                                  style={{
                                    writingMode: "vertical-rl",
                                    textOrientation: "mixed",
                                    transform: "rotate(180deg)",
                                    fontSize: 10,
                                    maxHeight: Math.max(barH - 8, 0),
                                    overflow: "hidden",
                                    whiteSpace: "nowrap",
                                    lineHeight: 1,
                                  }}
                                >
                                  {artist.name}
                                </span>
                              )}
                            </div>
                          </Link>
                        </div>
                      </div>
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
              style={{ backgroundColor: "rgba(15,15,18,0.9)" }}
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
              style={{ backgroundColor: "rgba(15,15,18,0.9)" }}
            >
              <ChevronRight className="w-4 h-4 text-foreground/60" />
            </button>
          )}
        </div>

        {/* 툴팁: overflow:hidden 컨테이너 밖 outerRef 기준 절대 위치 렌더링 */}
        {tooltip && (
          <div
            className="absolute pointer-events-none z-50"
            style={{
              left: tooltip.left,
              top: tooltip.top,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="bg-[#1c1c1f] border border-border/50 rounded-xl px-3 py-2 text-xs whitespace-nowrap shadow-xl">
              <p className="font-semibold text-foreground">{tooltip.artist.rank}. {tooltip.artist.name}</p>
              <p className="text-muted-foreground/70 mt-0.5">{formatListeners(tooltip.artist.listeners)} listeners</p>
            </div>
          </div>
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
