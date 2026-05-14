import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

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

  // 어드민 우대 — is_admin = true 면 RLS 우회용 service role 클라이언트로 모든 premium 이벤트 조회
  // (Pro 유저는 RLS 가 자동 통과시키므로 분기 불필요)
  let queryClient: ReturnType<typeof createSupabaseAdminClient> | typeof supabase = supabase
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle()
    if ((profile as { is_admin?: boolean } | null)?.is_admin === true) {
      queryClient = createSupabaseAdminClient()
    }
  }

  // RLS 가 is_premium 게이팅을 자동 처리 (어드민은 위에서 service role 로 우회됨)
  // KOPIS 인제스트 데이터는 DB 보존하되 캘린더 노출에서 제외 (2026-05 정책)
  // source_api 는 Featured 섹션의 Ticketmaster 우선 정렬에 사용
  const { data, error } = await queryClient
    .from("hallyu_calendar_events")
    .select("id, type, title, artist_or_drama, event_date, event_time_label, description, is_premium, thumbnail_url, source_api, url, created_at")
    .neq("source_api", "kopis")
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
      thumbnailUrl: row.thumbnail_url ?? undefined,
      sourceApi: row.source_api ?? undefined,
      // 외부 티켓 예매 페이지 — Ticketmaster ev.url. UI 'Get Tickets' 버튼 표시 조건.
      // KOPIS 는 현재 노출 차단 + url 미수집 (Melon Ticket 링크 향후 검토). source_api='ticketmaster' 일 때만 의미 있음.
      url: row.url ?? undefined,
      createdAt: row.created_at,
    }
  })

  return NextResponse.json({ events, month: parsed.data.month })
}
