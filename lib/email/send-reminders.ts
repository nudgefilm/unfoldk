// 알림 이메일 템플릿 — send-reminders cron 에서 사용.
// 타입과 빌더 함수를 분리해 이메일 렌더링 로직을 독립적으로 테스트·수정 가능.

export type ReminderKind = "d7" | "d1" | "dayof"

export interface CalendarEventRow {
  id: string
  title: string
  artist_or_drama: string
  event_date: string
  event_time_label: string | null
}

export function buildSubject(kind: ReminderKind, title: string): string {
  const tail =
    kind === "d7" ? "is in 7 days!" : kind === "d1" ? "is tomorrow!" : "is today!"
  return `⏰ ${title} ${tail}`
}

export function buildHtml(
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
