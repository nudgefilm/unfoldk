import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import { runFilmingSpotsIngest } from "@/lib/curation-k/filming-spots"

export const maxDuration = 300
export const dynamic = "force-dynamic"

// /api/cron/ingest-filming-spots — 매일 03:00 UTC (= 12:00 KST)
// 흐름: 인기 K드라마 후보 → Claude Haiku 촬영지 추출 → TourAPI GPS 매핑 → filming_spots insert
// 일일 cap (5 dramas/run × 5 spots = 25 신규/일) 로 비용 + 품질 통제
export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  try {
    const result = await runFilmingSpotsIngest()

    // /curation-k 페이지 + 지도 핀 API 캐시 즉시 무효화
    revalidatePath("/curation-k")
    revalidatePath("/api/curation-k/map")
    revalidatePath("/api/curation-k/filming-spots")

    // 어드민 모니터에서 조회 가능하도록 로그 기록 (실패는 swallow — cron 본 작업과 분리)
    const anyFailed = result.errors.length > 0
    await recordCronLog("ingest-filming-spots", anyFailed ? "failed" : "success", result)

    const status = anyFailed ? 207 : 200
    return NextResponse.json(result, { status })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown"
    const stack = err instanceof Error ? err.stack : undefined
    console.error("[cron/ingest-filming-spots] 최상위 에러:", msg, stack)
    await recordCronLog("ingest-filming-spots", "failed", { error: msg })
    return NextResponse.json(
      { source: "filming-spots", error: msg, stack },
      { status: 500 }
    )
  }
}
