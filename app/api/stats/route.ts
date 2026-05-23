import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// /api/stats — 푸터·홈 통계 위젯용 글로벌 카운트.
//
// 응답:
//   total_members:    users 전체 (모든 plan_type 포함)
//   total_countries:  distinct country (NULL 제외)
//   top_countries:    [{ country, count }] 내림차순 30개
//
// 캐싱: 86400 (하루 1회 갱신). 통계는 빈도가 높지만 시간 민감도 낮음.
//
// service_role 사용 — users 글로벌 카운트는 RLS 우회 필요 (anon 은 본인만 읽음).
// PII 누출 없음: 본 응답은 집계 정보만.

export const revalidate = 3600

interface StatsResponse {
  total_members: number
  total_countries: number
  top_countries: Array<{ country: string; count: number }>
}

const PAGE = 1000
const MAX_PAGES = 50 // 50,000 user cap

export async function GET() {
  const admin = createSupabaseAdminClient()

  // 1) 전체 멤버 수 — head:true count
  const { count: totalCount, error: totalErr } = await admin
    .from("users")
    .select("id", { count: "exact", head: true })

  if (totalErr) {
    console.error("[stats] total count 실패:", totalErr.message)
    return NextResponse.json({ error: "query_failed" }, { status: 500 })
  }

  // 2) country 별 집계 — 페이지네이션. PostgREST 가 group by 미지원이라
  //    앱 레벨 카운트. country IS NOT NULL 만 페치.
  const counts = new Map<string, number>()
  for (let p = 0; p < MAX_PAGES; p++) {
    const from = p * PAGE
    const to = from + PAGE - 1
    const { data, error } = await admin
      .from("users")
      .select("country")
      .not("country", "is", null)
      .range(from, to)
    if (error) {
      console.error(`[stats] country page ${p} 실패:`, error.message)
      break
    }
    const rows = (data ?? []) as Array<{ country: string | null }>
    for (const r of rows) {
      const c = r.country?.toUpperCase()
      if (!c || c.length !== 2) continue
      counts.set(c, (counts.get(c) ?? 0) + 1)
    }
    if (rows.length < PAGE) break
  }

  const top_countries = Array.from(counts.entries())
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return a.country.localeCompare(b.country)
    })
    .slice(0, 30)

  const body: StatsResponse = {
    total_members: totalCount ?? 0,
    total_countries: counts.size,
    top_countries,
  }

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
    },
  })
}
