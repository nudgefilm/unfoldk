// Trial 관련 이메일 4종 — Resend 사용
// 디자인: dark 배경 #0d0d0f / 핑크 포인트 #FF4B6E (기존 UnfoldK 템플릿 동일)

import { Resend } from "resend"

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "UnfoldK <noreply@unfoldk.com>"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://unfoldk.com"
const PRICING_URL = `${APP_URL}/pricing`

interface SendResult {
  ok: boolean
  error?: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function emailShell(innerHtml: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#0d0d0f;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#e5e5e5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#141418;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 16px;">
              <div style="font-size:24px;font-weight:600;color:#ffffff;letter-spacing:-0.02em;">UnfoldK</div>
              <div style="height:2px;width:32px;background:#FF4B6E;margin-top:8px;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              ${innerHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #2a2a2a;font-size:12px;color:#666;text-align:center;">
              UnfoldK · unfoldk.com<br>
              You received this email because you have an active trial on UnfoldK.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body></html>`
}

function ctaButton(label: string, href: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:8px 0 24px;">
        <a href="${href}" style="display:inline-block;padding:14px 28px;background:#FF4B6E;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;">${label}</a>
      </td>
    </tr>
  </table>`
}

// ── 1. 가입 직후 "Trial 시작" 이메일 ──────────────────────────────────────

export async function sendTrialStartedEmail(input: {
  to: string
  trialEndsAt: Date
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn("[email/trial] RESEND_API_KEY 미설정 — skip")
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const expiresLabel = input.trialEndsAt.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  })

  const subject = "Your 30-day free trial has started 🎉"
  const inner = `
    <h1 style="font-size:22px;font-weight:600;color:#ffffff;margin:16px 0 12px;line-height:1.3;">
      Welcome to your free trial!
    </h1>
    <p style="font-size:15px;color:#b3b3b3;line-height:1.6;margin:0 0 20px;">
      Your 30-day Hallyu Pass trial is now active. Enjoy full access to all 5 services — HallyuCalendar, KpopStats, KdramaMatch, HangeulGo, and KfoodKit.
    </p>
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
      <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Trial expires on</div>
      <div style="font-size:22px;font-weight:700;color:#FF4B6E;">${escapeHtml(expiresLabel)}</div>
    </div>
    <h2 style="font-size:14px;font-weight:600;color:#ffffff;margin:24px 0 8px;text-transform:uppercase;letter-spacing:0.05em;">What's included</h2>
    <ul style="font-size:14px;color:#b3b3b3;line-height:1.8;padding-left:20px;margin:0 0 20px;">
      <li>📅 HallyuCalendar — Unlimited event tracking &amp; reminders</li>
      <li>🎵 KpopStats — Full chart access &amp; artist stats</li>
      <li>🎬 KdramaMatch — Unlimited UnfoldK recommendations</li>
      <li>🇰🇷 HangeulGo — All Korean learning features</li>
      <li>🍜 KfoodKit — Full recipe &amp; ingredient access</li>
    </ul>
    ${ctaButton("Explore now", APP_URL)}
  `

  const html = emailShell(inner)
  const text = `Welcome to your 30-day free trial!\n\nYour Hallyu Pass trial is now active until ${expiresLabel}.\n\nEnjoy full access at ${APP_URL}`

  try {
    const resend = new Resend(apiKey)
    const result = await resend.emails.send({ from: FROM_EMAIL, to: input.to, subject, html, text })
    if (result.error) {
      console.error("[email/trial/started] 발송 실패:", result.error)
      return { ok: false, error: result.error.message }
    }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[email/trial/started] 예외:", msg)
    return { ok: false, error: msg }
  }
}

// ── 2. 만료 7일 전 ────────────────────────────────────────────────────────

export async function sendTrialD7Email(input: {
  to: string
  trialEndsAt: Date
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not configured" }

  const expiresLabel = input.trialEndsAt.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  })

  const subject = "Your free trial ends in 7 days"
  const inner = `
    <h1 style="font-size:22px;font-weight:600;color:#ffffff;margin:16px 0 12px;line-height:1.3;">
      7 days left in your trial
    </h1>
    <p style="font-size:15px;color:#b3b3b3;line-height:1.6;margin:0 0 20px;">
      Your Hallyu Pass free trial expires on <strong style="color:#ffffff;">${escapeHtml(expiresLabel)}</strong>. Upgrade now to keep unlimited access to all 5 K-content services.
    </p>
    <div style="background:#1a1a1a;border:1px solid #FF4B6E;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
      <div style="font-size:13px;color:#FF4B6E;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Trial ends on</div>
      <div style="font-size:20px;font-weight:700;color:#ffffff;margin-top:4px;">${escapeHtml(expiresLabel)}</div>
    </div>
    <p style="font-size:14px;color:#b3b3b3;line-height:1.6;margin:0 0 20px;">
      Hallyu Pass is <strong style="color:#ffffff;">$15/month</strong> or <strong style="color:#ffffff;">$120/year</strong> (save 33%). Cancel anytime.
    </p>
    ${ctaButton("Upgrade to Hallyu Pass", PRICING_URL)}
  `

  const html = emailShell(inner)
  const text = `Your free trial ends in 7 days (${expiresLabel}).\n\nUpgrade at ${PRICING_URL} to keep access.`

  try {
    const resend = new Resend(apiKey)
    const result = await resend.emails.send({ from: FROM_EMAIL, to: input.to, subject, html, text })
    if (result.error) {
      console.error("[email/trial/d7] 발송 실패:", result.error)
      return { ok: false, error: result.error.message }
    }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[email/trial/d7] 예외:", msg)
    return { ok: false, error: msg }
  }
}

