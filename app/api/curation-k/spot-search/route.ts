import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// GET /api/curation-k/spot-search?q=xxx
// tour_spots 테이블에서 eng_title / addr1 ILIKE 검색 — My Hallyu Course TO 입력창 자동완성용
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  if (q.length < 2) return NextResponse.json({ items: [] })

  const supabase = await createSupabaseServerClient()
  const pattern = `%${q}%`

  const { data, error } = await supabase
    .from("tour_spots")
    .select("id, eng_title, title, addr1, latitude, longitude")
    .or(`eng_title.ilike.${pattern},addr1.ilike.${pattern}`)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .limit(8)

  if (error) return NextResponse.json({ items: [] })

  return NextResponse.json({
    items: (data ?? []).map((r: { id: string; eng_title: string | null; title: string; addr1: string | null; latitude: number; longitude: number }) => ({
      id: r.id,
      eng_title: r.eng_title || r.title,
      addr1: r.addr1 ?? "",
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
    })),
  })
}
