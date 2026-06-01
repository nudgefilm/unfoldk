import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { generateItemsForDramas } from "@/lib/drama-items/generate"

// KdramaMatch — 신규 드라마 대상 drama_items 자동 생성 (Claude Haiku)
//
// vercel.json: 매주 월요일 UTC 06:30 (ingest-tmdb-dramas 05:30 + 1h)
// 대상: 지난 25시간 내 추가된 신규 드라마 (주간 dramas ingest 직후 신규분 커버)
// 이미 drama_items 있는 드라마는 스킵 (멱등)
// 실패한 드라마는 에러 기록 후 다음 드라마 계속 진행

export const maxDuration = 300
export const dynamic = "force-dynamic"

// 지난 N시간 내 created_at 기준 신규 드라마 조회 윈도우
const LOOKBACK_HOURS = 25

export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  const t0 = Date.now()
  const supabase = createSupabaseAdminClient()

  // 지난 25시간 내 추가된 드라마 조회
  const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString()
  const { data: newDramas, error: dramasErr } = await supabase
    .from("dramas")
    .select("id, title, overview, genre")
    .gte("created_at", since)
    .order("created_at", { ascending: false })

  if (dramasErr) {
    const errMsg = `dramas 조회 실패: ${dramasErr.message}`
    await recordCronLog("ingest-drama-items", "error", { error: errMsg })
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }

  const dramas = (newDramas ?? []) as Array<{
    id: string
    title: string
    overview: string | null
    genre: string | null
  }>

  if (dramas.length === 0) {
    const payload = {
      source: "drama-items",
      since,
      found: 0,
      generated: 0,
      skipped: 0,
      errors: [],
      elapsedMs: Date.now() - t0,
    }
    await recordCronLog("ingest-drama-items", "success", payload)
    return NextResponse.json(payload)
  }

  // 아이템 생성 — 에러 발생 시 해당 드라마만 스킵하고 계속 진행
  const results = await generateItemsForDramas(dramas, { dryRun: false, delayMs: 300 })

  const totalGenerated = results.reduce((sum, r) => sum + r.generated, 0)
  const totalSkipped = results.filter((r) => r.skipped).length
  const errors = results
    .filter((r) => r.error)
    .map((r) => `${r.title}: ${r.error}`)

  const payload = {
    source: "drama-items",
    since,
    found: dramas.length,
    generated: totalGenerated,
    skipped: totalSkipped,
    errors,
    elapsedMs: Date.now() - t0,
  }

  await recordCronLog(
    "ingest-drama-items",
    errors.length > 0 && totalGenerated === 0 ? "error" : "success",
    payload
  )

  return NextResponse.json(payload)
}
