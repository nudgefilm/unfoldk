import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// /api/admin/food/challenges — 주간 K푸드 챌린지 신규 생성 (admin 전용)
//
// POST body: { title, description?, food_name?, image_url?, week_start, week_end }
// week_start / week_end 는 YYYY-MM-DD (date 컬럼).
//
// 정책: 0030 food_challenges_admin_write (is_admin(auth.uid())).
// service_role 클라이언트 사용 — RLS 우회 + 라우트 단에서 requireAdmin 으로 게이트.

export const dynamic = "force-dynamic"

const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")

const PostSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  food_name: z.string().trim().max(100).optional().nullable(),
  image_url: z.string().trim().url().max(500).optional().nullable(),
  week_start: DateSchema,
  week_end: DateSchema,
})

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    const status = auth.reason === "unauthenticated" ? 401 : 403
    return NextResponse.json({ error: auth.reason }, { status })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const parsed = PostSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 }
    )
  }

  // week_start <= week_end 검증 — DB check 제약 없는 만큼 app 레벨에서 차단.
  if (parsed.data.week_start > parsed.data.week_end) {
    return NextResponse.json(
      { error: "invalid_range", message: "week_start must be ≤ week_end" },
      { status: 400 }
    )
  }

  // 빈 문자열은 null 로 정규화 (optional 컬럼)
  const norm = (v: string | null | undefined) => {
    if (typeof v !== "string") return null
    const t = v.trim()
    return t.length === 0 ? null : t
  }

  const insertPayload = {
    title: parsed.data.title.trim(),
    description: norm(parsed.data.description),
    food_name: norm(parsed.data.food_name),
    image_url: norm(parsed.data.image_url),
    week_start: parsed.data.week_start,
    week_end: parsed.data.week_end,
  }

  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from("food_challenges")
    .insert(insertPayload)
    .select("id, title, week_start, week_end")
    .single()

  if (error) {
    console.error("[/api/admin/food/challenges POST] insert 실패:", error)
    return NextResponse.json(
      { error: "insert_failed", message: error.message, code: error.code },
      { status: 500 }
    )
  }

  return NextResponse.json({ item: data })
}
