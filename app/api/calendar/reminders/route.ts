import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// GET ?event_id=uuid — 로그인 사용자의 해당 이벤트 리마인더 설정 조회
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("event_id")
  if (!eventId) {
    return NextResponse.json({ error: "event_id required" }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("user_calendar_subscriptions")
    .select("remind_d7, remind_d1, remind_dayof")
    .eq("user_id", user.id)
    .eq("event_id", eventId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 행 없으면 모두 false 디폴트
  return NextResponse.json(
    data ?? { remind_d7: false, remind_d1: false, remind_dayof: false }
  )
}

const PostSchema = z.object({
  event_id: z.string().uuid(),
  remind_d7: z.boolean(),
  remind_d1: z.boolean(),
  remind_dayof: z.boolean(),
})

// POST { event_id, remind_d7, remind_d1, remind_dayof } — upsert
// sent_* 플래그는 건드리지 않음 (이미 발송된 알림은 그대로 유지)
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { event_id, remind_d7, remind_d1, remind_dayof } = parsed.data

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  // 셋 중 하나라도 켜져 있으면 알림 활성
  const notification_enabled = remind_d7 || remind_d1 || remind_dayof

  const { error } = await supabase
    .from("user_calendar_subscriptions")
    .upsert(
      {
        user_id: user.id,
        event_id,
        remind_d7,
        remind_d1,
        remind_dayof,
        notification_enabled,
      },
      { onConflict: "user_id,event_id", ignoreDuplicates: false }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