// ── 3. 만료 1일 전 ────────────────────────────────────────────────────────

export async function sendTrialD1Email(input: {
  to: string
  trialEndsAt: Date
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not configured" }

  const expiresLabel = input.trialEndsAt.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  })

  const subject = "⏰ Your free trial ends tomorrow"
  const inner = `
    <p style="color:#FF4B6E;font-weight:600;font-size:13px;letter-spacing:.04em;text-transform:uppercase;margin:16px 0 8px;">Last chance</p>
    <h1 style="font-size:22px;font-weight:600;color:#ffffff;margin:0 0 12px;line-height:1.3;">
      Your trial ends tomorrow
    </h1>
    <p style="font-size:15px;color:#b3b3b3;line-height:1.6;margin:0 0 20px;">
      Your Hallyu Pass trial expires on <strong style="color:#ffffff;">${escapeHtml(expiresLabel)}</strong>. After that, you'll lose access to Pro features. Upgrade today to keep everything uninterrupted.
    </p>
    <p style="font-size:14px;color:#b3b3b3;line-height:1.6;margin:0 0 20px;">
      Hallyu Pass is <strong style="color:#ffffff;">$15/month</strong> or <strong style="color:#ffffff;">$120/year</strong>. Cancel anytime.
    </p>
    ${ctaButton("Upgrade now — keep your access", PRICING_URL)}
  `

  const html = emailShell(inner)
  const text = `Your free trial ends tomorrow (${expiresLabel}).\n\nUpgrade now at ${PRICING_URL}`

  try {
    const resend = new Resend(apiKey)
    const result = await resend.emails.send({ from: FROM_EMAIL, to: input.to, subject, html, text })
    if (result.error) {
      console.error("[email/trial/d1] 발송 실패:", result.error)
      return { ok: false, error: result.error.message }
    }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[email/trial/d1] 예외:", msg)
    return { ok: false, error: msg }
  }
}

// ── 4. 만료 당일 "Trial 종료" 이메일 ─────────────────────────────────────

export async function sendTrialEndedEmail(input: {
  to: string
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not configured" }

  const subject = "Your free trial has ended — upgrade to continue"
  const inner = `
    <h1 style="font-size:22px;font-weight:600;color:#ffffff;margin:16px 0 12px;line-height:1.3;">
      Your trial has ended
    </h1>
    <p style="font-size:15px;color:#b3b3b3;line-height:1.6;margin:0 0 20px;">
      Your 30-day Hallyu Pass trial has expired. You've been moved to the free plan. Upgrade to Hallyu Pass to restore full access to all 5 services.
    </p>
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:20px;margin:24px 0;">
      <div style="font-size:13px;color:#888;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Hallyu Pass includes</div>
      <div style="font-size:14px;color:#b3b3b3;line-height:1.9;">
        📅 HallyuCalendar — Unlimited tracking &amp; reminders<br>
        🎵 KpopStats — Full charts &amp; artist analytics<br>
        🎬 KdramaMatch — Unlimited UnfoldK recommendations<br>
        🇰🇷 HangeulGo — Full Korean learning suite<br>
        🍜 KfoodKit — All recipes &amp; ingredients
      </div>
    </div>
    <p style="font-size:14px;color:#b3b3b3;line-height:1.6;margin:0 0 20px;">
      <strong style="color:#ffffff;">$15/month</strong> or <strong style="color:#ffffff;">$120/year</strong> (save 33%). Cancel anytime.
    </p>
    ${ctaButton("Upgrade to Hallyu Pass", PRICING_URL)}
  `

  const html = emailShell(inner)
  const text = `Your 30-day Hallyu Pass trial has ended.\n\nUpgrade to continue at ${PRICING_URL}`

  try {
    const resend = new Resend(apiKey)
    const result = await resend.emails.send({ from: FROM_EMAIL, to: input.to, subject, html, text })
    if (result.error) {
      console.error("[email/trial/ended] 발송 실패:", result.error)
      return { ok: false, error: result.error.message }
    }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[email/trial/ended] 예외:", msg)
    return { ok: false, error: msg }
  }
}
