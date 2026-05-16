import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// /api/dramas/trending — 지금 인기 K드라마 Top 5
//
// 정의: 최근 7일간 user_watchlist 신규 등록 (created_at) 이 가장 많은 드라마.
// 완주율: 동일 드라마의 user_watchlist 행 중 status='completed' 비율.
//   - completed 비율은 전체 시청자 풀 (해당 drama 의 모든 user_watchlist 행) 기준.
//   - 분모 < 5 면 표본 부족으로 completion_rate = null (UI 가 "—" 표시).
//
// service_role 로 집계 — user_watchlist RLS 가 본인 행만 노출하므로 anon/auth 클라이언트
// 로는 글로벌 집계 불가. 노출 정보는 drama 메타 + 카운트만 (개인 식별 정보 일체 없음).
//
// 캐싱: 5분 SWR (Vercel CDN). trending 은 시간 단위 변화라 분단위 갱신 불필요.

export const revalidate = 300

interface DramaRow {
  id: string
  tmdb_id: number
  title: string
  title_ko: string | null
  genre: string | null
  year: number | null
  platform: string | null
  poster_url: string | null
  rating: number | null
  episode_count: number | null
  status: string | null
  is_active: boolean
}

interface WatchlistRow {
  drama_id: string
  status: string
  created_at: string
}

export async function GET() {
  const admin = createSupabaseAdminClient()

  // 1. 최근 7일 신규 등록 행 — created_at 기반 (status 무관, "관심 표시" 자체가 시그널)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7)

  const { data: recentRows, error: recentErr } = await admin
    .from("user_watchlist")
    .select("drama_id, status, created_at")
    .gte("created_at", sevenDaysAgo.toISOString())

  if (recentErr) {
    console.error("[/api/dramas/trending] recent 집계 실패:", recentErr)
    return NextResponse.json({ error: "query_failed" }, { status: 500 })
  }

  const recent = (recentRows ?? []) as WatchlistRow[]
  if (recent.length === 0) {
    return NextResponse.json({ trending: [] })
  }

  // 2. drama_id 별 신규 카운트
  const countMap = new Map<string, number>()
  for (const r of recent) {
    countMap.set(r.drama_id, (countMap.get(r.drama_id) ?? 0) + 1)
  }

  // 3. Top 5 drama_id 추출
  const topIds = Array.from(countMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id)

  if (topIds.length === 0) {
    return NextResponse.json({ trending: [] })
  }

  // 4. 해당 drama 들의 전체 watchlist 행 (완주율 계산용)
  const { data: allRowsForTop } = await admin
    .from("user_watchlist")
    .select("drama_id, status")
    .in("drama_id", topIds)

  const totalMap = new Map<string, number>()
  const completedMap = new Map<string, number>()
  for (const r of (allRowsForTop ?? []) as WatchlistRow[]) {
    totalMap.set(r.drama_id, (totalMap.get(r.drama_id) ?? 0) + 1)
    if (r.status === "completed") {
      completedMap.set(r.drama_id, (completedMap.get(r.drama_id) ?? 0) + 1)
    }
  }

  // 5. drama 메타 fetch — is_active=true 만
  const { data: dramaRows, error: dramaErr } = await admin
    .from("dramas")
    .select(
      "id, tmdb_id, title, title_ko, genre, year, platform, poster_url, rating, episode_count, status, is_active"
    )
    .in("id", topIds)
    .eq("is_active", true)

  if (dramaErr) {
    console.error("[/api/dramas/trending] drama 메타 fetch 실패:", dramaErr)
    return NextResponse.json({ error: "query_failed" }, { status: 500 })
  }

  const dramaMap = new Map<string, DramaRow>()
  for (const d of (dramaRows ?? []) as DramaRow[]) {
    dramaMap.set(d.id, d)
  }

  // 6. Top 5 순서 유지 + 완주율 부착
  const COMPLETION_MIN_SAMPLE = 5
  const trending = topIds
    .map((id) => {
      const drama = dramaMap.get(id)
      if (!drama) return null // is_active=false 또는 삭제 → 표시 제외
      const recentAdds = countMap.get(id) ?? 0
      const total = totalMap.get(id) ?? 0
      const completed = completedMap.get(id) ?? 0
      const completionRate =
        total >= COMPLETION_MIN_SAMPLE ? Math.round((completed / total) * 100) : null
      return {
        drama,
        recent_adds: recentAdds,
        completion_rate: completionRate, // 0~100 정수 또는 null
        sample_size: total,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  return NextResponse.json(
    { trending },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    }
  )
}
