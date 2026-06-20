"use client"

// /mypage/hallyu-pass — Hallyu Pass 전용 대시보드
//
// 접근 제어:
//   - 비로그인    → MypageShell 이 / 로 redirect
//   - Free 유저   → 전체 blur + 업그레이드 overlay
//   - Pro 유저    → 정상 접근 (trial 포함)
//
// 섹션 구성 (placeholder):
//   1. 헤더 — 구독 상태 + 다음 갱신일
//   2. 아티스트 위클리 리포트 + 한류 루틴 (2-column)
//   3. 컴백 가이드
//   4. 월간 한류 트렌드 리포트

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Crown, Music, CalendarDays, Sparkles, TrendingUp } from "lucide-react"
import { MypageShell } from "@/components/mypage/mypage-shell"
import { HallyuPassExclusiveBanner } from "@/components/mypage/hallyu-pass-exclusive-banner"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { hasProAccess, isInTrial } from "@/lib/auth/plan"

interface PageData {
  isPro: boolean
  isTrial: boolean
  trialEndsAt: string | null
  nextRenewal: string | null
}

export default function HallyuPassPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [pageData, setPageData] = useState<PageData>({
    isPro: false,
    isTrial: false,
    trialEndsAt: null,
    nextRenewal: null,
  })

  useEffect(() => {
    let cancelled = false
    const supabase = createSupabaseBrowserClient()

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace("/")
        return
      }

      const [profileResult, subResult] = await Promise.all([
        supabase
          .from("users")
          .select("plan_type, trial_ends_at, is_admin")
          .eq("id", user.id)
          .single(),
        supabase
          .from("subscriptions")
          .select("expires_at")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("expires_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      if (cancelled) return

      const profile = profileResult.data as {
        plan_type?: string
        trial_ends_at?: string | null
        is_admin?: boolean
      } | null

      const planType = profile?.plan_type ?? null
      const trialEndsAt = profile?.trial_ends_at ?? null
      const isAdmin = profile?.is_admin ?? false
      const isPro = hasProAccess({ planType, trialEndsAt, isAdmin })
      const isTrial = isInTrial(trialEndsAt)

      const subExpiry = (subResult.data as { expires_at?: string } | null)?.expires_at
      const nextRenewal = subExpiry
        ? new Date(subExpiry).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : null

      setPageData({ isPro, isTrial, trialEndsAt, nextRenewal })
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [router])

  const { isPro, isTrial, trialEndsAt, nextRenewal } = pageData

  const statusLine = (() => {
    if (!isPro) return null
    if (isTrial && trialEndsAt) {
      const formatted = new Date(trialEndsAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
      return `Trial active · Ends ${formatted}`
    }
    if (nextRenewal) return `Active · Next renewal ${nextRenewal}`
    return "Active"
  })()

  return (
    <MypageShell activeLabel="Hallyu Pass">
      {loading ? null : (
        <div className="relative">
          {/* Non-Pro 블러 + 업그레이드 오버레이 */}
          {!isPro && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl px-6 text-center"
              style={{
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                backgroundColor: "rgba(13,13,15,0.75)",
              }}
            >
              <Crown className="w-12 h-12 mb-4" style={{ color: "#FF4B6E" }} />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Hallyu Pass Members Only
              </h2>
              <p className="text-muted-foreground text-sm mb-6 max-w-[280px]">
                Upgrade to Hallyu Pass to unlock weekly artist reports, comeback guides, and monthly
                trend reports.
              </p>
              <Link
                href="/mypage/subscription"
                className="px-6 py-2.5 rounded-full font-medium text-white text-sm"
                style={{ backgroundColor: "#FF4B6E" }}
              >
                Get Hallyu Pass
              </Link>
            </div>
          )}

          <div
            className={`space-y-6 ${!isPro ? "blur-sm pointer-events-none select-none" : ""}`}
          >
            {/* 헤더 — 구독 상태 */}
            <div
              className="rounded-2xl border border-white/10 p-6"
              style={{ background: "rgba(231,236,235,0.05)" }}
            >
              <div className="flex items-center gap-3 mb-1">
                <Crown className="w-6 h-6" style={{ color: "#FF4B6E" }} />
                <h1 className="text-2xl font-semibold text-foreground">Hallyu Pass</h1>
              </div>
              {statusLine && (
                <p className="text-muted-foreground text-sm mt-1">{statusLine}</p>
              )}
            </div>

            {/* 서비스 안내 박스 (공통 컴포넌트) */}
            <HallyuPassExclusiveBanner />

            {/* 2-column 섹션 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 아티스트 위클리 리포트 */}
              <div
                className="rounded-2xl border border-white/10 p-6 min-h-[200px] flex flex-col"
                style={{ background: "rgba(231,236,235,0.05)" }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Music className="w-5 h-5 text-muted-foreground" />
                  <h2 className="text-base font-semibold text-foreground">
                    This Week&apos;s Artist Reports
                  </h2>
                </div>
                <p className="text-muted-foreground text-sm flex-1 flex items-center">
                  Coming soon
                </p>
              </div>

              {/* 한류 루틴 */}
              <div
                className="rounded-2xl border border-white/10 p-6 min-h-[200px] flex flex-col"
                style={{ background: "rgba(231,236,235,0.05)" }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="w-5 h-5 text-muted-foreground" />
                  <h2 className="text-base font-semibold text-foreground">My Hallyu Routine</h2>
                </div>
                <p className="text-muted-foreground text-sm flex-1 flex items-center">
                  Coming soon
                </p>
              </div>
            </div>

            {/* 컴백 가이드 */}
            <div
              className="rounded-2xl border border-white/10 p-6 min-h-[160px] flex flex-col"
              style={{ background: "rgba(231,236,235,0.05)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground">Comeback Guide</h2>
              </div>
              <p className="text-muted-foreground text-sm flex-1 flex items-center">
                Coming soon
              </p>
            </div>

            {/* 월간 한류 트렌드 리포트 */}
            <div
              className="rounded-2xl border border-white/10 p-6 min-h-[160px] flex flex-col"
              style={{ background: "rgba(231,236,235,0.05)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground">
                  Monthly Hallyu Trend Report
                </h2>
              </div>
              <p className="text-muted-foreground text-sm flex-1 flex items-center">
                Coming soon
              </p>
            </div>
          </div>
        </div>
      )}
    </MypageShell>
  )
}
