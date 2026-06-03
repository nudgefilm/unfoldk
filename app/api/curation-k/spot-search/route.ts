import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// GET /api/curation-k/spot-search?q=xxx
// tour_spots 테이블에서 eng_title / addr1 ILIKE 검색 — My Hallyu Course TO 입력창 자동완성용
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  console.log("[spot-search] q:", q)
  if (q.length < 2) return NextResponse.json({ items: [] })

  const supabase = await createSupabaseServerClient()
  const pattern = `%${q}%`

  const { data, error } = await supabase
    .from("tour_spots")
    .select("id, eng_title, title, addr1, latitude, longitude")
    .or(`eng_title.ilike.${pattern},addr1.ilike.${pattern}`)
    .limit(8)

  console.log("[spot-search] error:", error)
  console.log("[spot-search] data count:", data?.length ?? 0)
  console.log("[spot-search] data sample:", JSON.stringify(data?.slice(0, 2)))

  if (error) return NextResponse.json({ items: [] })

  type Row = { id: string; eng_title: string | null; title: string; addr1: string | null; latitude: number | null; longitude: number | null }

  return NextResponse.json({
    items: (data ?? []).map((r: Row) => ({
      id: r.id,
      eng_title: r.eng_title || r.title,
      addr1: r.addr1 ?? "",
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
    })),
  })
}
