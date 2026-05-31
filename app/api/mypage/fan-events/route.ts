import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// 본인 팬 행사 신청 목록 + 신규 등록 라우트
//
// GET — 본인 신청 내역 조회 (+ 승인된 신청에 발급된 쿠폰 코드 join)
// POST — 신규 신청 등록 (파일 업로드는 클라이언트 → Supabase Storage 직접, 본 API 는 proof_url 만 받음)

// 파일 업로드 5MB 제한 + 허용 mime — 0010 마이그레이션의 storage 정책과 일관
const PostSchema = z.object({
  title: z.string().min(1, "제목 필수").max(200),
  description: z.string().max(2000).optional().nullable(),
  event_date: z.string().refine(
    (s) => !Number.isNaN(Date.parse(s)),
    { message: "유효한 날짜 형식이 아닙니다." }
  ),
  location: z.string().max(200).optional().nullable(),
  // proof_url 업로드 실패 시 null 허용 — spec: "파일 업로드 실패 시 신청 자체는 계속 가능"
  proof_url: z.string().url().max(2000).optional().nullable(),
  // 소셜 링크 — 0017 컬럼 추가. 모두 선택 입력. instagram/x 는 username 만 (prefix 폼 UI 가 표시),
  // other 는 URL 직접 입력 (Discord/TikTok 등 다양 채널 커버).
  social_instagram: z.string().max(100).optional().nullable(),
  social_x: z.string().max(100).optional().nullable(),
  social_other: z.string().max(500).optional().nullable(),
  contact_email: z.string().email().max(200).optional().nullable(),
  registration_link: z.string().url().max(2000).optional().nullable(),
})

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  // 본인 신청 — RLS "fan_events_select_own" 정책으로 본인 행만 조회됨
  const { data: requests, error } = await supabase
    .from("fan_event_requests")
    .select(
      "id, title, description, event_date, location, proof_url, status, admin_note, created_at, reviewed_at, social_instagram, social_x, social_other"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    console.error("[mypage/fan-events] 조회 실패:", error.message)
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 })
  }

  // 승인된 신청에 대해 발급된 쿠폰 코드 join — service_role 로 RLS 우회
  // (coupons RLS 는 used_by 본인만 select 허용해 미사용 쿠폰은 일반 클라가 못 봄)
  const approvedIds = (requests ?? [])
    .filter((r) => r.status === "approved")
    .map((r) => r.id)

  type Row = {
    id: string
    title: string
    description: string | null
    event_date: string
    location: string | null
    proof_url: string | null
    status: "pending" | "approved" | "rejected"
    admin_note: string | null
    created_at: string
    reviewed_at: string | null
    social_instagram: string | null
    social_x: string | null
    social_other: string | null
    coupon_code?: string | null
  }

  const rows = (requests ?? []) as Row[]

  if (approvedIds.length > 0) {
    const admin = createSupabaseAdminClient()
    const { data: coupons } = await admin
      .from("coupons")
      .select("code, fan_event_request_id")
      .in("fan_event_request_id", approvedIds)

    const couponMap = new Map<string, string>()
    for (const c of (coupons ?? []) as Array<{ code: string; fan_event_request_id: string }>) {
      couponMap.set(c.fan_event_request_id, c.code)
    }
    for (const r of rows) {
      if (r.status === "approved") {
        r.coupon_code = couponMap.get(r.id) ?? null
      }
    }
  }

  return NextResponse.json({ requests: rows })
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // RLS "fan_events_insert_own" 정책 — auth.uid() = user_id 자동 검증
  const { data, error } = await supabase
    .from("fan_event_requests")
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      event_date: new Date(parsed.data.event_date).toISOString().slice(0, 10),  // date 컬럼
      location: parsed.data.location ?? null,
      proof_url: parsed.data.proof_url ?? null,
      social_instagram: parsed.data.social_instagram?.trim() || null,
      social_x: parsed.data.social_x?.trim() || null,
      social_other: parsed.data.social_other?.trim() || null,
      contact_email: parsed.data.contact_email?.trim() || null,
      registration_link: parsed.data.registration_link?.trim() || null,
      status: "pending",
    })
    .select("id, status, created_at")
    .single()

  if (error) {
    console.error("[mypage/fan-events] insert 실패:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, request: data })
}
