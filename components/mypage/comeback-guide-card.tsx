"use client"

// ComebackGuideCard — Hallyu Pass 전용
// 유저 추적 아티스트의 향후 14일 이내 컴백 가이드 표시.
// release_date(UTC)를 유저 로컬 시간 + KST 병기로 표시.
// D-7 이내는 브랜드 컬러 보더 강조.

import { useEffect, useState } from "react"
import Link from "next/link"
import { Sparkles, ExternalLink } from "lucide-react"

interface GuideData {
  id: string
  artist_id: string
  artist_name: string
  event_id: string | null
  release_date: string  // ISO UTC string
  guide_content: string
}

// UTC ISO → 지정 timezone 포맷 문자열
function formatTz(isoStr: string, tz: string): string {
  return new Date(isoStr).toLocaleString("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

// D-Day 계산 (양수 = 미래)
function getDDay(isoStr: string): number {
  const diffMs = new Date(isoStr).getTime() - Date.now()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

function DDayLabel({ dday }: { dday: number }) {
  if (dday <= 0) return <span className="text-xs font-semibold" style={{ color: "#FF4B6E" }}>Today</span>
  if (dday === 1) return <span className="text-xs font-semibold" style={{ color: "#FF4B6E" }}>Tomorrow</span>
  return (
    <span
      className="text-xs font-semibold"
      style={{ color: dday <= 7 ? "#FF4B6E" : "#888" }}
    >
      D-{dday}
    </span>
  )
}

export function ComebackGuideCard() {
  const [loading, setLoading] = useState(true)
  const [guides, setGuides] = useState<GuideData[]>([])
  const [userTz, setUserTz] = useState("UTC")

  useEffect(() => {
    // 브라우저 타임존 감지
    setUserTz(Intl.DateTimeFormat().resolvedOptions().timeZone)

    fetch("/api/hallyu-pass/comeback-guides")
      .then((r) => r.json())
      .then((data: { guides?: GuideData[] }) => setGuides(data.guides ?? []))
      .catch(() => setGuides([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div
      className="rounded-2xl border border-white/10 p-6 flex flex-col min-h-[160px]"
      style={{ background: "rgba(231,236,235,0.05)" }}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">Comeback Guide</h2>
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div
            className="w-5 h-5 rounded-full border-2 animate-spin"
            style={{
              borderColor: "rgba(255,75,110,0.4)",
              borderTopColor: "transparent",
            }}
          />
        </div>
      )}

      {/* 예정 컴백 없음 */}
      {!loading && guides.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-4">
          <p className="text-muted-foreground text-sm">
            No upcoming comebacks from your tracked artists.
          </p>
          <Link
            href="/kpop"
            className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline transition-colors"
            style={{ color: "#FF4B6E" }}
          >
            Track artists in KpopStats
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* 가이드 목록 */}
      {!loading && guides.length > 0 && (
        <div className="space-y-4">
          {guides.map((guide) => {
            const dday = getDDay(guide.release_date)
            const isUrgent = dday <= 7
            const localTime = formatTz(guide.release_date, userTz)
            const kstTime = formatTz(guide.release_date, "Asia/Seoul")
            const showKst = userTz !== "Asia/Seoul"

            if (isUrgent) {
              // D-7 이내 히어로 스타일
              return (
                <div
                  key={guide.id}
                  className="rounded-xl border overflow-hidden"
                  style={{
                    borderColor: "rgba(255,75,110,0.4)",
                    background: "linear-gradient(135deg, rgba(255,75,110,0.10) 0%, rgba(255,75,110,0.04) 100%)",
                  }}
                >
                  {/* 히어로 상단 — D-Day 카운트다운 */}
                  <div
                    className="flex items-center justify-between px-4 py-3 border-b"
                    style={{ borderColor: "rgba(255,75,110,0.2)" }}
                  >
                    <Link
                      href={`/kpop/${guide.artist_id}`}
                      className="text-sm font-bold text-foreground hover:text-white hover:underline transition-colors"
                    >
                      {guide.artist_name}
                    </Link>
                    {/* 대형 D-Day 표시 */}
                    <div className="flex flex-col items-end">
                      <span
                        className="text-2xl font-black leading-none"
                        style={{ color: "#FF4B6E" }}
                      >
                        {dday <= 0 ? "TODAY" : dday === 1 ? "D-1" : `D-${dday}`}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 mt-0.5">COMEBACK</span>
                    </div>
                  </div>

                  {/* 발매 시각 + 가이드 */}
                  <div className="px-4 py-3 space-y-2">
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        <span className="text-foreground/70">Release:</span> {localTime}
                        {userTz !== "UTC" && (
                          <span className="ml-1 text-muted-foreground/60">
                            ({userTz.replace(/_/g, " ")})
                          </span>
                        )}
                      </p>
                      {showKst && (
                        <p className="text-xs text-muted-foreground/60">{kstTime} KST</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {guide.guide_content}
                    </p>
                  </div>
                </div>
              )
            }

            // 일반 카드 (D-8 이상)
            return (
              <div
                key={guide.id}
                className="rounded-xl p-4 border"
                style={{
                  borderColor: "rgba(255,255,255,0.08)",
                  background: "transparent",
                }}
              >
                <div className="flex items-center justify-between mb-2 gap-2">
                  <Link
                    href={`/kpop/${guide.artist_id}`}
                    className="text-sm font-semibold text-foreground hover:text-white hover:underline transition-colors"
                  >
                    {guide.artist_name}
                  </Link>
                  <DDayLabel dday={dday} />
                </div>

                <div className="mb-3 space-y-0.5">
                  <p className="text-xs text-muted-foreground">
                    <span className="text-foreground/70">Release:</span> {localTime}
                    {userTz !== "UTC" && (
                      <span className="ml-1 text-muted-foreground/60">
                        ({userTz.replace(/_/g, " ")})
                      </span>
                    )}
                  </p>
                  {showKst && (
                    <p className="text-xs text-muted-foreground/60">{kstTime} KST</p>
                  )}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {guide.guide_content}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
