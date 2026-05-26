import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { sendTrialD7Email, sendTrialD1Email } from "@/lib/email/send-trial-emails"

export const maxDuration = 60
export const dynamic = "force-dynamic"

// trial_ends_at ≤ now() + N일 이고 아직 해당 이메일 미발송인 유저 조회
// "≤ N일" 로 단순 처리 — 플래그 덕분에 중복 발송 없음
async function processKind(
  kind: "d7" | "d1",
  daysThreshold: number,
  sendFn: (input: { to: string; trialEndsAt: Date }) => Promise<{ ok: boolean }>
): Promise<{ sent: number; failed: number }> {
  const supabase = createSupabaseAdminClient()
  const threshold = new Date(Date.now() + daysThreshold * 24 * 60 * 60 * 1000)
  const sentCol = kind === "d7" ? "trial_d7_email_sent" : "trial_d1_email_sent"

  const { data: users, error } = await supabase
    .from("users")
    .select("id, email, trial_ends_at")
    .lte("trial_ends_at", threshold.toISOString())
    .gt("trial_ends_at", new Date().toISOString())   // 아직 만료 전
    .eq(sentCol, false)
    .not("trial_ends_at", "is", null)
    // paid 플랜은 trial 이메일 불필요
    .not("plan_type", "in", '("monthly","annual")')
    .limit(500)

  if (error) {
    console.error(`[trial-notifications/${kind}] 조회 실패:`, error.message)
    return { sent: 0, failed: 0 }
  }
  if (!users || users.length === 0) return { sent: 0, failed: 0 }

  let sent = 0
  let failed = 0

  for (const u of users) {
    if (!u.email || !u.trial_ends_at) { failed++; continue }

    const result = await sendFn({
      to: u.email as string,
      trialEndsAt: new Date(u.trial_ends_at as string),
    })

    if (!result.ok) { failed++; continue }

    const { error: updateErr } = await supabase
      .from("users")
      .update({ [sentCol]: true })
      .eq("id", u.id)

    if (updateErr) {
      console.error(`[trial-notifications/${kind}] 플래그 업데이트 실패:`, updateErr.message)
    }
    sent++
  }

  return { sent, failed }
}

export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  const t0 = Date.now()

  const [d7, d1] = await Promise.all([
    processKind("d7", 7, sendTrialD7Email),
    processKind("d1", 1, sendTrialD1Email),
  ])

  const summary = { sent: d7.sent + d1.sent, failed: d7.failed + d1.failed }
  const payload = { source: "trial-notifications", elapsedMs: Date.now() - t0, summary, breakdown: { d7, d1 } }

  await recordCronLog(
    "trial-notifications",
    summary.failed > 0 && summary.sent === 0 ? "failed" : "success",
    payload
  )

  return NextResponse.json(payload)
}
