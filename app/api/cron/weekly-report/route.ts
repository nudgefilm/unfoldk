import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import {
  generateWeeklyReport,
  saveWeeklyReport,
  getWeeklyReport,
  WeeklyReportError,
} from "@/lib/claude/weekly-report"

// Vercel Cron — vercel.json 매주 월요일 09:00 UTC.
//
// 응답 코드:
//   200 — 완료 (저장 성공) 또는 멱등 skip (이미 생성된 주차)
//   401 — CRON_SECRET 미일치
//   500 — Claude API 실패 또는 DB 저장 실패
//
// maxDuration — Haiku 응답 + DB 쓰기 합쳐 30s 면 충분. 60s 마진.

export const maxDuration = 60
export const dynamic = "force-dynamic"

// 해당 주 월요일 날짜 계산 (UTC 기준)
function getWeekStart(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  const now = new Date()
  const weekStart = getWeekStart(now)

  try {
    // 1. 멱등성 — 이번 주 리포트가 이미 존재하면 skip
    const existing = await getWeeklyReport(weekStart)
    if (existing) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        week_start: weekStart,
        note: "이미 생성된 주차 — skip",
      })
    }

    // 2. Claude Haiku 로 리포트 생성
    const content = await generateWeeklyReport(now)

    // 3. DB 저장
    const row = await saveWeeklyReport(content)

    // 4. Pro 유저 이메일 발송 (결제 연동 후 아래 주석 해제) // 2026-05-16 임시 정책
    // await sendWeeklyReportToProUsers(row)

    return NextResponse.json({
      ok: true,
      week_start: weekStart,
      report_id: row.id,
      headline: content.headline,
    })
  } catch (err) {
    const msg =
      err instanceof WeeklyReportError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err)
    console.error("[cron/weekly-report] 실패:", msg)
    return NextResponse.json({ ok: false, week_start: weekStart, error: msg }, { status: 500 })
  }
}
