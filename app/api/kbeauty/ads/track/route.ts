import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  let body: { ad_id?: string; event?: string }
  try {
    body = await req.json() as { ad_id?: string; event?: string }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { ad_id, event } = body

  if (!ad_id || !event || !["impression", "click"].includes(event)) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 })
  }

  const field = event === "impression" ? "impressions_count" : "clicks_count"

  // 현재 값 조회 후 +1 갱신 (비인증 트래킹 허용)
  const { data: ad, error: fetchErr } = await supabaseAdmin
    .from("beauty_ads")
    .select(field)
    .eq("id", ad_id)
    .eq("status", "active")
    .single()

  if (fetchErr || !ad) {
    return NextResponse.json({ ok: false }, { status: 404 })
  }

  const currentVal = (ad as Record<string, number>)[field] ?? 0
  await supabaseAdmin
    .from("beauty_ads")
    .update({ [field]: currentVal + 1 })
    .eq("id", ad_id)

  return NextResponse.json({ ok: true })
}
