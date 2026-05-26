import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { sendTrialEndedEmail } from "@/lib/email/send-trial-emails"

export const maxDuration = 60
export const dynamic = "force-dynamic"

// trial_ends_at < now() 이고 "ended" 이메일 미발송인 유저에게 만료 알림 발송.
// plan_type 은 변경 불필요 — 이미 free 이며 hasProAccess() 가 trial_ends_at 기준으로 판별.
export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  const supabase = createSupabaseAdminClient()
  const t0 = Date.now()

  const { data: users, error } = await supabase
    .from("users")
    .select("id, email")
    .lt("trial_ends_at", new Date().toISOString())
    .eq("trial_ended_email_sent", false)
    .not("trial_ends_at", "is", null)
    .not("plan_type", "in", '("monthly","annual")')
    .limit(500)

  if (error) {
    console.error("[expire-trials] 조회 실패:", error.message)
    const payload = { source: "expire-trials", error: error.message }
    await recordCronLog("expire-trials", "failed", payload)
    return NextResponse.json(payload, { status: 500 })
  }

  let sent = 0
  let failed = 0

  for (const u of users ?? []) {
    if (!u.email) { failed++; continue }

    const result = await sendTrialEndedEmail({ to: u.email as string })
    if (!result.ok) { failed++; continue }

    const { error: updateErr } = await supabase
      .from("users")
      .update({ trial_ended_email_sent: true })
      .eq("id", u.id)

    if (updateErr) {
      console.error("[expire-trials] 플래그 업데이트 실패:", updateErr.message)
    }
    sent++
  }

  const summary = { sent, failed, total: (users ?? []).length }
  const payload = { source: "expire-trials", elapsedMs: Date.now() - t0, summary }

  await recordCronLog(
    "expire-trials",
    failed > 0 && sent === 0 ? "failed" : "success",
    payload
  )

  return NextResponse.json(payload)
}
