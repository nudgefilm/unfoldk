import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { generateComparisonInsight } from "@/lib/claude/kpop-comparison"

// POST /api/kpop/comparison-insight
// body: { artist_a_id, artist_b_id, dataA, dataB, topCountriesA, topCountriesB }
// 24시간 캐시 → 만료 시 Claude Haiku 재생성

export const dynamic = "force-dynamic"
export const maxDuration = 30

interface InsightRequest {
  artist_a_id: string
  artist_b_id: string
  artistA: { name: string; listeners: number | null; plays: number | null; growth30d: number | null }
  artistB: { name: string; listeners: number | null; plays: number | null; growth30d: number | null }
  topCountriesA: string[]
  topCountriesB: string[]
}

export async function POST(request: Request) {
  let body: InsightRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const { artist_a_id, artist_b_id, artistA, artistB, topCountriesA, topCountriesB } = body
  if (!artist_a_id || !artist_b_id) {
    return NextResponse.json({ error: "artist_a_id and artist_b_id required" }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const CACHE_HOURS = 24

  // 캐시 조회 (artist_a, artist_b 또는 반대 순서 모두 확인)
  const { data: cached } = await admin
    .from("kpop_comparison_cache")
    .select("insight, created_at")
    .or(
      `and(artist_a_id.eq.${artist_a_id},artist_b_id.eq.${artist_b_id}),and(artist_a_id.eq.${artist_b_id},artist_b_id.eq.${artist_a_id})`
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (cached) {
    const ageHours = (Date.now() - new Date(cached.created_at as string).getTime()) / 3600000
    if (ageHours < CACHE_HOURS) {
      return NextResponse.json({ insight: cached.insight, cached: true })
    }
  }

  // 캐시 미스 or 만료 → Claude 생성
  let insight: string
  try {
    insight = await generateComparisonInsight({ artistA, artistB, topCountriesA, topCountriesB })
  } catch (err) {
    console.error("[comparison-insight] Claude 실패:", String(err))
    return NextResponse.json({ error: "generation_failed" }, { status: 500 })
  }

  if (!insight) {
    return NextResponse.json({ error: "empty_insight" }, { status: 500 })
  }

  // DB 저장 (upsert — 순서 고정: a < b UUID)
  const [orderedA, orderedB] = artist_a_id < artist_b_id
    ? [artist_a_id, artist_b_id]
    : [artist_b_id, artist_a_id]

  await admin.from("kpop_comparison_cache").upsert(
    { artist_a_id: orderedA, artist_b_id: orderedB, insight, created_at: new Date().toISOString() },
    { onConflict: "artist_a_id,artist_b_id" }
  )

  return NextResponse.json({ insight, cached: false })
}
