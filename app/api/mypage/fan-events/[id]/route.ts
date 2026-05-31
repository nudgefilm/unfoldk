import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// 본인 팬 행사 신청 수정 — pending 상태일 때만 허용.
//
// 보안 모델:
//   - 1차 가드: API 레벨 status='pending' 사전 조회 + user_id 검증으로 빠른 거절
//   - 2차 가드: RLS "fan_events_update_own" 정책 (auth.uid()=user_id and status='pending')
//   - 두 단계 모두 통과해야만 update 가 적용됨 (defence-in-depth)
//
// 변경 가능 필드: title, description, event_date, location, proof_url
// 명시적 비허용: user_id, status, admin_note, reviewed_at, reviewed_by — RLS 정책상으로도
// status 변경은 with check 에서 차단되지만 API 에서 한 번 더 화이트리스트로 거름.

const PatchSchema = z.object({
  title: z.string().min(1, "제목 필수").max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  event_date: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), { message: "유효한 날짜 형식이 아닙니다." })
    .optional(),
  location: z.string().max(200).nullable().optional(),
  proof_url: z.string().url().max(2000).nullable().optional(),
  // 0017 소셜 링크 — 모두 선택. 빈 문자열은 클라가 trim 후 null 로 보냄.
  social_instagram: z.string().max(100).nullable().optional(),
  social_x: z.string().max(100).nullable().optional(),
  social_other: z.string().max(500).nullable().optional(),
  contact_email: z.string().email().max(200).nullable().optional(),
  registration_link: z.string().url().max(2000).nullable().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "변경 필드가 없습니다." }, { status: 400 })
  }

  // 1차 가드 — 본인 + pending 사전 검증 (사용자에게 명확한 에러 메시지 제공용)
  const { data: existing, error: fetchErr } = await supabase
    .from("fan_event_requests")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle()

  if (fetchErr) {
    console.error("[mypage/fan-events] 신청 조회 실패:", fetchErr.message)
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }
  if (existing.status !== "pending") {
    return NextResponse.json({ error: "not_pending" }, { status: 409 })
  }

  // 업데이트 페이로드 — date 컬럼은 YYYY-MM-DD 만 저장
  const update: Record<string, unknown> = {}
  if (parsed.data.title !== undefined) update.title = parsed.data.title
  if (parsed.data.description !== undefined) update.description = parsed.data.description
  if (parsed.data.event_date !== undefined) {
    update.event_date = new Date(parsed.data.event_date).toISOString().slice(0, 10)
  }
  if (parsed.data.location !== undefined) update.location = parsed.data.location
  if (parsed.data.proof_url !== undefined) update.proof_url = parsed.data.proof_url
  if (parsed.data.social_instagram !== undefined)
    update.social_instagram = parsed.data.social_instagram
  if (parsed.data.social_x !== undefined) update.social_x = parsed.data.social_x
  if (parsed.data.social_other !== undefined) update.social_other = parsed.data.social_other
  if (parsed.data.contact_email !== undefined) update.contact_email = parsed.data.contact_email
  if (parsed.data.registration_link !== undefined)
    update.registration_link = parsed.data.registration_link

  // 2차 가드 — RLS 정책이 본인 + pending 재검증 후에만 통과
  const { data, error } = await supabase
    .from("fan_event_requests")
    .update(update)
    .eq("id", id)
    .select(
      "id, title, description, event_date, location, proof_url, status, created_at, social_instagram, social_x, social_other"
    )
    .single()

  if (error) {
    console.error("[mypage/fan-events] update 실패:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, request: data })
}
