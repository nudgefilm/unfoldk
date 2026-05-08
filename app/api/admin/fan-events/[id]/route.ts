import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// 팬 행사 신청 승인·거절 처리
// 승인 시 hallyu_calendar_events에 자동 삽입 (type='fanmeet')
const PatchSchema = z.object({
  action: z.enum(["approve", "reject"]),
  admin_note: z.string().max(1000).optional(),
})

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

  // 3. 승인 시 hallyu_calendar_events에 자동 삽입
  if (parsed.data.action === "approve") {
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
      // 캘린더 삽입은 실패해도 승인 자체는 유지 — 어드민이 수동 재시도 가능
      console.error("[admin/fan-events] 캘린더 삽입 실패:", insertErr.message)
      return NextResponse.json({
        ok: true,
        warning: "승인은 되었으나 캘린더 자동 등록 실패: " + insertErr.message,
      })
    }
  }

  return NextResponse.json({ ok: true, status: newStatus })
}
