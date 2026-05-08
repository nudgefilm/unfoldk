// 쿠폰 발급 안내 이메일 발송 — Resend 사용
//
// ⚠️ Resend 샌드박스 / 도메인 verify 주의
//   - 도메인 verify 전: from 이 onboarding@resend.dev 가 아니면 거부됨
//   - unfoldk.com 도메인이 verify 되면 RESEND_FROM_EMAIL 환경변수 설정으로 전환
//   - 현재 기본값은 spec 대로 "UnfoldK <noreply@unfoldk.com>" — verify 전엔 발송 실패 가능
//   - 발송 실패해도 호출 측(api/admin/fan-events) 에서 승인 자체는 유지 (warning 만 반환)

import { Resend } from "resend"

interface SendCouponEmailInput {
  to: string                  // 수신자 이메일 (신청자)
  eventTitle: string          // 승인된 팬 행사 제목
  couponCode: string          // 발급된 쿠폰 코드 (예: KPOP-X7K2)
  expiresAt: Date             // 쿠폰 만료 시각
}

interface SendCouponEmailResult {
  ok: boolean
  error?: string
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "UnfoldK <noreply@unfoldk.com>"
const REDEEM_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://unfoldk.com") + "/redeem"

export async function sendCouponEmail(
  input: SendCouponEmailInput
): Promise<SendCouponEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn("[email/send-coupon-email] RESEND_API_KEY 미설정 — 발송 skip")
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const expiresLabel = input.expiresAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const subject = "Your event was approved + here's your Hallyu Pass!"

  // 평문 fallback — 일부 메일 클라이언트가 HTML 차단 시 노출
  const text = [
    `Hi there!`,
    ``,
    `Great news — your fan event "${input.eventTitle}" has been approved by the UnfoldK team.`,
    ``,
    `As a thank-you, here's a complimentary Hallyu Pass coupon (1 month):`,
    ``,
    `   ${input.couponCode}`,
    ``,
    `Redeem at: ${REDEEM_URL}`,
    `Expires on: ${expiresLabel}`,
    ``,
    `How to use:`,
    `1. Log in to UnfoldK`,
    `2. Visit ${REDEEM_URL}`,
    `3. Enter your code and click Apply`,
    ``,
    `Enjoy full access to all 5 services for the next month!`,
    ``,
    `— The UnfoldK team`,
  ].join("\n")

  const html = `<!DOCTYPE html>
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
              <h1 style="font-size:22px;font-weight:600;color:#ffffff;margin:16px 0 12px;line-height:1.3;">
                Your event was approved 🎉
              </h1>
              <p style="font-size:15px;color:#b3b3b3;line-height:1.6;margin:0 0 20px;">
                Great news — your fan event <strong style="color:#ffffff;">"${escapeHtml(input.eventTitle)}"</strong> has been approved by the UnfoldK team. As a thank-you, here's a complimentary Hallyu Pass coupon valid for 1 month.
              </p>

              <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
                <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Your coupon code</div>
                <div style="font-size:28px;font-weight:700;color:#FF4B6E;letter-spacing:0.1em;font-family:Menlo,Consolas,monospace;">${escapeHtml(input.couponCode)}</div>
                <div style="font-size:13px;color:#888;margin-top:12px;">Expires on ${escapeHtml(expiresLabel)}</div>
              </div>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${REDEEM_URL}" style="display:inline-block;padding:14px 28px;background:#FF4B6E;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;">Redeem now</a>
                  </td>
                </tr>
              </table>

              <h2 style="font-size:14px;font-weight:600;color:#ffffff;margin:24px 0 8px;text-transform:uppercase;letter-spacing:0.05em;">How to use</h2>
              <ol style="font-size:14px;color:#b3b3b3;line-height:1.7;padding-left:20px;margin:0 0 8px;">
                <li>Log in to UnfoldK</li>
                <li>Visit the redeem page</li>
                <li>Enter your code and click Apply</li>
              </ol>
              <p style="font-size:14px;color:#b3b3b3;line-height:1.6;margin:24px 0 0;">
                Enjoy full access to all 5 services for the next month!
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #2a2a2a;font-size:12px;color:#666;text-align:center;">
              UnfoldK · unfoldk.com<br>
              You received this email because your fan event request was approved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body></html>`

  try {
    const resend = new Resend(apiKey)
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: input.to,
      subject,
      html,
      text,
    })

    if (result.error) {
      console.error("[email/send-coupon-email] 발송 실패:", result.error)
      return { ok: false, error: result.error.message }
    }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[email/send-coupon-email] 예외:", msg)
    return { ok: false, error: msg }
  }
}

// HTML escape — 사용자 제어 문자열 (eventTitle 등) XSS 방지
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
