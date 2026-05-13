import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import { runTicketmasterIngest } from "@/lib/ingest/ticketmaster"

// HallyuCalendar (M+0) — Ticketmaster 글로벌 K팝 공연 인제스트
// vercel.json: 매일 UTC 06:30 (= KST 15:30, KOPIS 06:00 다음 30분)
// 수동 호출: Authorization: Bearer ${CRON_SECRET}
export const maxDuration = 120
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  const t0 = Date.now()
  try {
    const result = await runTicketmasterIngest()
    const payload = { elapsedMs: Date.now() - t0, ...result }
    await recordCronLog(
      "ingest-ticketmaster",
      result.error ? "failed" : "success",
      payload
    )
    return NextResponse.json(payload)
  } catch (err) {
    const payload = {
      elapsedMs: Date.now() - t0,
      source: "ticketmaster" as const,
      error: err instanceof Error ? err.message : "unknown",
    }
    await recordCronLog("ingest-ticketmaster", "failed", payload)
    return NextResponse.json(payload, { status: 500 })
  }
}
