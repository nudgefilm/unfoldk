import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import { runKpopWeeklyIngest } from "@/lib/ingest/kpop-weekly"
import { revalidatePath } from "next/cache"

// 매주 월요일 04:00 UTC — 주간 KpopStats 스토리텔링 데이터 생성
// 1. 청취자 급증 Top 3 아티스트 동향 인사이트 (Claude Haiku)
// 2. 주간 K팝 트렌드 리포트 (Claude Haiku)
// 3. 국가별 Top 3 K팝 차트 (Last.fm geo)

export const maxDuration = 120
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  const t0 = Date.now()
  const result = await runKpopWeeklyIngest()

  revalidatePath("/kpop")
  revalidatePath("/api/kpop/weekly-report")
  revalidatePath("/api/kpop/weekly-insights")
  revalidatePath("/api/kpop/country-charts")

  const hasErrors = result.errors.length > 0
  const payload = { ...result, elapsedMs: Date.now() - t0 }

  await recordCronLog(
    "kpop-weekly",
    hasErrors && !result.reportGenerated ? "failed" : "success",
    payload
  )

  return NextResponse.json(payload, { status: hasErrors ? 207 : 200 })
}
