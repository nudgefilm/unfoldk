import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import { runFoodRecipesIngest } from "@/lib/ingest/food-recipes"
import {
  runFoodImageBackfill,
  type FoodImageBackfillResult,
} from "@/lib/ingest/food-image-backfill"

// KfoodKit (M+4) — MAFRA 한식 레시피 인제스트 + MFDS 이미지 backfill
// vercel.json: 매월 1일 UTC 06:00 (= KST 15:00). MAFRA·MFDS 둘 다 거의 영구 고정 데이터.
// 수동 호출: Authorization: Bearer ${CRON_SECRET}
//
// 두 단계 — 독립 try/catch. backfill 실패해도 ingest 결과는 보존.
//   1) MAFRA 전체 537건 + 재료 6,104 + 과정 3,022 페치 → food_recipes upsert (~12 API 호출)
//   2) MFDS COOKRCP01 (~1,200건) 전체 fetch → image_url=null 매칭 → image_url UPDATE
export const maxDuration = 180
export const dynamic = "force-dynamic"

interface CombinedPayload {
  source: "food-recipes"
  elapsedMs: number
  fetched: number
  upserted: number
  skipped: number
  backfill: FoodImageBackfillResult | null
  errors: string[]
}

export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  const t0 = Date.now()
  const combined: CombinedPayload = {
    source: "food-recipes",
    elapsedMs: 0,
    fetched: 0,
    upserted: 0,
    skipped: 0,
    backfill: null,
    errors: [],
  }

  // 1) MAFRA ingest
  try {
    const result = await runFoodRecipesIngest()
    combined.fetched = result.fetched
    combined.upserted = result.upserted
    combined.skipped = result.skipped
    combined.errors.push(...result.errors)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    combined.errors.push(`MAFRA ingest 최상위 예외: ${msg}`)
    console.error("[cron/ingest-food-recipes] MAFRA 최상위 에러:", err)
  }

  // 2) MFDS 이미지 backfill (MFDS_API_KEY 미설정 시 errors[] 로만 기록, 다른 단계 진행)
  try {
    const backfill = await runFoodImageBackfill()
    combined.backfill = backfill
    combined.errors.push(...backfill.errors)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    combined.errors.push(`image backfill 최상위 예외: ${msg}`)
    console.error("[cron/ingest-food-recipes] backfill 최상위 에러:", err)
  }

  combined.elapsedMs = Date.now() - t0
  const dbStatus = combined.errors.length > 0 ? "failed" : "success"
  await recordCronLog("ingest-food-recipes", dbStatus, combined)
  return NextResponse.json(combined, { status: dbStatus === "failed" ? 207 : 200 })
}
