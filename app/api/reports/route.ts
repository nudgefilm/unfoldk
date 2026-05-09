import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// POST /api/reports — 콘텐츠 신고 등록
// 로그인 필수, RLS 가 본인 user_id 강제

const PostSchema = z.object({
  content_type: z.enum(["event", "artist", "drama", "phrase", "recipe"]),
  content_id: z.string().uuid(),
  reason: z.enum(["mismapping", "date_error", "duplicate", "cancelled", "other"]),
  note: z.string().max(500).nullable().optional(),
})

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

  const { error } = await supabase.from("content_reports").insert({
    ...parsed.data,
    user_id: user.id,
  })

  if (error) {
    console.error("[/api/reports POST] insert 실패:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
