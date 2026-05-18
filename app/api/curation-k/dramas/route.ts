import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// /api/curation-k/dramas — filming_spots 의 drama_title distinct 목록
//
// 용도: /curation-k 필터 바 "All Dramas" 드롭다운 옵션.
// 정렬: 스팟 보유 수 desc (인기 드라마 상단) → drama_title asc.
// 더미 row ('__no_spots_found__') 는 RLS 통과여도 결과에서 제외.

export const revalidate = 600

export interface DramaTitleOption {
  drama_title: string
  spot_count: number
}

export async function GET() {
  const supabase = await createSupabaseServerClient()

  // PostgREST 가 distinct + group_by + count 를 한 번에 안 해줘 — 전체 row 받아서
  // 앱 레벨에서 집계. filming_spots 는 status='confirmed' RLS 자동 적용,
  // 더미 row 는 spot_name='__no_spots_found__' (status='pending') 라 RLS 단에서 차단됨.
  // 안전망으로 한 번 더 .neq 명시.
  const { data, error } = await supabase
    .from("filming_spots")
    .select("drama_title")
    .neq("spot_name", "__no_spots_found__")

  if (error) {
    console.error("[curation-k/dramas] 조회 실패:", error.message)
    return NextResponse.json({ error: "query_failed" }, { status: 500 })
  }

  const counts = new Map<string, number>()
  for (const row of (data ?? []) as Array<{ drama_title: string | null }>) {
    const title = row.drama_title?.trim()
    if (!title) continue
    counts.set(title, (counts.get(title) ?? 0) + 1)
  }

  const items: DramaTitleOption[] = Array.from(counts.entries())
    .map(([drama_title, spot_count]) => ({ drama_title, spot_count }))
    .sort((a, b) => {
      if (b.spot_count !== a.spot_count) return b.spot_count - a.spot_count
      return a.drama_title.localeCompare(b.drama_title)
    })

  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } }
  )
}
