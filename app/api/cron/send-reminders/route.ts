import { NextResponse } from "next/server"
import { Resend } from "resend"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  type ReminderKind,
  type CalendarEventRow,
  buildSubject,
  buildHtml,
} from "@/lib/email/send-reminders"

export const maxDuration = 60
export const dynamic = "force-dynamic"

// isPro 판정 — plan_type 이 monthly/annual + subscription_status active, 또는 어드민.
// 결제 연동 완료 전까지는 호출만 하고 게이팅 차단은 비활성 상태 유지.
function checkIsPro(u: {
  plan_type: string | null
  subscription_status: string | null
  is_admin: boolean | null
}): boolean {
  if (u.is_admin) return true
  return (
    (u.plan_type === "monthly" || u.plan_type === "annual") &&
    u.subscription_status === "active"
  )
}

// UTC 기준 [target_day 00:00, +1day 00:00) 윈도우 — 정확히 그 날 발생 이벤트만
function utcDayWindow(daysFromToday: number): { from: string; to: string } {
  const now = new Date()
  const target = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromToday)
  )
  const next = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate() + 1)
  )
  return { from: target.toISOString(), to: next.toISOString() }
}

// 한 가지 kind 에 대해 처리: 윈도우 → 이벤트 → 구독자 → 발송 → sent 플래그
async function processKind(
  kind: ReminderKind,
  daysFromToday: number,
  resend: Resend,
  fromEmail: string,
  appUrl: string
): Promise<{ kind: ReminderKind; sent: number; failed: number; eventCount: number }> {
  const supabase = createSupabaseAdminClient()
  const { from, to } = utcDayWindow(daysFromToday)

  // 1. 해당 날짜 이벤트 목록
  const { data: events, error: evErr } = await supabase
    .from("hallyu_calendar_events")
    .select("id, title, artist_or_drama, event_date, event_time_label")
    .gte("event_date", from)
    .lt("event_date", to)

  if (evErr) {
    console.error(`[send-reminders ${kind}] events 조회 실패:`, evErr.message)
    return { kind, sent: 0, failed: 0, eventCount: 0 }
  }
  if (!events || events.length === 0) {
    return { kind, sent: 0, failed: 0, eventCount: 0 }
  }

  const remindCol = `remind_${kind}` as const
  const sentCol = `sent_${kind}` as const

  let sent = 0
  let failed = 0

  for (const ev of events as CalendarEventRow[]) {
    // 2. 해당 이벤트에 대해 알림 켰지만 아직 발송 안 한 구독자
    const { data: subs, error: subErr } = await supabase
      .from("user_calendar_subscriptions")
      .select(`id, user_id`)
      .eq("event_id", ev.id)
      .eq(remindCol, true)
      .eq(sentCol, false)
      .eq("notification_enabled", true)

    if (subErr) {
      console.error(`[send-reminders ${kind}] subs 조회 실패:`, subErr.message)
      continue
    }
    if (!subs || subs.length === 0) continue

    // 3. user_id 별 이메일 + 플랜 lookup — Pro 게이팅에 필요한 컬럼 포함
    const userIds = subs.map((s) => s.user_id)
    const { data: userRows, error: userErr } = await supabase
      .from("users")
      .select("id, email, plan_type, subscription_status, is_admin")
      .in("id", userIds)

    if (userErr) {
      console.error(`[send-reminders ${kind}] users 조회 실패:`, userErr.message)
      continue
    }

    const userMap = new Map(
      userRows?.map((u) => [
        u.id as string,
        {
          email: u.email as string,
          isPro: checkIsPro({
            plan_type: u.plan_type as string | null,
            subscription_status: u.subscription_status as string | null,
            is_admin: u.is_admin as boolean | null,
          }),
        },
      ]) ?? []
    )

    // 4. 발송 + sent 플래그 업데이트 (개별 처리 — 한 명 실패가 다른 이를 막지 않음)
    for (const sub of subs) {
      const user = userMap.get(sub.user_id)
      if (!user?.email) {
        failed += 1
        continue
      }

      // 결제 연동 후 아래 주석 해제 — Pro 전용 알림 게이팅 // 2026-05-16 임시 정책
      // if (!user.isPro) continue

      const email = user.email

      try {
        const { error: sendErr } = await resend.emails.send({
          from: fromEmail,
          to: email,
          subject: buildSubject(kind, ev.title),
          html: buildHtml(kind, ev, appUrl),
        })
        if (sendErr) {
          console.error(`[send-reminders ${kind}] resend 실패 (${email}):`, sendErr)
          failed += 1
          continue
        }

        const { error: updErr } = await supabase
          .from("user_calendar_subscriptions")
          .update({ [sentCol]: true })
          .eq("id", sub.id)
        if (updErr) {
          // 발송은 됐지만 플래그 업데이트 실패 — 다음 cron 에서 중복 발송 가능성
          console.error(`[send-reminders ${kind}] sent 플래그 update 실패:`, updErr.message)
        }
        sent += 1
      } catch (err) {
        console.error(`[send-reminders ${kind}] 예외 (${email}):`, err)
        failed += 1
      }
    }
  }

  return { kind, sent, failed, eventCount: events.length }
}

export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@unfoldk.com"
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://unfoldk.com"

  if (!apiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY 미설정" },
      { status: 500 }
    )
  }
  const resend = new Resend(apiKey)

  const t0 = Date.now()
  const branded = `HallyuCalendar <${fromEmail}>`

  const [d7, d1, dayof] = await Promise.all([
    processKind("d7", 7, resend, branded, appUrl),
    processKind("d1", 1, resend, branded, appUrl),
    processKind("dayof", 0, resend, branded, appUrl),
  ])

  const summary = {
    sent: d7.sent + d1.sent + dayof.sent,
    failed: d7.failed + d1.failed + dayof.failed,
  }
  const payload = {
    source: "send-reminders",
    elapsedMs: Date.now() - t0,
    summary,
    breakdown: { d7, d1, dayof },
  }

  await recordCronLog(
    "send-reminders",
    summary.failed > 0 && summary.sent === 0 ? "failed" : "success",
    payload
  )

  return NextResponse.json(payload)
}
