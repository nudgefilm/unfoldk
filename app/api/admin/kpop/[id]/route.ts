import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// 어드민 — K팝 아티스트 부분 수정 / 삭제
const PatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  name_ko: z.string().max(100).nullable().optional(),
  debut_year: z.coerce.number().int().min(1990).max(2030).nullable().optional(),
  youtube_channel_id: z.string().max(50).nullable().optional(),
  lastfm_name: z.string().max(100).nullable().optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  is_active: z.boolean().optional(),
  // NULL=미분류 / 1=솔로 / 2+=그룹 (인원 수)
  member_count: z.coerce.number().int().min(1).max(50).nullable().optional(),
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
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "변경 필드가 없습니다." }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("kpop_artists")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ artist: data })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "unauthenticated" ? 401 : 403 })
  }

  const { id } = await params
  const supabase = createSupabaseAdminClient()
  // kpop_stats_daily 는 ON DELETE CASCADE 로 자동 정리됨
  const { error } = await supabase.from("kpop_artists").delete().eq("id", id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
