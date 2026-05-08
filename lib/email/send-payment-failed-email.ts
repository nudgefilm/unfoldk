// 결제 실패 안내 이메일 — Lemon Squeezy webhook(subscription_payment_failed) 에서 호출
//
// ⚠️ 배경: Lemon Squeezy 가 자체적으로도 결제 실패 안내를 보내지만,
//    UnfoldK 자체 안내 + 다음 청구 시도까지의 간단한 가이드를 함께 전달.
//    Resend 미설정 / 도메인 verify 전에도 발송 실패는 silent (webhook 200 으로 ack).

import { Resend } from "resend"

interface SendPaymentFailedEmailInput {
  to: string                  // 수신자 이메일
}

interface Result {
  ok: boolean
  error?: string
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "UnfoldK <noreply@unfoldk.com>"
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://unfoldk.com"
const SUBSCRIPTION_URL = `${SITE_URL}/mypage/subscription`

export async function sendPaymentFailedEmail(
  input: SendPaymentFailedEmailInput
): Promise<Result> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn("[email/payment-failed] RESEND_API_KEY 미설정 — 발송 skip")
    return { ok: false, error: "RESEND_API_KEY not configured" }
  }

  const subject = "Payment failed — please update your card"

  const text = [
    `Hi,`,
    ``,
    `We weren't able to process your latest Hallyu Pass payment.`,
    `Lemon Squeezy will retry automatically over the next few days, but you can`,
    `also update your card now to avoid any interruption:`,
    ``,
    `   ${SUBSCRIPTION_URL}`,
    ``,
    `Need help? Just reply to this email.`,
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
                Payment failed
              </h1>
              <p style="font-size:15px;color:#b3b3b3;line-height:1.6;margin:0 0 20px;">
                We weren't able to process your latest Hallyu Pass payment. Lemon Squeezy will retry automatically over the next few days, but you can also update your card now to avoid any interruption.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${SUBSCRIPTION_URL}" style="display:inline-block;padding:14px 28px;background:#FF4B6E;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;">Update payment method</a>
                  </td>
                </tr>
              </table>

              <p style="font-size:14px;color:#b3b3b3;line-height:1.6;margin:24px 0 0;">
                Need help? Just reply to this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #2a2a2a;font-size:12px;color:#666;text-align:center;">
              UnfoldK · unfoldk.com
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
      console.error("[email/payment-failed] 발송 실패:", result.error)
      return { ok: false, error: result.error.message }
    }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[email/payment-failed] 예외:", msg)
    return { ok: false, error: msg }
  }
}
