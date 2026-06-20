import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { verifyCronAuth } from "@/lib/cron/auth"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const anthropic = new Anthropic()

// ─── Claude Haiku 가이드 생성 ─────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the content editor for UnfoldK, a Hallyu fan platform. Write practical fan streaming guides for upcoming K-pop comebacks. Focus on legitimate fan support strategies — timing, platform diversity, and community coordination. Never suggest bot streaming, coordinated manipulation, or chart gaming. Plain English. No markdown. No emojis.`

const GUIDE_TOOL: Anthropic.Tool = {
  name: "submit_guide",
  description: "Submit the comeback streaming guide for Hallyu Pass members.",
  input_schema: {
    type: "object" as const,
    properties: {
      guide: {
        type: "string",
        description:
          "3-4 sentences total. Sentence 1-2: when and how to stream on release day for maximum impact (timing, platform diversity). Sentence 3: community tip (fan clubs, trending coordination). Sentence 4: one chart milestone to watch. Max 320 characters. Plain English.",
      },
    },
    required: ["guide"],
  },
}

interface EventRecord {
  id: string
  title: string
  artist_or_drama: string
  event_date: string
  matched_artist_id: string
}

async function generateGuide(event: EventRecord): Promise<string> {
  // KST 포맷 (UTC+9)
  const kstStr = new Date(event.event_date).toLocaleString("en-US", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  })

  const prompt = `Artist: ${event.artist_or_drama}
Event: ${event.title}
Release date: ${kstStr} KST

Write the comeback streaming guide using the submit_guide tool.`

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: [GUIDE_TOOL],
      tool_choice: { type: "tool", name: GUIDE_TOOL.name },
      messages: [{ role: "user", content: prompt }],
    })
    const toolBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    )
    return (toolBlock?.input as { guide?: string })?.guide ?? ""
  } catch {
    return ""
  }
}

// ─── Cron 핸들러 ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const admin = createSupabaseAdminClient()
  const now = new Date()
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

  // 1. 추적 중인 고유 아티스트 목록
  const { data: followRows } = await admin
    .from("kpop_artist_follows")
    .select("artist_id")

  const uniqueIds = [
    ...new Set(((followRows ?? []) as Array<{ artist_id: string }>).map((r) => r.artist_id)),
  ]

  if (uniqueIds.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, skipped: 0, message: "No tracked artists" })
  }

  // 2. 추적 아티스트 이름 조회
  const { data: artistRows } = await admin
    .from("kpop_artists")
    .select("id, name")
    .in("id", uniqueIds)

  // 소문자 이름 → artist_id 매핑
  const nameToId = new Map<string, string>(
    ((artistRows ?? []) as Array<{ id: string; name: string }>).map((a) => [
      a.name.toLowerCase(),
      a.id,
    ])
  )

  // 3. 향후 7일 이내 comeback 이벤트 조회
  const { data: eventRows } = await admin
    .from("hallyu_calendar_events")
    .select("id, title, artist_or_drama, event_date")
    .eq("type", "comeback")
    .gte("event_date", now.toISOString())
    .lte("event_date", sevenDaysLater)
    .order("event_date", { ascending: true })

  // 추적 아티스트와 매칭
  const matchedEvents: EventRecord[] = ((eventRows ?? []) as Array<{
    id: string
    title: string
    artist_or_drama: string
    event_date: string
  }>)
    .map((ev) => {
      const artistId = nameToId.get(ev.artist_or_drama.toLowerCase())
      return artistId ? { ...ev, matched_artist_id: artistId } : null
    })
    .filter((ev): ev is EventRecord => ev !== null)

  if (matchedEvents.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, skipped: 0, message: "No matching events" })
  }

  // 4. 멱등성 체크 — 이미 event_id 로 가이드 생성된 이벤트 제외
  const eventIds = matchedEvents.map((e) => e.id)
  const { data: existingGuides } = await admin
    .from("comeback_guides")
    .select("event_id")
    .in("event_id", eventIds)

  const existingEventIds = new Set(
    ((existingGuides ?? []) as Array<{ event_id: string }>).map((g) => g.event_id)
  )

  const newEvents = matchedEvents.filter((e) => !existingEventIds.has(e.id))

  if (newEvents.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      skipped: matchedEvents.length,
      message: "All guides already exist",
    })
  }

  // 5. 신규 이벤트 가이드 생성 (3개 단위 병렬)
  let saved = 0
  let errors = 0
  const BATCH = 3

  for (let i = 0; i < newEvents.length; i += BATCH) {
    const batch = newEvents.slice(i, i + BATCH)
    const results = await Promise.all(
      batch.map(async (ev) => {
        try {
          const guideContent = await generateGuide(ev)
          if (!guideContent) return "error"

          await admin.from("comeback_guides").insert({
            artist_id: ev.matched_artist_id,
            event_id: ev.id,
            release_date: ev.event_date,
            guide_content: guideContent,
          })
          return "saved"
        } catch {
          return "error"
        }
      })
    )
    saved += results.filter((r) => r === "saved").length
    errors += results.filter((r) => r === "error").length
  }

  return NextResponse.json({
    ok: true,
    total: matchedEvents.length,
    saved,
    skipped: existingEventIds.size,
    errors,
  })
}
