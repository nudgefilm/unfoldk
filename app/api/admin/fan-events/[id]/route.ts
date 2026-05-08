import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { generateUniqueCouponCode } from "@/lib/coupons/generate-code"
import { sendCouponEmail } from "@/lib/email/send-coupon-email"

export const dynamic = "force-dynamic"

// 팬 행사 신청 승인·거절 처리
// 승인 시:
//   1. fan_event_requests.status = 'approved'
//   2. hallyu_calendar_events 자동 삽입 (type='fanmeet')
//   3. coupons 자동 발급 (monthly, 30일 만료) + 이메일 발송
//      ⚠️ 캘린더/쿠폰/이메일 단계 중 일부 실패해도 승인 자체는 유지 — warning 으로 노출
const PatchSchema = z.object({
  action: z.enum(["approve", "reject"]),
  admin_note: z.string().max(1000).optional(),
})

const COUPON_VALID_DAYS = 30

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "unauthenticated" ? 401 : 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()

  // 1. 신청 행 조회 (이미 처리된 건 제외)
  const { data: req, error: fetchErr } = await supabase
    .from("fan_event_requests")
    .select("id, user_id, title, description, event_date, location, status")
    .eq("id", id)
    .single()

  if (fetchErr || !req) {
    return NextResponse.json({ error: "신청을 찾을 수 없습니다." }, { status: 404 })
  }
  if (req.status !== "pending") {
    return NextResponse.json({ error: "이미 처리된 신청입니다." }, { status: 409 })
  }

  // 2. status 업데이트
  const newStatus = parsed.data.action === "approve" ? "approved" : "rejected"
  const { error: updateErr } = await supabase
    .from("fan_event_requests")
    .update({
      status: newStatus,
      admin_note: parsed.data.admin_note ?? null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.userId,
    })
    .eq("id", id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // 거절 처리는 여기서 종료
  if (parsed.data.action !== "approve") {
    return NextResponse.json({ ok: true, status: newStatus })
  }

  // 이하 승인 후속 처리 — 어느 단계가 실패해도 승인은 유지하고 warning 누적
  const warnings: string[] = []

  // 3. 캘린더 자동 등록
  const { error: insertErr } = await supabase.from("hallyu_calendar_events").insert({
    type: "fanmeet",
    title: req.title,
    artist_or_drama: req.title,                          // 팬 행사는 별도 아티스트 필드 없으므로 제목 재사용
    event_date: new Date(req.event_date).toISOString(),
    description: req.description,
    source_api: "fan_event_request",
    source_id: `fer-${req.id}`,                          // unique 제약 회피
    is_premium: false,
  })
  if (insertErr) {
    console.error("[admin/fan-events] 캘린더 삽입 실패:", insertErr.message)
    warnings.push("캘린더 자동 등록 실패: " + insertErr.message)
  }

  // 4. 쿠폰 발급 + 이메일 발송
  try {
    const code = await generateUniqueCouponCode()
    const expiresAt = new Date(Date.now() + COUPON_VALID_DAYS * 24 * 60 * 60 * 1000)

    const { error: couponErr } = await supabase.from("coupons").insert({
      code,
      type: "monthly",
      created_by: auth.userId,
      expires_at: expiresAt.toISOString(),
      fan_event_request_id: req.id,
    })

    if (couponErr) {
      console.error("[admin/fan-events] 쿠폰 발급 실패:", couponErr.message)
      warnings.push("쿠폰 발급 실패: " + couponErr.message)
    } else {
      // 신청자 이메일 조회 (fan_event_requests 에는 user_id 만 있음)
      const { data: user } = await supabase
        .from("users")
        .select("email")
        .eq("id", req.user_id)
        .single()

      if (!user?.email) {
        warnings.push("신청자 이메일을 찾을 수 없어 발송 skip")
      } else {
        const sendResult = await sendCouponEmail({
          to: user.email,
          eventTitle: req.title,
          couponCode: code,
          expiresAt,
        })
        if (!sendResult.ok) {
          warnings.push("쿠폰 이메일 발송 실패: " + (sendResult.error ?? "unknown"))
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[admin/fan-events] 쿠폰 발급 예외:", msg)
    warnings.push("쿠폰 발급 예외: " + msg)
  }

  return NextResponse.json({
    ok: true,
    status: newStatus,
    ...(warnings.length > 0 ? { warning: warnings.join(" / ") } : {}),
  })
}
