import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// Edge Function 1회 호출당 25배치(500건) × Claude ~3s/배치 ≈ 75s
// Vercel maxDuration 300s 이내 안전하게 완료
export const maxDuration = 300
export const dynamic = "force-dynamic"

const EDGE_FN_URL =
  "https://voxtqmpzaohruqsiwqij.supabase.co/functions/v1/translate-pipeline"

export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  // pending 건수 먼저 확인 — 0이면 no-op으로 즉시 반환 (완료 후 자동 정지)
  const supabase = createSupabaseAdminClient()
  const { count, error: countErr } = await supabase
    .from("beauty_suppliers_staging")
    .select("*", { count: "exact", head: true })
    .eq("translate_status", "pending")

  if (countErr) {
    const payload = { error: countErr.message }
    await recordCronLog("translate-pipeline", "failed", payload)
    return NextResponse.json(payload, { status: 500 })
  }

  const remaining = count ?? 0

  if (remaining === 0) {
    const payload = { skipped: true, reason: "pending 건 없음 — 전체 완료", remaining: 0 }
    await recordCronLog("translate-pipeline", "success", payload)
    return NextResponse.json(payload)
  }

  // Edge Function 호출 (25배치 = 최대 500건/회)
  let result: Record<string, unknown>
  try {
    const res = await fetch(EDGE_FN_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ max_batches: 25 }),
    })
    result = (await res.json()) as Record<string, unknown>
  } catch (err) {
    const payload = { error: err instanceof Error ? err.message : String(err) }
    await recordCronLog("translate-pipeline", "failed", payload)
    return NextResponse.json(payload, { status: 500 })
  }

  const status = result.error ? "failed" : "success"
  await recordCronLog("translate-pipeline", status, result)

  return NextResponse.json(result)
}
