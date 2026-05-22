import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// GET /api/korean/packs — Drama Learning Packs 목록
//
// 동작 (2026-05-18 v2 — phrase-having 만 노출):
//   1. korean_phrases 에서 drama_id 있는 row 의 distinct drama_id 추출
//      → 학습 컨텐츠가 실제로 존재하는 드라마 (Learning Pack 의 정의)
//   2. 해당 드라마를 popularity 순으로 fetch — limit 없음. 장르 필터 없음.
//      (예능 / 버라이어티 — Running Man, Amazing Saturday 등 — 도 famous-dramas 시드에
//       포함되어 dramas 로 자동 추가되면 자연 노출됨)
//   3. 포스터 없는 row 는 carousel UX 보호 위해 제외
//   4. 로그인 시 user_learning_progress join → mastered/total 비율
//
// 이전 정책: phrase-having + popular filler (PACK_LIMIT=20) — placeholder 카드까지
// 강제 채움. 학습 컨텐츠가 충분히 쌓인 지금은 phrase 있는 드라마만 깔끔하게 노출.
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
  masteredCount: number               // user_learning_progress.status='mastered' 카운트. 비로그인 시 0.
}

interface DramaRow {
  id: string
  title: string
  title_ko: string | null
  poster_url: string | null
}

const DRAMA_SELECT = "id, title, title_ko, poster_url"

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const admin = createSupabaseAdminClient()

  // 1. 로그인 유저 확인
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 2. phrase 가 있는 drama_id 추출 — Learning Pack 의 canonical 후보군
  //    admin 으로 정확히 — anon RLS 는 그래도 public select 통과하지만 일관성 유지.
  const { data: phraseDramaRows, error: phraseDramaErr } = await admin
    .from("korean_phrases")
    .select("drama_id")
    .not("drama_id", "is", null)

  if (phraseDramaErr) {
    console.error("[/api/korean/packs] phrase drama_id 조회 실패:", phraseDramaErr)
    return NextResponse.json(
      { error: "query_failed", message: phraseDramaErr.message },
      { status: 500 }
    )
  }

  const phraseDramaIds = Array.from(
    new Set(
      ((phraseDramaRows ?? []) as Array<{ drama_id: string | null }>)
        .map((r) => r.drama_id)
        .filter((v): v is string => !!v)
    )
  )

  if (phraseDramaIds.length === 0) {
    return NextResponse.json({ packs: [], totalMasteredOverall: 0 })
  }

  // 3. phrase-having dramas fetch — popularity 순. 포스터 없으면 carousel 에서 제외.
  //    is_active=true 만 (soft delete 정책 — 어드민이 비활성화하면 학습팩에서도 빠짐).
  //    장르 필터 없음 — variety / talk 도 famous-dramas 에 추가되어 phrase 가 생기면 자연 노출.
  const { data: dramaRows, error: dramaErr } = await supabase
    .from("dramas")
    .select(DRAMA_SELECT)
    .eq("is_active", true)
    .not("poster_url", "is", null)
    .in("id", phraseDramaIds)
    .order("popularity", { ascending: false, nullsFirst: false })
    .order("rating", { ascending: false, nullsFirst: false })
  if (dramaErr) {
    console.error("[/api/korean/packs] phrase-having dramas 조회 실패:", dramaErr)
    return NextResponse.json(
      { error: "query_failed", message: dramaErr.message },
      { status: 500 }
    )
  }
  const dramas = (dramaRows ?? []) as DramaRow[]

  if (dramas.length === 0) {
    return NextResponse.json({ packs: [], totalMasteredOverall: 0 })
  }

  const dramaIds = dramas.map((d) => d.id)

  // 4. 드라마별 korean_phrases 카운트 + 대표 difficulty
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

  // 6. 로그인 시 user_learning_progress join → mastered 카운트
  const masteredByDrama = new Map<string, number>()
  if (user) {
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

  // 7. 전체 mastered 카운트 — drama_id IS NULL 인 표현도 포함
  //    packs 기반 masteredCount 합산은 drama_id 있는 표현만 잡아 대시보드 숫자가 낮게 나오는 문제 보정.
  let totalMasteredOverall = 0
  if (user) {
    const { count } = await supabase
      .from("user_learning_progress")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "mastered")
    totalMasteredOverall = count ?? 0
  }

  // 8. 응답 빌드
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
      for (const x of stats.difficulties) counts[x] = (counts[x] ?? 0) + 1
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
      masteredCount: mastered,
    }
  })

  return NextResponse.json({ packs, totalMasteredOverall })
}
