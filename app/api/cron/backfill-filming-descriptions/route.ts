import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import { runFilmingDescriptionsBackfill } from "@/lib/curation-k/backfill-filming-descriptions"

export const maxDuration = 120
export const dynamic = "force-dynamic"

// /api/cron/backfill-filming-descriptions — 매일 04:30 UTC (= 13:30 KST)
//
// filming_spots.spot_description NULL row 10건/일 보충.
// ingest-curation-k cron 의 300초 timeout 회피용으로 분리 (2026-05-21).
// NULL row 소진 시 자동 no-op (호출 0건 → 비용 0).
export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  try {
    const result = await runFilmingDescriptionsBackfill()

    revalidatePath("/curation-k")
    revalidatePath("/api/curation-k/filming-spots")

    const anyFailed = result.errors.length > 0
    await recordCronLog(
      "backfill-filming-descriptions",
      anyFailed ? "failed" : "success",
      result
    )

    const status = anyFailed ? 207 : 200
    return NextResponse.json(result, { status })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown"
    const stack = err instanceof Error ? err.stack : undefined
    console.error("[cron/backfill-filming-descriptions] 최상위 에러:", msg, stack)
    await recordCronLog("backfill-filming-descriptions", "failed", { error: msg })
    return NextResponse.json(
      { source: "backfill-filming-descriptions", error: msg, stack },
      { status: 500 }
    )
  }
}
