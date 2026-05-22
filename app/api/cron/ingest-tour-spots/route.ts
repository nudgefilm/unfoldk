import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import { runTourSpotsIngest } from "@/lib/ingest/tour-spots"

export const maxDuration = 300
export const dynamic = "force-dynamic"

// /api/cron/ingest-tour-spots
//
// tour_spots 5개 카테고리 전담 — ingest-curation-k 에서 분리.
//
// vercel.json 스케줄:
//   매일 03:00 UTC      → ?only_festivals=true  (축제·행사 — 시간 민감)
//   매주 월요일 03:30 UTC → 전체 5개 카테고리

export async function GET(request: Request) {
  console.log("[cron/ingest-tour-spots] GET 수신:", request.url)

  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    console.warn("[cron/ingest-tour-spots] auth 실패:", auth.reason)
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const onlyFestivals = searchParams.get("only_festivals") === "true"
  console.log("[cron/ingest-tour-spots] auth ok | onlyFestivals:", onlyFestivals)

  let result: Awaited<ReturnType<typeof runTourSpotsIngest>>
  try {
    result = await runTourSpotsIngest({ onlyFestivals })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const errResult = { source: "tour-spots", stage: onlyFestivals ? "festivals" : "all", error: msg }
    await recordCronLog("ingest-tour-spots", "failed", errResult)
    console.error("[cron/ingest-tour-spots] 최상위 예외:", err)
    return NextResponse.json(errResult, { status: 500 })
  }

  revalidatePath("/curation-k")
  revalidatePath("/api/curation-k/tour-spots")
  revalidatePath("/api/curation-k/map")

  const anyFailed = result.errors.length > 0
  await recordCronLog("ingest-tour-spots", anyFailed ? "failed" : "success", result)

  return NextResponse.json(result, { status: anyFailed ? 207 : 200 })
}
