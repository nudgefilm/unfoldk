// 이벤트 2문장 설명 API — DB 우선 조회, 없으면 Claude Haiku 생성 후 DB 저장
// 저장 성공 시 동일 이벤트 재클릭은 DB에서 즉시 반환 (Claude 재호출 없음)
import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()

const SYSTEM_PROMPT = `You are a copywriter for UnfoldK, a Hallyu (Korean wave) event calendar for global K-pop and K-drama fans.
Write exactly 2 short English sentences describing a calendar event.
Rules:
- Exactly 2 sentences, totaling 180 characters or fewer
- Use only the provided event name, type, artist/drama, and date — do not invent specifics not given
- Friendly, fan-oriented tone that builds anticipation
- No emojis, no markdown, no surrounding quotes, no preamble like "Here is..."
- Output the 2 sentences directly with no extra text`

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("event_id")
  const title = searchParams.get("title") ?? ""
  const type = searchParams.get("type") ?? "K-pop"
  const artist = searchParams.get("artist") ?? ""
  const date = searchParams.get("date") ?? ""

  if (!eventId) {
    return NextResponse.json({ error: "event_id required" }, { status: 400 })
  }

  // 프로젝트 표준 admin 클라이언트 — RLS 우회 + persistSession: false
  const supabase = createSupabaseAdminClient()

  // ① DB 기존 description 먼저 확인 — 있으면 Claude 미호출
  const { data, error: selectError } = await supabase
    .from("hallyu_calendar_events")
    .select("description")
    .eq("id", eventId)
    .single()

  if (selectError && selectError.code !== "PGRST116") {
    // PGRST116 = row not found (정상 케이스). 그 외 에러는 로깅.
    console.error("[calendar/description] DB 조회 실패:", selectError.message)
  }

  if (data?.description) {
    return NextResponse.json({ description: data.description, source: "db" })
  }

  // ② Claude Haiku 2문장 설명 생성
  try {
    const artistOrDrama = artist || title
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{
        role: "user",
        content: `Event: ${title}\nType: ${type}\nArtist or Drama: ${artistOrDrama}\nDate: ${date}\n\nWrite the 2-sentence description.`,
      }],
    })

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")
    if (!textBlock) return NextResponse.json({ description: null })

    const description = textBlock.text.trim()
    if (!description || description.length > 400) return NextResponse.json({ description: null })

    // ③ DB에 저장 — 이후 동일 이벤트 조회 시 Claude 재호출 없이 재사용
    const { error: updateError } = await supabase
      .from("hallyu_calendar_events")
      .update({ description })
      .eq("id", eventId)

    if (updateError) {
      console.error("[calendar/description] DB 저장 실패 (eventId:", eventId, "):", updateError.message)
      // 저장 실패해도 이번 요청 응답은 정상 반환 — 다음 클릭 시 재생성됨
    } else {
      console.log("[calendar/description] DB 저장 완료 (eventId:", eventId, ")")
    }

    return NextResponse.json({ description, source: "claude" })
  } catch (err) {
    console.error("[calendar/description] Claude 생성 실패:", err instanceof Error ? err.message : String(err))
    return NextResponse.json({ description: null })
  }
}
