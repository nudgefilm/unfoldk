import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// GET /api/korean/phrases — Explore Expressions 섹션용 전체 목록
//
// 쿼리:
//   page  : 1-based 페이지 번호 (기본 1)
//   limit : 페이지당 항목 수 (기본 60, 최대 500) — 클라이언트가 한 번에 전체 fetch 후 셔플
//
// 응답: { phrases, total, page, limit }

export const dynamic = "force-dynamic"

const QuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(60),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    page:  searchParams.get("page")  ?? 1,
    limit: searchParams.get("limit") ?? 60,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { page, limit } = parsed.data
  const offset = (page - 1) * limit

  const supabase = await createSupabaseServerClient()
  const { data, error, count } = await supabase
    .from("korean_phrases")
    .select("id, korean, english, difficulty", { count: "exact" })
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    { phrases: data ?? [], total: count ?? 0, page, limit },
    { headers: { "Cache-Control": "private, max-age=300" } }
  )
}
