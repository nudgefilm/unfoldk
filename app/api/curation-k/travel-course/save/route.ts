import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { hasProAccess } from "@/lib/auth/plan"

// /api/curation-k/travel-course/save POST — Pro 전용 코스 저장
//
// 마이그레이션 0039 에서 생성된 hallyu_travel_courses 테이블에 저장.
// (기존 hallyu_courses 와 별도 — schema 충돌 없음)
// 사용자당 최대 20건 cap.

export const dynamic = "force-dynamic"

const NearbySchema = z.object({
  title: z.string().max(200),
  address: z.string().max(300).nullable(),
  distance_km: z.number(),
  maps_url: z.string().max(500),
  image_url: z.string().max(1000).nullable(),
})

const StopSchema = z.object({
  order: z.number(),
  spot_id: z.string().uuid(),
  spot_name: z.string().max(200),
  spot_description: z.string().max(1000).nullable(),
  latitude: z.number(),
  longitude: z.number(),
  address: z.string().max(300).nullable(),
  image_url: z.string().max(1000).nullable(),
  duration_min: z.number().int().min(0).max(720),
  visit_tip: z.string().max(500),
  nearby_food: NearbySchema.nullable(),
  nearby_stay: NearbySchema.nullable(),
})

const PostSchema = z.object({
  course: z.object({
    course_title: z.string().max(200),
    description: z.string().max(1000),
    drama_title: z.string().max(160),
    stops: z.array(StopSchema).min(1).max(10),
    gmaps_url: z.string().max(2000),
  }),
})

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  // 결제 연동 후 아래 주석 해제 — Pro 전용 저장 게이팅 // 2026-05-16 임시 정책
  // const { data: profile } = await supabase
  //   .from("users").select("plan_type, is_admin").eq("id", user.id).maybeSingle()
  // const row = profile as { plan_type?: string; is_admin?: boolean } | null
  // if (!hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin })) {
  //   return NextResponse.json({ error: "pro_required" }, { status: 403 })
  // }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { course } = parsed.data

  // 사용자당 저장 cap — 20건
  const { count: existing } = await supabase
    .from("hallyu_travel_courses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
  if ((existing ?? 0) >= 20) {
    return NextResponse.json(
      {
        error: "save_cap_reached",
        detail: "Saved travel course limit reached (20). Delete some to save more.",
      },
      { status: 409 }
    )
  }

  const course_data = {
    description: course.description,
    stops: course.stops,
    gmaps_url: course.gmaps_url,
    generated_at: new Date().toISOString(),
  }

  const { data: inserted, error: insErr } = await supabase
    .from("hallyu_travel_courses")
    .insert({
      user_id: user.id,
      title: course.course_title,
      drama_title: course.drama_title,
      course_data,
    })
    .select("id, title, drama_title, created_at")
    .single()

  if (insErr || !inserted) {
    console.error("[travel-course/save] insert 실패:", insErr?.message)
    return NextResponse.json(
      { error: "insert_failed", detail: insErr?.message ?? null },
      { status: 500 }
    )
  }

  return NextResponse.json({ course_id: inserted.id, item: inserted })
}
