import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// GET /api/korean/emotion-pack-map
// 드라마 팩별 감정 태그 목록 반환 — 필터 칩 표시 + 팩 필터링에 사용.
//
// 반환: { map: { [dramaId]: string[] } }
//   key = drama_id (PackApi.id 와 동일)
//   value = 해당 팩의 표현에 존재하는 감정 태그 배열 (중복 제거)
//
// 인증 불필요 — 필터 칩 노출용 메타데이터

export const dynamic = "force-dynamic"
export const revalidate = 3600  // 1시간 캐시 (감정 태그는 자주 바뀌지 않음)

export async function GET() {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from("korean_phrases")
    .select("drama_id, emotion_tag")
    .not("emotion_tag", "is", null)
    .not("drama_id", "is", null)

  if (error) {
    console.error("[emotion-pack-map] 조회 실패:", error.message)
    return NextResponse.json({ map: {} })
  }

  // drama_id 별로 emotion_tag 중복 제거 그룹핑
  const map: Record<string, string[]> = {}
  for (const row of (data ?? []) as { drama_id: string; emotion_tag: string }[]) {
    const tags = map[row.drama_id] ?? []
    if (!tags.includes(row.emotion_tag)) tags.push(row.emotion_tag)
    map[row.drama_id] = tags
  }

  return NextResponse.json({ map })
}
