import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// GET /api/korean/phrase-also-in?korean=<text>&exclude_drama=<name>
// 동일 korean_text 기준으로 다른 드라마 출처 목록 반환 (중복 제거, 최대 5개)
export async function GET(request: Request) {
  const url = new URL(request.url)
  const korean = url.searchParams.get("korean")?.trim()
  const excludeDrama = url.searchParams.get("exclude_drama")?.trim()

  if (!korean) {
    return NextResponse.json({ dramas: [] })
  }

  const supabase = await createSupabaseServerClient()

  let query = supabase
    .from("korean_phrases")
    .select("drama_name")
    .eq("korean", korean)
    .not("drama_name", "is", null)

  if (excludeDrama) {
    query = query.neq("drama_name", excludeDrama)
  }

  const { data, error } = await query.limit(20)

  if (error) {
    console.warn(`[phrase-also-in] 조회 실패: ${error.message}`)
    return NextResponse.json({ dramas: [] })
  }

  // 중복 제거 후 최대 5개
  const dramas = [
    ...new Set(
      (data ?? [])
        .map((r) => (r as { drama_name: string | null }).drama_name)
        .filter((n): n is string => Boolean(n))
    ),
  ].slice(0, 5)

  return NextResponse.json({ dramas })
}
