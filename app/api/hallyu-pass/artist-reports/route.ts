import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { hasProAccess } from "@/lib/auth/plan"

export const dynamic = "force-dynamic"

// 이번 주 월요일 날짜 반환 (UTC)
function getWeekStart(): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

interface ReportRow {
  artist_id: string
  week_start: string
  listener_count: number
  listener_change: number
  top_countries: Array<{ country_code: string; listeners: number }>
  new_events_count: number
  summary_text: string
}

// GET: 로그인 유저의 추적 아티스트 + 이번 주 리포트 반환
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("plan_type, trial_ends_at, is_admin")
    .eq("id", user.id)
    .single()

  const p = profile as { plan_type?: string; trial_ends_at?: string; is_admin?: boolean } | null
  if (
    !hasProAccess({ planType: p?.plan_type, trialEndsAt: p?.trial_ends_at, isAdmin: p?.is_admin })
  ) {
    return NextResponse.json({ error: "Pro access required" }, { status: 403 })
  }

  const admin = createSupabaseAdminClient()
  const weekStart = getWeekStart()

  // 유저 추적 아티스트 + 아티스트 기본 정보 조인
  const { data: follows } = await admin
    .from("kpop_artist_follows")
    .select("artist_id, kpop_artists(id, name)")
    .eq("user_id", user.id)

  if (!follows || follows.length === 0) {
    return NextResponse.json({ artists: [] })
  }

  const artistIds = (follows as Array<{ artist_id: string }>).map((f) => f.artist_id)

  // 이번 주 리포트 일괄 조회
  const { data: reports } = await admin
    .from("artist_weekly_reports")
    .select(
      "artist_id, week_start, listener_count, listener_change, top_countries, new_events_count, summary_text"
    )
    .in("artist_id", artistIds)
    .eq("week_start", weekStart)

  const reportMap = new Map<string, ReportRow>(
    ((reports ?? []) as ReportRow[]).map((r) => [r.artist_id, r])
  )

  const artists = (
    follows as Array<{
      artist_id: string
      kpop_artists: { id: string; name: string } | null
    }>
  )
    .map((f) => {
      if (!f.kpop_artists) return null
      return {
        id: f.kpop_artists.id,
        name: f.kpop_artists.name,
        report: reportMap.get(f.artist_id) ?? null,
      }
    })
    .filter(Boolean)

  return NextResponse.json({ artists })
}
