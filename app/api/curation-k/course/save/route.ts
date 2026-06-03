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
  lat: z.number().optional(),
  lng: z.number().optional(),
})

const DaySchema = z.object({
  day: z.number().int().min(1).max(7),
  title: z.string().max(160),
  morning: z.array(StopSchema).default([]),
  afternoon: z.array(StopSchema).default([]),
  evening: z.array(StopSchema).default([]),
})

const PostSchema = z.object({
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
    travel_info: z.string().optional(),
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
    .select("plan_type, is_admin, trial_ends_at")
    .eq("id", user.id)
    .maybeSingle()
  const row = profile as { plan_type?: string; is_admin?: boolean; trial_ends_at?: string | null } | null
  if (!hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin, trialEndsAt: row?.trial_ends_at })) {
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
  const { duration_days, departure_region, arrival_region, itinerary } = parsed.data

  // lat/lng 없는 stop 보완 — 순차 매칭 (전체 병렬)
  type StopData = z.infer<typeof StopSchema>

  // 괄호 안 내용 추출: "낙타트레킹 (Camel Trekking)" → "Camel Trekking"
  const extractParenContent = (name: string): string | null => {
    const m = name.match(/\(([^)]+)\)/)
    return m ? m[1].trim() : null
  }

  // tour_spots 단일 키워드 조회
  const queryCoords = async (column: "eng_title" | "title", keyword: string) => {
    const { data } = await supabase
      .from("tour_spots")
      .select("latitude, longitude")
      .ilike(column, `%${keyword}%`)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .limit(1)
      .maybeSingle()
    return data?.latitude != null && data?.longitude != null
      ? { lat: Number(data.latitude), lng: Number(data.longitude) }
      : null
  }

  const enrichSlot = async (stops: StopData[]): Promise<StopData[]> =>
    Promise.all(stops.map(async (s) => {
      if (s.lat != null && s.lng != null) return s

      // 1차: eng_title ILIKE %name%
      let coords = await queryCoords("eng_title", s.name)

      // 2차: title ILIKE %name%
      if (!coords) coords = await queryCoords("title", s.name)

      // 3차: 괄호 안 내용 추출 후 재시도
      if (!coords) {
        const paren = extractParenContent(s.name)
        if (paren) {
          coords = await queryCoords("eng_title", paren)
          if (!coords) coords = await queryCoords("title", paren)
        }
      }

      return coords ? { ...s, ...coords } : s
    }))

  const enrichedDays = await Promise.all(
    itinerary.days.map(async (day) => ({
      ...day,
      morning:   await enrichSlot(day.morning),
      afternoon: await enrichSlot(day.afternoon),
      evening:   await enrichSlot(day.evening),
    }))
  )
  const enrichedItinerary = { travel_info: itinerary.travel_info, days: enrichedDays }

  // 사용자별 저장 cap — 6건 초과 시 가장 오래된 코스 자동 삭제
  const { count: existingCount } = await supabase
    .from("hallyu_courses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
  if ((existingCount ?? 0) >= 6) {
    const { data: oldest } = await supabase
      .from("hallyu_courses")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .single()
    if (oldest) {
      await supabase
        .from("hallyu_courses")
        .delete()
        .eq("id", oldest.id)
        .eq("user_id", user.id)
    }
  }

  const course_data = {
    duration_days,
    departure_region,
    arrival_region,
    itinerary: enrichedItinerary,
    generated_at: new Date().toISOString(),
  }

  const title = `${arrival_region} · ${duration_days}d`
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
