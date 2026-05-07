import { NextResponse } from "next/server"
import { Resend } from "resend"
import { verifyCronAuth } from "@/lib/cron/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const maxDuration = 60
export const dynamic = "force-dynamic"

type ReminderKind = "d7" | "d1" | "dayof"

interface CalendarEventRow {
  id: string
  title: string
  artist_or_drama: string
  event_date: string
  event_time_label: string | null
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

function buildSubject(kind: ReminderKind, title: string): string {
  const tail =
    kind === "d7" ? "is in 7 days!" : kind === "d1" ? "is tomorrow!" : "is today!"
  return `⏰ ${title} ${tail}`
}

function buildHtml(
  kind: ReminderKind,
  ev: CalendarEventRow,
  appUrl: string
): string {
  const dateLabel = new Date(ev.event_date).toLocaleString("en-US", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
  const timeLabel = ev.event_time_label ?? "TBA"
  const headline =
    kind === "d7"
      ? "Coming up in 7 days"
      : kind === "d1"
      ? "Coming up tomorrow"
      : "Happening today"

  return `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#0d0d0f; color:#fff; margin:0; padding:24px;">
  <div style="max-width:520px; margin:0 auto; background:#141418; border-radius:16px; padding:32px;">
    <p style="color:#FF4B6E; font-weight:600; font-size:13px; letter-spacing:.04em; text-transform:uppercase; margin:0 0 8px;">${headline}</p>
    <h1 style="font-size:24px; line-height:1.3; margin:0 0 16px; color:#fff;">${ev.title}</h1>
    <p style="color:#a0a0a8; font-size:14px; margin:0 0 4px;">📅 ${dateLabel}</p>
    <p style="color:#a0a0a8; font-size:14px; margin:0 0 4px;">🕗 ${timeLabel}</p>
    <p style="color:#a0a0a8; font-size:14px; margin:0 0 24px;">🎤 ${ev.artist_or_drama}</p>
    <a href="${appUrl}/calendar" style="display:inline-block; background:#FF4B6E; color:#fff; text-decoration:none; padding:12px 24px; border-radius:999px; font-weight:500;">Open HallyuCalendar</a>
    <hr style="border:none; border-top:1px solid #2a2a2a; margin:32px 0 16px;" />
    <p style="color:#666; font-size:12px; margin:0;">You're receiving this because you turned on reminders on UnfoldK HallyuCalendar.<br/>Manage notifications: <a href="${appUrl}/mypage/settings" style="color:#FF4B6E;">${appUrl}/mypage/settings</a></p>
  </div>
</body></html>`
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

    // 3. user_id 별 이메일 lookup (auth.users 는 admin client 로 접근)
    const userIds = subs.map((s) => s.user_id)
    const { data: userRows, error: userErr } = await supabase
      .from("users")
      .select("id, email")
      .in("id", userIds)

    if (userErr) {
      console.error(`[send-reminders ${kind}] users 조회 실패:`, userErr.message)
      continue
    }
    const emailMap = new Map(userRows?.map((u) => [u.id, u.email]) ?? [])

    // 4. 발송 + sent 플래그 업데이트 (개별 처리 — 한 명 실패가 다른 이를 막지 않음)
    for (const sub of subs) {
      const email = emailMap.get(sub.user_id)
      if (!email) {
        failed += 1
        continue
      }

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

  return NextResponse.json({
    source: "send-reminders",
    elapsedMs: Date.now() - t0,
    summary: {
      sent: d7.sent + d1.sent + dayof.sent,
      failed: d7.failed + d1.failed + dayof.failed,
    },
    breakdown: { d7, d1, dayof },
  })
}
