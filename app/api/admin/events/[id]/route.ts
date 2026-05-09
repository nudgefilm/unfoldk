import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  generateSafeEventDescription,
  type EventType,
} from "@/lib/claude/generate-event-description"

export const dynamic = "force-dynamic"

// 이벤트 부분 수정 — 모든 필드 optional
const PatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  artist_or_drama: z.string().min(1).max(200).optional(),
  type: z.enum(["comeback", "drama", "concert", "fanmeet"]).optional(),
  event_date: z.string().refine((s) => !Number.isNaN(Date.parse(s))).optional(),
  event_time_label: z.string().max(80).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  is_premium: z.boolean().optional(),
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

  // description 이 명시적으로 비어 들어왔으면 Claude Haiku 안전 모드로 자동 생성 시도
  // 자동 생성에 필요한 artist_or_drama / type / event_date 가 body 에 없으면 DB 에서 채움
  const desc = parsed.data.description
  const isEmptyDesc =
    desc === null ||
    (typeof desc === "string" && desc.trim().length === 0)

  if (isEmptyDesc) {
    let artistOrDrama = parsed.data.artist_or_drama
    let type = parsed.data.type
    let eventDate = parsed.data.event_date
    if (!artistOrDrama || !type || !eventDate) {
      const { data: existing } = await supabase
        .from("hallyu_calendar_events")
        .select("artist_or_drama, type, event_date")
        .eq("id", id)
        .single()
      const row = existing as {
        artist_or_drama?: string
        type?: string
        event_date?: string
      } | null
      if (row) {
        artistOrDrama = artistOrDrama ?? row.artist_or_drama
        type = (type ?? row.type) as typeof type
        eventDate = eventDate ?? row.event_date
      }
    }
    if (artistOrDrama && type && eventDate) {
      const generated = await generateSafeEventDescription(
        artistOrDrama,
        type as EventType,
        eventDate
      )
      if (generated) parsed.data.description = generated
    }
  }

  const { data, error } = await supabase
    .from("hallyu_calendar_events")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ event: data })
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
  const { error } = await supabase.from("hallyu_calendar_events").delete().eq("id", id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
