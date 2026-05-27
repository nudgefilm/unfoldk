import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// GET /api/korean/phrase-context?pack_id=<drama_id>
// 특정 팩(드라마)의 표현별 맥락 정보 반환 — 팩 상세 모달에서 사용.
//
// 반환: { contexts: PhraseContext[] }
//   PhraseContext { phrase_id, episode_tag, scene_description, emotion_tag }
//
// 인증 불필요 — 공개 학습 콘텐츠

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const packId = searchParams.get("pack_id")

  if (!packId) {
    return NextResponse.json({ error: "pack_id required" }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from("korean_phrases")
    .select("id, episode_tag, scene_description, emotion_tag")
    .eq("drama_id", packId)
    .not("id", "is", null)

  if (error) {
    console.error("[phrase-context] 조회 실패:", error.message)
    return NextResponse.json({ contexts: [] })
  }

  type Row = {
    id: string
    episode_tag: string | null
    scene_description: string | null
    emotion_tag: string | null
  }

  const contexts = ((data ?? []) as Row[]).map((r) => ({
    phrase_id: r.id,
    episode_tag: r.episode_tag,
    scene_description: r.scene_description,
    emotion_tag: r.emotion_tag,
  }))

  return NextResponse.json({ contexts })
}
