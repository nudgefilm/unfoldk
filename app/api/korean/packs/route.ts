import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// GET /api/korean/packs — Drama Learning Packs 목록
//
// 동작:
//   1. dramas 테이블에서 인기·평점 기준 상위 드라마 (포스터 있는 것 우선)
//   2. 각 드라마의 korean_phrases 카운트 + 가장 흔한 difficulty
//   3. 로그인 시 user_learning_progress join → mastered/total 비율
//   4. 비로그인은 progress 0%
//
// 응답: { packs: [{ id, title, posterUrl, phraseCount, difficulty, progressPercent }] }

export const dynamic = "force-dynamic"

interface PackApi {
  id: string                          // drama_id
  title: string
  titleKo: string | null
  posterUrl: string | null
  phraseCount: number
  difficulty: "beginner" | "intermediate" | "advanced" | null
  progressPercent: number
}

const PACK_LIMIT = 20

export async function GET() {
  const supabase = await createSupabaseServerClient()

  // 1. 로그인 유저 확인
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 2. dramas 상위 — popularity desc, 포스터 있는 것 우선, is_active=true
  const { data: dramaRows, error: dramaErr } = await supabase
    .from("dramas")
    .select("id, title, title_ko, poster_url")
    .eq("is_active", true)
    .not("poster_url", "is", null)
    .order("popularity", { ascending: false, nullsFirst: false })
    .order("rating", { ascending: false, nullsFirst: false })
    .limit(PACK_LIMIT)

  if (dramaErr) {
    console.error("[/api/korean/packs] dramas 조회 실패:", dramaErr)
    return NextResponse.json(
      { error: "query_failed", message: dramaErr.message },
      { status: 500 }
    )
  }

  const dramas = (dramaRows ?? []) as Array<{
    id: string
    title: string
    title_ko: string | null
    poster_url: string | null
  }>

  if (dramas.length === 0) {
    return NextResponse.json({ packs: [] })
  }

  const dramaIds = dramas.map((d) => d.id)

  // 3. 드라마별 korean_phrases 카운트 + 대표 difficulty
  // RLS 우회 — service_role admin client 로 정확한 통계 (count 정책 우회 없이 그냥 안정 쿼리)
  const admin = createSupabaseAdminClient()
  const { data: phraseRows } = await admin
    .from("korean_phrases")
    .select("id, drama_id, difficulty")
    .in("drama_id", dramaIds)

  const phrasesByDrama = new Map<
    string,
    { count: number; difficulties: string[] }
  >()
  for (const row of (phraseRows ?? []) as Array<{
    id: string
    drama_id: string
    difficulty: string | null
  }>) {
    const entry = phrasesByDrama.get(row.drama_id) ?? { count: 0, difficulties: [] }
    entry.count += 1
    if (row.difficulty) entry.difficulties.push(row.difficulty)
    phrasesByDrama.set(row.drama_id, entry)
  }

  // 4. 로그인 시 user_learning_progress join → mastered 카운트
  const masteredByDrama = new Map<string, number>()
  if (user) {
    // phrase_id → drama_id 매핑
    const phraseIdToDramaId = new Map<string, string>()
    for (const row of (phraseRows ?? []) as Array<{
      id: string
      drama_id: string
    }>) {
      phraseIdToDramaId.set(row.id, row.drama_id)
    }
    const phraseIds = Array.from(phraseIdToDramaId.keys())
    if (phraseIds.length > 0) {
      const { data: progressRows } = await supabase
        .from("user_learning_progress")
        .select("phrase_id, status")
        .eq("user_id", user.id)
        .in("phrase_id", phraseIds)
        .eq("status", "mastered")
      for (const row of (progressRows ?? []) as Array<{
        phrase_id: string
        status: string
      }>) {
        const dId = phraseIdToDramaId.get(row.phrase_id)
        if (!dId) continue
        masteredByDrama.set(dId, (masteredByDrama.get(dId) ?? 0) + 1)
      }
    }
  }

  // 5. 응답 빌드
  const packs: PackApi[] = dramas.map((d) => {
    const stats = phrasesByDrama.get(d.id)
    const phraseCount = stats?.count ?? 0
    const mastered = masteredByDrama.get(d.id) ?? 0
    const progressPercent =
      phraseCount > 0 ? Math.round((mastered / phraseCount) * 100) : 0

    // 대표 difficulty — 최빈값
    let difficulty: PackApi["difficulty"] = null
    if (stats && stats.difficulties.length > 0) {
      const counts: Record<string, number> = {}
      for (const d of stats.difficulties) counts[d] = (counts[d] ?? 0) + 1
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
      const v = top[0]
      if (v === "beginner" || v === "intermediate" || v === "advanced") {
        difficulty = v
      }
    }

    return {
      id: d.id,
      title: d.title,
      titleKo: d.title_ko,
      posterUrl: d.poster_url,
      phraseCount,
      difficulty,
      progressPercent,
    }
  })

  return NextResponse.json({ packs })
}
