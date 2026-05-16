import { NextResponse } from "next/server"
import { z } from "zod"
import { Resend } from "resend"

// /api/early-access/notify — Early Access 알림 신청
//
// 흐름:
//   1. 입력 검증 (email + services[] + source)
//   2. 관리자 알림 메일 → support@unfoldk.com (신규 가입자 통보 + source 식별)
//   3. (선택) 사용자 환영 메일 — 도메인 verify 됐고 RESEND_API_KEY 있을 때만
//
// 보안:
//   - 비로그인 가능 (공개 폼)
//   - 단순 honeypot 없음 — 봇 트래픽 우려 시 후속 보강
//   - DB 미저장 (현 단계). 이메일 list 가 누적되면 별도 테이블 도입 검토.
//
// Resend 도메인 미verify 면 발송 실패. 그래도 사용자에게는 200 반환 (UX 우선).
// 콘솔 로그 남겨 운영자가 대시보드에서 추적 가능.

export const dynamic = "force-dynamic"

const BodySchema = z.object({
  email: z.string().trim().email().max(200),
  services: z.array(z.string().max(50)).max(10).default([]),
  source: z.string().trim().max(60).default("unknown"),
})

const TO_EMAIL = "support@unfoldk.com"
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "UnfoldK <noreply@unfoldk.com>"

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export async function POST(request: Request) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 })
  }
  const { email, services, source } = parsed.data

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // env 미설정 — 그래도 사용자에겐 성공 응답 (운영 부담 X). 콘솔에 로그.
    console.warn(
      `[early-access/notify] RESEND_API_KEY 미설정 — 미발송 ${email} (source=${source})`
    )
    return NextResponse.json({ ok: true, mailed: false })
  }

  const resend = new Resend(apiKey)
  const servicesLabel = services.length > 0 ? services.join(", ") : "(any service)"

  // 1) 관리자 알림 — 신규 가입자 즉시 통보
  const adminSubject = `[Early Access] New signup: ${email}`
  const adminHtml = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;background:#f5f5f5;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;">
    <h2 style="margin:0 0 16px;font-size:18px;">New Early Access signup</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:4px 0;color:#666;width:120px;">Email:</td><td><strong>${escapeHtml(email)}</strong></td></tr>
      <tr><td style="padding:4px 0;color:#666;">Interested in:</td><td>${escapeHtml(servicesLabel)}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">Source:</td><td><code>${escapeHtml(source)}</code></td></tr>
    </table>
    <p style="text-align:center;color:#999;font-size:12px;margin-top:16px;">unfoldk.com · Early Access notify</p>
  </div>
</body></html>`

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      subject: adminSubject,
      html: adminHtml,
      replyTo: email,
    })
  } catch (err) {
    console.error("[early-access/notify] admin 메일 발송 실패:", err)
    // 관리자 알림 실패해도 사용자에겐 성공으로 보임 — 사용자 입장 영향 X
  }

  // 2) 사용자 환영 메일 — 운영 단계에서 발송 (도메인 verify 가정).
  const userSubject = "You're on the UnfoldK Early Access list 🚀"
  const liveServices = "HallyuCalendar · KpopStats · Curation K"
  const upcomingServices = "KdramaMatch · HangeulGo · KfoodKit"
  const userHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#0d0d0f;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#e5e5e5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0f;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#141418;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:32px 32px 16px;">
          <div style="font-size:24px;font-weight:600;color:#ffffff;letter-spacing:-0.02em;">UnfoldK</div>
          <div style="height:2px;width:32px;background:#FF4B6E;margin-top:8px;"></div>
        </td></tr>
        <tr><td style="padding:0 32px 32px;">
          <h1 style="font-size:22px;font-weight:600;color:#ffffff;margin:16px 0 12px;line-height:1.3;">
            You're on the list 🚀
          </h1>
          <p style="font-size:15px;color:#b3b3b3;line-height:1.6;margin:0 0 20px;">
            Thanks for signing up for Early Access. We'll email you when each upcoming service launches.
          </p>
          <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:18px;margin:20px 0;">
            <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Live now</div>
            <div style="color:#ffffff;font-size:14px;line-height:1.6;">${escapeHtml(liveServices)}</div>
            <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin:12px 0 6px;">Coming soon</div>
            <div style="color:#ffffff;font-size:14px;line-height:1.6;">${escapeHtml(upcomingServices)}</div>
          </div>
          <p style="font-size:14px;color:#b3b3b3;line-height:1.6;margin:24px 0 0;">
            See what's already live at <a href="https://unfoldk.com" style="color:#FF4B6E;">unfoldk.com</a>.
          </p>
        </td></tr>
        <tr><td style="padding:24px 32px;border-top:1px solid #2a2a2a;font-size:12px;color:#666;text-align:center;">
          UnfoldK · unfoldk.com<br>
          You received this email because you signed up for Early Access.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: userSubject,
      html: userHtml,
    })
  } catch (err) {
    console.warn("[early-access/notify] 사용자 환영 메일 발송 실패 (무시):", err)
  }

  return NextResponse.json({ ok: true, mailed: true })
}
