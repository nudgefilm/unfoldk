import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { generateSafeEventDescription } from "@/lib/claude/generate-event-description"

export const dynamic = "force-dynamic"

// 이벤트 수동 등록 — admin 페이지의 폼에서 호출
const PostSchema = z.object({
  title: z.string().min(1).max(200),
  artist_or_drama: z.string().min(1).max(200),
  type: z.enum(["comeback", "drama", "concert", "fanmeet"]),
  event_date: z.string().refine((s) => !Number.isNaN(Date.parse(s)), { message: "유효한 날짜 형식이 아닙니다." }),
  event_time_label: z.string().max(80).optional(),
  description: z.string().max(2000).optional(),
  thumbnail_url: z.string().url().optional(),
  is_premium: z.boolean().optional(),
})

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "unauthenticated" ? 401 : 403 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // description 비어있으면 Claude Haiku 안전 모드로 자동 생성 시도 (실패 시 그대로 빈 채 저장)
  let finalDescription = parsed.data.description
  if (!finalDescription || finalDescription.trim().length === 0) {
    finalDescription =
      (await generateSafeEventDescription(
        parsed.data.artist_or_drama,
        parsed.data.type,
        parsed.data.event_date
      )) ?? undefined
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("hallyu_calendar_events")
    .insert({
      ...parsed.data,
      description: finalDescription,
      source_api: "manual",                              // 수동 등록은 source_api='manual'로 표시
      source_id: `manual-${Date.now()}`,                 // unique 제약 회피용 임시 ID
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ event: data })
}
