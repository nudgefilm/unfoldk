import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// 어드민 — 신규 K팝 아티스트 등록
const PostSchema = z.object({
  name: z.string().min(1).max(100),
  name_ko: z.string().max(100).optional().nullable(),
  debut_year: z.coerce.number().int().min(1990).max(2030).optional().nullable(),
  youtube_channel_id: z.string().max(50).optional().nullable(),
  lastfm_name: z.string().max(100).optional().nullable(),
  thumbnail_url: z.string().url().optional().nullable(),
  is_active: z.boolean().optional(),
  // NULL=미분류 / 1=솔로 / 2+=그룹 (인원 수)
  member_count: z.coerce.number().int().min(1).max(50).optional().nullable(),
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

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("kpop_artists")
    .insert({
      name: parsed.data.name,
      name_ko: parsed.data.name_ko ?? null,
      debut_year: parsed.data.debut_year ?? null,
      youtube_channel_id: parsed.data.youtube_channel_id ?? null,
      lastfm_name: parsed.data.lastfm_name ?? null,
      thumbnail_url: parsed.data.thumbnail_url ?? null,
      is_active: parsed.data.is_active ?? true,
      member_count: parsed.data.member_count ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ artist: data })
}
