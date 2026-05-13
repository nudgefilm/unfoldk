import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import { runKopisIngest } from "@/lib/ingest/kopis"

// HallyuCalendar (M+0) — KOPIS 공연(K팝 콘서트/팬미팅) 인제스트
// vercel.json: 매일 UTC 06:00 (= KST 15:00)
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
    const result = await runKopisIngest()
    const payload = { elapsedMs: Date.now() - t0, ...result }
    await recordCronLog(
      "ingest-kopis",
      result.error ? "failed" : "success",
      payload
    )
    return NextResponse.json(payload)
  } catch (err) {
    const payload = {
      elapsedMs: Date.now() - t0,
      source: "kopis" as const,
      error: err instanceof Error ? err.message : "unknown",
    }
    await recordCronLog("ingest-kopis", "failed", payload)
    return NextResponse.json(payload, { status: 500 })
  }
}
