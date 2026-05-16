import { NextResponse } from "next/server"
import { z } from "zod"
import { Resend } from "resend"

export const dynamic = "force-dynamic"

// /api/contact — 공개 문의 폼 → support@unfoldk.com 으로 Resend 발송
//
// 정책:
//   - 로그인 불필요 (footer 푸터 페이지에서 누구나 접근)
//   - honeypot 필드 (`website`) 비어있어야 통과 — 단순 봇 차단
//   - 5분 내 동일 IP 5건 초과 시 거부는 미구현 (rate-limit 인프라 미준비 — 추후 보강)
//
// Resend 도메인 verify 전엔 from 이 onboarding@resend.dev 가 아닌 한 발송 실패함 (lib/email/* 와 동일).

const BodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Valid email required").max(200),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(5000),
  // honeypot — 실제 폼에는 hidden 으로만 노출. 봇이 모든 input 채우는 패턴 차단.
  website: z.string().optional().default(""),
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
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn("[contact] RESEND_API_KEY 미설정 — 발송 skip")
    return NextResponse.json(
      { error: "Email service is temporarily unavailable. Please email support@unfoldk.com directly." },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // honeypot — 채워져 있으면 봇으로 간주하고 silent success (200) 반환
  if (parsed.data.website.trim().length > 0) {
    console.warn("[contact] honeypot 트리거 (bot 추정), silent ignore")
    return NextResponse.json({ ok: true })
  }

  const { name, email, subject, message } = parsed.data
  const safeName = escapeHtml(name)
  const safeEmail = escapeHtml(email)
  const safeSubject = escapeHtml(subject)
  // 메시지는 줄바꿈 유지 — escape 후 <br> 변환
  const safeMessageHtml = escapeHtml(message).replace(/\n/g, "<br />")

  const html = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;background:#f5f5f5;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;">
    <h2 style="margin:0 0 16px;font-size:18px;">New contact form submission</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:4px 0;color:#666;width:80px;">From:</td><td><strong>${safeName}</strong> &lt;${safeEmail}&gt;</td></tr>
      <tr><td style="padding:4px 0;color:#666;">Subject:</td><td>${safeSubject}</td></tr>
    </table>
    <hr style="border:none;border-top:1px solid #e5e5e5;margin:16px 0;" />
    <div style="font-size:14px;line-height:1.6;white-space:pre-wrap;">${safeMessageHtml}</div>
  </div>
  <p style="text-align:center;color:#999;font-size:12px;margin-top:16px;">Sent via unfoldk.com/contact</p>
</body></html>`

  const text = [
    `From: ${name} <${email}>`,
    `Subject: ${subject}`,
    ``,
    message,
    ``,
    `— Sent via unfoldk.com/contact`,
  ].join("\n")

  try {
    const resend = new Resend(apiKey)
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      replyTo: email,
      subject: `[Contact] ${subject}`,
      html,
      text,
    })

    if (result.error) {
      console.error("[contact] 발송 실패:", result.error)
      return NextResponse.json(
        { error: "Failed to send. Please email support@unfoldk.com directly." },
        { status: 500 }
      )
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[contact] 예외:", msg)
    return NextResponse.json(
      { error: "Network error. Please try again." },
      { status: 500 }
    )
  }
}
