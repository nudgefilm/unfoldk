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

export function KpopTop30Chart({ artists }: { artists: Top30Artist[] }) {
  const [page, setPage] = useState(0)

  const pages = [artists.slice(0, 15), artists.slice(15, 30)].filter(p => p.length > 0)
  const totalPages = pages.length

  if (totalPages === 0) return null

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

      {/* 차트 컨테이너 */}
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
                // items-end: 막대가 컨테이너 바닥에 붙어 위로 솟아오름
                className="flex items-end gap-1"
                style={{ width: `${100 / totalPages}%`, height: "100%", padding: "20px 12px 0" }}
              >
                {pageArtists.map(artist => {
                  const heightRatio = artist.listeners / pageMax
                  const barH = Math.max(heightRatio * MAX_BAR_HEIGHT, 4)
                  // 순위에 따라 너비 미세 감소 (1위: 100%, 30위: ~77%)
                  const barWidthPct = Math.max(70, 100 - (artist.rank - 1) * 0.8)
                  // 막대 높이가 36px 이상일 때만 이름 표시
                  const showName = barH >= 36

                  return (
                    <Link
                      key={artist.id}
                      href={`/kpop/${artist.id}`}
                      className="group relative flex-1"
                      style={{ height: barH }}
                    >
                      {/* 순위 번호: 막대 상단 바깥에 소형 표시 */}
                      <span
                        className="absolute left-0 right-0 text-center text-[8px] font-bold text-muted-foreground/40 tabular-nums select-none"
                        style={{ top: -16 }}
                      >
                        {artist.rank}
                      </span>

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
                            className="text-white/90 font-medium overflow-hidden block"
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

                      {/* 호버 툴팁 */}
                      <div
                        className="absolute left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20"
                        style={{ bottom: barH + 6 }}
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
