import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { hasProAccess } from "@/lib/auth/plan"

// /api/curation-k/course/save POST
//
// 클라이언트가 보낸 itinerary 를 hallyu_courses 에 저장.
// generate 와 save 분리 — 사용자가 "Generate Again" 후 마음에 든 코스만 저장.
//
// RLS 정책 (0023): user_id = auth.uid() 인 row 만 본인이 insert/select 가능.
// 본 라우트는 server client 로 동작 → RLS 가 자동 적용.

export const dynamic = "force-dynamic"

const StopSchema = z.object({
  name: z.string().max(160),
  address: z.string().max(200),
  reason: z.string().max(800).optional().default(""),
  transport: z.string().max(160).optional().default(""),
  duration_minutes: z.number().int().min(0).max(720).optional().default(0),
})

const DaySchema = z.object({
  day: z.number().int().min(1).max(7),
  title: z.string().max(160),
  morning: z.array(StopSchema).default([]),
  afternoon: z.array(StopSchema).default([]),
  evening: z.array(StopSchema).default([]),
})

const PostSchema = z.object({
  drama_title: z.string().trim().min(1).max(160),
  travel_style: z.enum(["relaxed", "packed", "foodie", "cultural"]),
  duration_days: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(5),
    z.literal(7),
  ]),
  departure_region: z.string().trim().min(1).max(60),
  arrival_region: z.string().trim().min(1).max(60),
  itinerary: z.object({
    days: z.array(DaySchema).min(1).max(7),
  }),
})

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  // Pro 가드 — 저장도 Pro 전용
  const { data: profile } = await supabase
    .from("users")
    .select("plan_type, is_admin")
    .eq("id", user.id)
    .maybeSingle()
  const row = profile as { plan_type?: string; is_admin?: boolean } | null
  if (!hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin })) {
    return NextResponse.json({ error: "pro_required" }, { status: 403 })
  }

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
  const { drama_title, travel_style, duration_days, departure_region, arrival_region, itinerary } = parsed.data

  // 사용자별 저장 cap — 무한 적재 방지 (20건)
  const { count: existingCount } = await supabase
    .from("hallyu_courses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
  if ((existingCount ?? 0) >= 20) {
    return NextResponse.json(
      { error: "save_cap_reached", detail: "최대 20개까지 저장 가능. 기존 코스를 삭제하세요." },
      { status: 409 }
    )
  }

  // course_data 구조 — Phase 2 spec 의 stops jsonb 확장 (drama_title / style / days 포함)
  const course_data = {
    drama_title,
    travel_style,
    duration_days,
    departure_region,
    arrival_region,
    itinerary,
    generated_at: new Date().toISOString(),
  }

  // title 은 카드 헤더용 — 드라마명 + 스타일
  const title = `${drama_title} · ${travel_style}`
  // region 은 hallyu_courses.region 컬럼 — 단일 지역만 저장 가능해 도착지 기준
  // (사용자가 가는 곳 = arrival_region 이 의미상 더 정확)

  const { data: inserted, error: insErr } = await supabase
    .from("hallyu_courses")
    .insert({
      user_id: user.id,
      title,
      region: arrival_region,
      course_data,
    })
    .select("id, title, region, course_data, created_at")
    .single()

  if (insErr || !inserted) {
    console.error("[curation-k/course/save] insert 실패:", insErr?.message)
    return NextResponse.json(
      { error: "insert_failed", detail: insErr?.message ?? null },
      { status: 500 }
    )
  }

  return NextResponse.json({ course_id: inserted.id, item: inserted })
}
