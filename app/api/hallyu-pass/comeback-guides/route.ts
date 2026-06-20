import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { hasProAccess } from "@/lib/auth/plan"

export const dynamic = "force-dynamic"

// GET: 로그인 유저의 추적 아티스트 중 향후 14일 이내 컴백 가이드 반환
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
  const now = new Date()
  const fourteenDaysLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()

  // 유저 추적 아티스트 ID 목록
  const { data: follows } = await admin
    .from("kpop_artist_follows")
    .select("artist_id")
    .eq("user_id", user.id)

  if (!follows || follows.length === 0) {
    return NextResponse.json({ guides: [] })
  }

  const artistIds = (follows as Array<{ artist_id: string }>).map((f) => f.artist_id)

  // 향후 14일 컴백 가이드 + 아티스트 정보 조인
  const { data: guideRows } = await admin
    .from("comeback_guides")
    .select("id, artist_id, event_id, release_date, guide_content, kpop_artists(id, name)")
    .in("artist_id", artistIds)
    .gte("release_date", now.toISOString())
    .lte("release_date", fourteenDaysLater)
    .order("release_date", { ascending: true })

  interface GuideRow {
    id: string
    artist_id: string
    event_id: string | null
    release_date: string
    guide_content: string
    kpop_artists: { id: string; name: string } | null
  }

  const guides = ((guideRows ?? []) as GuideRow[])
    .filter((g) => g.kpop_artists)
    .map((g) => ({
      id: g.id,
      artist_id: g.artist_id,
      artist_name: g.kpop_artists!.name,
      event_id: g.event_id,
      release_date: g.release_date,
      guide_content: g.guide_content,
    }))

  return NextResponse.json({ guides })
}
