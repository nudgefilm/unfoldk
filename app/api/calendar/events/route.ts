import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// 이벤트 타입 매핑 (DB enum → UI 라벨)
const TYPE_TO_DISPLAY = {
  comeback: "K-pop",
  drama: "K-drama",
  concert: "Concert",
  fanmeet: "Fan Meet",
} as const

// 쿼리 검증 — month=YYYY-MM 형식만 허용
const QuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month는 YYYY-MM 형식이어야 합니다."),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    month: searchParams.get("month") ?? "",
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // 해당 월의 시작·끝 시각 (UTC 기준 — DB는 timestamptz 로 저장)
  const [yearStr, monthStr] = parsed.data.month.split("-")
  const year = Number(yearStr)
  const month = Number(monthStr)
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
  const startOfNextMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0))

  const supabase = await createSupabaseServerClient()

  // RLS 가 is_premium 게이팅을 자동 처리
  const { data, error } = await supabase
    .from("hallyu_calendar_events")
    .select("id, type, title, artist_or_drama, event_date, event_time_label, description, is_premium")
    .gte("event_date", startOfMonth.toISOString())
    .lt("event_date", startOfNextMonth.toISOString())
    .order("event_date", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // UI 가 기대하는 shape 으로 변환
  const events = (data ?? []).map((row) => {
    const eventDate = new Date(row.event_date)
    return {
      id: row.id,
      title: row.title,
      date: eventDate.getUTCDate(), // 1~31, 일자
      type: TYPE_TO_DISPLAY[row.type as keyof typeof TYPE_TO_DISPLAY],
      time: row.event_time_label ?? undefined,
      artist: row.artist_or_drama,
      description: row.description ?? undefined,
      isPremium: row.is_premium,
    }
  })

  return NextResponse.json({ events, month: parsed.data.month })
}
