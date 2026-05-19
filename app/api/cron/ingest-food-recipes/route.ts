import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import { runFoodRecipesIngest } from "@/lib/ingest/food-recipes"

// KfoodKit (M+4) — Spoonacular 한식 레시피 인제스트
// vercel.json: 매주 월요일 UTC 06:00 (= KST 15:00)
// 수동 호출: Authorization: Bearer ${CRON_SECRET}
//
// quota 보호 — Spoonacular Cooking plan 일 150 points. weekly 호출 + cap=50 으로
// 일일 quota 의 1/3 만 사용. 실시간 호출 (사용자 facing) 은 별도 라우트에서.
export const maxDuration = 60
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
