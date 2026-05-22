import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import {
  runFilmingSpotsIngest,
  type FilmingSpotsIngestResult,
} from "@/lib/curation-k/filming-spots"
import {
  runKpopSpotsIngest,
  type KpopSpotsIngestResult,
} from "@/lib/curation-k/kpop-spots"

export const maxDuration = 300
export const dynamic = "force-dynamic"

// /api/cron/ingest-filming-kpop
//
// filming_spots + kpop_spots 전담 — ingest-curation-k 에서 분리.
// 두 단계 독립 try/catch — 한 단계 실패해도 나머지 진행.
//
// vercel.json: 매주 월요일 04:00 UTC

interface CombinedResult {
  source: "filming-kpop"
  filming: FilmingSpotsIngestResult | null
  kpop: KpopSpotsIngestResult | null
  errors: string[]
}

export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  const combined: CombinedResult = {
    source: "filming-kpop",
    filming: null,
    kpop: null,
    errors: [],
  }

  try {
    const filming = await runFilmingSpotsIngest()
    combined.filming = filming
    combined.errors.push(...filming.errors)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    combined.errors.push(`filming-spots 예외: ${msg}`)
    console.error("[cron/ingest-filming-kpop] filming-spots 예외:", err)
  }

  try {
    const kpop = await runKpopSpotsIngest()
    combined.kpop = kpop
    combined.errors.push(...kpop.errors)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    combined.errors.push(`kpop-spots 예외: ${msg}`)
    console.error("[cron/ingest-filming-kpop] kpop-spots 예외:", err)
  }

  revalidatePath("/curation-k")
  revalidatePath("/api/curation-k/filming-spots")
  revalidatePath("/api/curation-k/kpop-spots")
  revalidatePath("/api/curation-k/map")

  const anyFailed = combined.errors.length > 0
  await recordCronLog("ingest-filming-kpop", anyFailed ? "failed" : "success", combined)

  return NextResponse.json(combined, { status: anyFailed ? 207 : 200 })
}
