import { NextResponse, type NextRequest } from "next/server"
import { Resend } from "resend"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// 환경변수: RESEND_API_KEY (.env.local 및 Vercel 프로젝트 설정에 등록 필요)
const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = "UnfoldK Beauty <support@unfoldk.com>"
const CHUNK_SIZE = 100

type RecipientRow = { email: string; companyName: string }

function applyVariables(text: string, companyName: string): string {
  return text
    .replace(/\{\{company_name\}\}/g, companyName)
    .replace(/\{\{platform_name\}\}/g, "UnfoldK Beauty")
}

function toHtml(plainText: string): string {
  const escaped = plainText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
  const paragraphs = escaped
    .split(/\n\n+/)
    .map(p => `<p style="margin:0 0 16px 0;line-height:1.6">${p.replace(/\n/g, "<br>")}</p>`)
    .join("")
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;color:#1a1a1a;background:#f8f7f5;margin:0;padding:0">
  <div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #e8e2da;border-radius:12px;padding:40px">
    ${paragraphs}
    <hr style="border:none;border-top:1px solid #e8e2da;margin:24px 0">
    <p style="font-size:12px;color:#9b9b9b;margin:0">
      UnfoldK Beauty · <a href="https://www.unfoldk.com/kbeauty" style="color:#1a3a5c">Dashboard</a>
    </p>
  </div>
</body>
</html>`
}

export async function POST(request: NextRequest) {
  // ── 1. 세션 인증 ──────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── 2. 어드민 검증 (service role — RLS 우회) ─────────────────────────────
  const admin = createSupabaseAdminClient()
  const { data: userRow } = await admin
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()

  if (!userRow?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // ── 3. 요청 파싱 ──────────────────────────────────────────────────────────
  let group: string, subject: string, body: string
  try {
    const parsed = await request.json() as { group?: string; subject?: string; body?: string }
    group   = parsed.group?.trim()   ?? ""
    subject = parsed.subject?.trim() ?? ""
    body    = parsed.body?.trim()    ?? ""
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!group || !subject || !body) {
    return NextResponse.json({ error: "group, subject, body 필수" }, { status: 400 })
  }

  // ── 4. 대상 이메일 목록 조회 ──────────────────────────────────────────────
  const recipients: RecipientRow[] = []

  const includeSuppliers = group === "all_suppliers" || group === "pending_suppliers" || group === "all"
  const includeBuyers    = group === "all_buyers"    || group === "pending_buyers"    || group === "all"
  const includeSellers   = group === "all_sellers"   || group === "all"

  if (includeSuppliers) {
    let q = admin
      .from("beauty_suppliers")
      .select("contact_email, company_name_ko")
      .not("contact_email", "is", null)
    if (group === "pending_suppliers") q = q.eq("buyer_db_access", false)
    const { data } = await q
    ;(data ?? []).forEach((r: { contact_email: string; company_name_ko: string }) => {
      if (r.contact_email) recipients.push({ email: r.contact_email, companyName: r.company_name_ko })
    })
  }

  if (includeBuyers) {
    let q = admin
      .from("beauty_buyers")
      .select("business_email, company_name")
      .not("business_email", "is", null)
    if (group === "pending_buyers") q = q.eq("stage1_approved", false)
    const { data } = await q
    ;(data ?? []).forEach((r: { business_email: string; company_name: string }) => {
      if (r.business_email) recipients.push({ email: r.business_email, companyName: r.company_name })
    })
  }

  if (includeSellers) {
    const { data } = await admin
      .from("beauty_sellers")
      .select("business_email, company_name")
      .not("business_email", "is", null)
    ;(data ?? []).forEach((r: { business_email: string; company_name: string }) => {
      if (r.business_email) recipients.push({ email: r.business_email, companyName: r.company_name })
    })
  }

  // 이메일 중복 제거
  const deduped = Array.from(
    new Map(recipients.map(r => [r.email.toLowerCase(), r])).values()
  )

  if (deduped.length === 0) {
    return NextResponse.json({ success: 0, failed: 0, message: "발송 대상 이메일 없음" })
  }

  // ── 5. Resend batch 발송 (100건 단위 청크) ────────────────────────────────
  let success = 0
  let failed  = 0

  for (let i = 0; i < deduped.length; i += CHUNK_SIZE) {
    const chunk = deduped.slice(i, i + CHUNK_SIZE)
    const batchPayload = chunk.map(({ email, companyName }) => ({
      from: FROM,
      to: email,
      subject: applyVariables(subject, companyName),
      html: toHtml(applyVariables(body, companyName)),
    }))

    try {
      const { data: batchResult, error: batchError } = await resend.batch.send(batchPayload)
      if (batchError) {
        failed += chunk.length
      } else {
        const sent = (batchResult?.data ?? []).length
        success += sent
        failed  += chunk.length - sent
      }
    } catch {
      failed += chunk.length
    }
  }

  return NextResponse.json({ success, failed, total: deduped.length })
}
