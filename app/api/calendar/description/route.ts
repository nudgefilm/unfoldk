// 이벤트 2문장 설명 API — DB 우선 조회, 없으면 Claude Haiku 생성 후 DB 저장
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // DB 기존 description 먼저 확인 — 있으면 Claude 미호출
  const { data } = await supabase
    .from("hallyu_calendar_events")
    .select("description")
    .eq("id", eventId)
    .single()

  if (data?.description) {
    return NextResponse.json({ description: data.description })
  }

  // Claude Haiku 2문장 설명 생성
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

    // DB에 저장 — 다음 조회 시 Claude 재호출 없이 재사용
    await supabase
      .from("hallyu_calendar_events")
      .update({ description })
      .eq("id", eventId)

    return NextResponse.json({ description })
  } catch (err) {
    console.error("[calendar/description] Claude 생성 실패:", err instanceof Error ? err.message : String(err))
    return NextResponse.json({ description: null })
  }
}
