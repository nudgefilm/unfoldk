import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// GET /api/dramas/[id]/shop — 드라마 승인된 쇼핑 아이템 목록 (공개 엔드포인트)
// 응답: { items: DramaItem[] }
// admin client 사용 — 공개 read 이므로 RLS 우회 후 코드 레벨에서 is_approved 필터

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("drama_items")
    .select("id, name, category, brand, description, purchase_url")
    .eq("drama_id", id)
    .eq("is_approved", true)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[dramas/shop] 조회 실패:", error.message, "drama_id:", id)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}
