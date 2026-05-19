import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import { runFoodRecipesIngest } from "@/lib/ingest/food-recipes"

// KfoodKit (M+4) — MAFRA 한식 레시피 인제스트
// vercel.json: 매월 1일 UTC 06:00 (= KST 15:00). 농림부 데이터셋이 거의 영구 고정 (537건) 이라 월 1회로 충분.
// 수동 호출: Authorization: Bearer ${CRON_SECRET}
//
// 전체 537건 + 재료 6,104 + 과정 3,022 페치 = 약 12 API 호출 / run. 쿼터 1,000/일 의 1% 만 사용.
export const maxDuration = 120
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  const t0 = Date.now()
  try {
    const result = await runFoodRecipesIngest()
    const payload = { elapsedMs: Date.now() - t0, ...result }
    const dbStatus = result.errors.length > 0 ? "failed" : "success"
    await recordCronLog("ingest-food-recipes", dbStatus, payload)
    return NextResponse.json(payload, { status: dbStatus === "failed" ? 207 : 200 })
  } catch (err) {
    const payload = {
      elapsedMs: Date.now() - t0,
      source: "food-recipes" as const,
      fetched: 0,
      upserted: 0,
      skipped: 0,
      errors: [err instanceof Error ? err.message : String(err)],
    }
    await recordCronLog("ingest-food-recipes", "failed", payload)
    return NextResponse.json(payload, { status: 500 })
  }
}
