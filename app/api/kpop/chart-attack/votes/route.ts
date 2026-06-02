import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// GET  /api/kpop/chart-attack/votes       — 팬덤 화력 랭킹 (상위 5)
// POST /api/kpop/chart-attack/votes       — 특정 아티스트 +1 투표 (로그인 필요)
//
// PopCat 방식: 클릭마다 vote_count +1. 로그인 유저만 허용 (봇 방지 최소화).
// chart_attack_votes 는 artist당 1행 (upsert on conflict artist_id).

const VoteSchema = z.object({
  artist_id: z.string().uuid(),
})

export async function GET() {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from("chart_attack_votes")
    .select(`
      artist_id, vote_count, updated_at,
      kpop_artists!inner(name, name_ko, thumbnail_url)
    `)
    .order("vote_count", { ascending: false })
    .limit(5)

  if (error) {
    console.error("[chart-attack/votes GET]", error.message)
    return NextResponse.json({ rankings: [] })
  }

  type Row = {
    artist_id: string
    vote_count: number
    updated_at: string
    kpop_artists: { name: string; name_ko: string | null; thumbnail_url: string | null } | null
  }

  const rankings = ((data ?? []) as unknown as Row[]).map((r, i) => ({
    rank: i + 1,
    artist_id: r.artist_id,
    name: r.kpop_artists?.name ?? "Unknown",
    name_ko: r.kpop_artists?.name_ko ?? null,
    thumbnail_url: r.kpop_artists?.thumbnail_url ?? null,
    vote_count: r.vote_count,
  }))

  return NextResponse.json({ rankings })
}

export async function POST(request: Request) {
  // 로그인 필요
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 })
  }

  let raw: unknown
  try { raw = await request.json() } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }) }
  const parsed = VoteSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { artist_id } = parsed.data
  const admin = createSupabaseAdminClient()

  // upsert: 없으면 insert(1), 있으면 update(count+1)
  // Supabase 는 RPC 없이 atomic increment 가 어려워 RPC 또는 클라이언트 fetch+upsert 사용.
  // 여기서는 단순 SELECT → 계산 → UPSERT 방식 (동시 클릭 collide 가능성은 PopCat 컨셉상 허용).
  const { data: existing } = await admin
    .from("chart_attack_votes")
    .select("vote_count")
    .eq("artist_id", artist_id)
    .maybeSingle()

  const newCount = ((existing?.vote_count as number | null) ?? 0) + 1

  const { error } = await admin
    .from("chart_attack_votes")
    .upsert(
      { artist_id, vote_count: newCount, updated_at: new Date().toISOString() },
      { onConflict: "artist_id" }
    )

  if (error) {
    console.error("[chart-attack/votes POST]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ vote_count: newCount })
}
