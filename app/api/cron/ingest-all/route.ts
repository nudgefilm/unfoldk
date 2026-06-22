import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import { runYoutubeIngest } from "@/lib/ingest/youtube"

// YouTube 인제스트만 실행 (TMDB, Last.fm, KpopStats 제거됨)
export const maxDuration = 200
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  const t0 = Date.now()
  const results: Record<string, unknown> = {}

  // YouTube (HallyuCalendar 이벤트 + 아티스트 채널 갱신)
  try {
    results.youtube = await runYoutubeIngest()
  } catch (err) {
    results.youtube = {
      source: "youtube",
      error: err instanceof Error ? err.message : "unknown",
    }
  }

  const totalUpserted = Object.values(results).reduce<number>((acc, v) => {
    if (typeof v !== "object" || v === null) return acc
    const u = (v as { upserted?: unknown }).upserted
    return acc + (typeof u === "number" ? u : 0)
  }, 0)

  const payload = {
    elapsedMs: Date.now() - t0,
    total_upserted: totalUpserted,
    ...results,
  }

  const anyFailed = Object.values(results).some(
    (r) => typeof r === "object" && r !== null && "error" in r
  )
  await recordCronLog("ingest-all", anyFailed ? "failed" : "success", payload)

  return NextResponse.json(payload)
}
