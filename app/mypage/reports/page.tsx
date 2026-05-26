"use client"

// /mypage/reports — 주간 한류 리포트 아카이브 (Pro 전용)
//
// Pro: 최신 10개 weekly_reports 섹션별 카드 렌더링
// Free/비로그인: "Coming with Hallyu Pass" 잠금 오버레이

import { useEffect, useState } from "react"
import Link from "next/link"
import { Lock, ArrowRight, Newspaper, ChevronRight } from "lucide-react"
import { MypageShell } from "@/components/mypage/mypage-shell"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { hasProAccess } from "@/lib/auth/plan"
import type { WeeklyReportContent, WeeklyReportRow } from "@/lib/claude/weekly-report"

// 섹션 순서 + 아이콘 이모지 매핑
const SECTION_META: Array<{
  key: keyof Omit<WeeklyReportContent, "week_start" | "headline">
  emoji: string
}> = [
  { key: "comebacks", emoji: "🎵" },
  { key: "dramas",    emoji: "🎬" },
  { key: "korean",    emoji: "🇰🇷" },
  { key: "food",      emoji: "🍜" },
  { key: "travel",    emoji: "🗺️" },
  { key: "trends",    emoji: "📈" },
  { key: "preview",   emoji: "📅" },
]

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00Z")
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
}

function ReportCard({ report }: { report: WeeklyReportRow }) {
  const c = report.content_json
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-border/40 rounded-2xl overflow-hidden bg-[rgba(231,236,235,0.04)]">
      {/* 헤더 */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
      >
        <div>
          <p className="text-xs text-muted-foreground mb-1">
            Week of {formatWeekLabel(report.week_start)}
          </p>
          <p className="text-foreground font-semibold text-base leading-snug">{c.headline}</p>
        </div>
        <ChevronRight
          className={`w-5 h-5 text-muted-foreground flex-shrink-0 ml-4 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {/* 섹션 카드 목록 */}
      {expanded && (
        <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-border/30 pt-4">
          {SECTION_META.map(({ key, emoji }) => {
            const section = c[key]
            if (!section) return null
            return (
              <div
                key={key}
                className="rounded-xl border border-border/30 bg-[rgba(231,236,235,0.06)] p-4 flex flex-col gap-2"
              >
                <p className="text-sm font-medium text-foreground">
                  {emoji} {section.title}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
                <Link
                  href={section.href}
                  className="flex items-center gap-1 text-xs mt-auto pt-1"
                  style={{ color: "#FF4B6E" }}
                >
                  {section.cta}
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ReportsBody() {
  const [isPro, setIsPro] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<WeeklyReportRow[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from("users")
        .select("plan_type, is_admin, trial_ends_at")
        .eq("id", user.id)
        .maybeSingle()
      const row = data as { plan_type?: string | null; is_admin?: boolean | null; trial_ends_at?: string | null } | null
      const pro = hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin, trialEndsAt: row?.trial_ends_at })
      setIsPro(pro)
      setLoading(false)

      if (pro) {
        setReportsLoading(true)
        const { data: rows, error: reportsErr } = await supabase
          .from("weekly_reports")
          .select("id, week_start, content_json, created_at")
          .order("week_start", { ascending: false })
          .limit(10)
        if (reportsErr) {
          console.error("[mypage/reports] weekly_reports 조회 실패:", reportsErr.message, reportsErr.code)
          setFetchError(reportsErr.message)
        } else {
          setReports((rows ?? []) as WeeklyReportRow[])
        }
        setReportsLoading(false)
      }
    })
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-muted/20 animate-pulse" />
        ))}
      </div>
    )
  }

  // Free 유저 — 잠금 오버레이
  if (!isPro) {
    return (
      <div className="relative">
        {/* 더미 블러 카드 3개 */}
        <div className="flex flex-col gap-4 blur-sm pointer-events-none select-none" aria-hidden>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border border-border/40 rounded-2xl p-6 bg-[rgba(231,236,235,0.04)]">
              <div className="h-3 w-24 bg-muted/30 rounded mb-3" />
              <div className="h-5 w-3/4 bg-muted/30 rounded" />
            </div>
          ))}
        </div>
        {/* 잠금 오버레이 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-[#1a1a1a] border border-border/50 rounded-2xl p-8 text-center shadow-2xl max-w-sm mx-4">
            <Lock className="w-7 h-7 mx-auto mb-3" style={{ color: "#FF4B6E" }} />
            <p className="text-foreground font-semibold text-lg mb-2">Coming with Hallyu Pass</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Get your weekly Hallyu digest — K-pop comebacks, trending dramas, a Korean expression, K-food pick, travel tip, and more. Every Monday.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Pro 유저 — 리포트 목록
  if (reportsLoading) {
    return (
      <div className="flex flex-col gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-muted/20 animate-pulse" />
        ))}
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Newspaper className="w-10 h-10 text-muted-foreground mb-4" />
        <p className="text-foreground font-medium mb-2">Could not load reports</p>
        <p className="text-muted-foreground text-sm">Please try refreshing the page.</p>
      </div>
    )
  }

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Newspaper className="w-10 h-10 text-muted-foreground mb-4" />
        <p className="text-foreground font-medium mb-2">No reports yet</p>
        <p className="text-muted-foreground text-sm">
          Your first weekly Hallyu digest will arrive this Monday.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {reports.map((r) => (
        <ReportCard key={r.id} report={r} />
      ))}
    </div>
  )
}

export default function WeeklyReportsPage() {
  return (
    <MypageShell activeLabel="Weekly Reports">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-foreground text-2xl font-semibold mb-1">Weekly Reports</h1>
          <p className="text-muted-foreground text-sm">
            Your Monday Hallyu digest — 7 sections, 5-minute read.
          </p>
        </div>
        <ReportsBody />
      </div>
    </MypageShell>
  )
}
