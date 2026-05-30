"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { StartModal } from "@/components/start-modal"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

// "Track this artist" 버튼 — KpopStats 상세 페이지의 client island.
//
// 상태 머신:
//   tracking=null (로딩) → 비활성 + "Track this artist" 라벨
//   tracking=false       → 활성 "Track this artist" (브랜드 컬러 채움)
//   tracking=true        → 활성 "Tracking ✓"        (브랜드 컬러 outline)
//
// 클릭 처리:
//   비로그인          → StartModal 인플레이스 오픈 (ReportButton 패턴)
//   로그인 + 미구독   → POST /api/kpop/artists/[id]/track → 토스트
//   로그인 + 구독 중  → DELETE … → 토스트
//
// 매칭 이벤트 0건 케이스 (POST trackedCount=0) — tracking=true 로 안 바꾸고
// "아직 미래 이벤트 없음" 안내. 사용자가 의미 없는 "Tracking ✓" 상태로
// 들어가는 것 방지.

export function TrackArtistButton({
  artistId,
  artistName,
  isPro,
}: {
  artistId: string
  artistName: string
  isPro: boolean
}) {
  const { toast } = useToast()
  const [tracking, setTracking] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [startModalOpen, setStartModalOpen] = useState(false)
  const [pendingNext, setPendingNext] = useState<string | undefined>(undefined)

  // Pro 유저만 tracking 상태 fetch
  useEffect(() => {
    if (!isPro) return
    let cancelled = false
    ;(async () => {
      const supabase = createSupabaseBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setTracking(false)
        return
      }
      try {
        const res = await fetch(`/api/kpop/artists/${artistId}/track`)
        if (!res.ok) {
          if (!cancelled) setTracking(false)
          return
        }
        const body = (await res.json()) as { tracking?: boolean }
        if (!cancelled) setTracking(!!body.tracking)
      } catch {
        if (!cancelled) setTracking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [artistId, isPro])

  const handleClick = async () => {
    const supabase = createSupabaseBrowserClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setPendingNext(
        typeof window !== "undefined" ? window.location.pathname : "/"
      )
      setStartModalOpen(true)
      return
    }
    if (submitting || tracking === null) return

    setSubmitting(true)
    try {
      const method = tracking ? "DELETE" : "POST"
      const res = await fetch(`/api/kpop/artists/${artistId}/track`, { method })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        trackedCount?: number
      }

      if (!res.ok) {
        toast({
          title: "Couldn't update tracking",
          description: body.error ?? "Please try again.",
        })
        return
      }

      if (tracking) {
        setTracking(false)
        toast({ title: `Stopped tracking ${artistName}` })
      } else {
        const count = typeof body.trackedCount === "number" ? body.trackedCount : 0
        if (count === 0) {
          // 미래 매칭 이벤트 0건 — tracking 상태 그대로 유지
          toast({
            title: `No upcoming events for ${artistName} yet`,
            description: "Check back when new comebacks or shows are scheduled.",
          })
        } else {
          setTracking(true)
          toast({
            title: `Now tracking ${artistName} — you'll get calendar reminders`,
            description: `Subscribed to ${count} event${count === 1 ? "" : "s"}`,
          })
        }
      }
    } catch (err) {
      toast({
        title: "Network error",
        description: err instanceof Error ? err.message : "Please try again.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Pro 아닌 유저 — "Get notified with Hallyu Pass" 즉시 렌더
  if (!isPro) {
    return (
      <div className="flex-shrink-0">
        <Link href="/signup">
          <Button
            className="px-6 py-2 rounded-full font-medium whitespace-nowrap"
            style={{ backgroundColor: "#FF4B6E", color: "white" }}
          >
            Get notified with Hallyu Pass
          </Button>
        </Link>
      </div>
    )
  }

  const label = tracking ? "Tracking ✓" : "Track this artist"
  const disabled = submitting || tracking === null

  return (
    <div className="flex-shrink-0">
      <Button
        onClick={handleClick}
        disabled={disabled}
        aria-pressed={!!tracking}
        className="px-6 py-2 rounded-full font-medium whitespace-nowrap transition-colors"
        style={
          tracking
            ? {
                backgroundColor: "rgba(255, 75, 110, 0.15)",
                color: "#FF4B6E",
                border: "1px solid #FF4B6E",
              }
            : { backgroundColor: "#FF4B6E", color: "white" }
        }
      >
        {submitting ? "..." : label}
      </Button>
      <StartModal
        open={startModalOpen}
        onOpenChange={setStartModalOpen}
        next={pendingNext}
      />
    </div>
  )
}
