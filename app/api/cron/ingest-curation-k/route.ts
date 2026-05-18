import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import { runTourSpotsIngest, type TourSpotsIngestResult } from "@/lib/ingest/tour-spots"
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

// /api/cron/ingest-curation-k
//
// 2026-05-19 단계 분리 — 한 cron 실행에서 모두 돌리면 maxDuration 300s
// 초과 위험 + Claude 비용 spike. ?stage 로 분기:
//
//   ?stage=primary    → tour_spots (TourAPI 5 카테고리 + enrichment + 번역)
//   ?stage=secondary  → filming_spots + kpop_spots (Claude 무거운 단계)
//   (미지정)          → 위 3 단계 전부 실행 (어드민 수동 트리거 / 백필용)
//
// 자동 cron (vercel.json):
//   03:00 UTC → ?stage=primary
//   04:00 UTC → ?stage=secondary
//
// 각 단계 독립 try/catch — 한 단계 실패해도 나머지 진행.

type Stage = "primary" | "secondary" | "all"

interface CombinedResult {
  source: "curation-k"
  stage: Stage
  total_upserted: number          // tour_spots 신규/변경 row 수 (어드민 카드 메트릭)
  total_translated: number        // 본 실행에서 번역된 행 수
  total_enriched: number          // detailCommon2 로 overview_ko 채운 row 수
  categories: TourSpotsIngestResult["categories"]
  filming: FilmingSpotsIngestResult | null
  kpop: KpopSpotsIngestResult | null
  errors: string[]
}

function parseStage(raw: string | null): Stage {
  if (raw === "primary" || raw === "secondary") return raw
  return "all"
}

export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const stage = parseStage(searchParams.get("stage"))
  const runTour = stage === "all" || stage === "primary"
  const runSecondary = stage === "all" || stage === "secondary"

  const combined: CombinedResult = {
    source: "curation-k",
    stage,
    total_upserted: 0,
    total_translated: 0,
    total_enriched: 0,
    categories: [],
    filming: null,
    kpop: null,
    errors: [],
  }

  if (runTour) {
    try {
      const tour = await runTourSpotsIngest()
      combined.total_upserted = tour.total_upserted
      combined.total_translated = tour.total_translated
      combined.total_enriched = tour.total_enriched
      combined.categories = tour.categories
      combined.errors.push(...tour.errors)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      combined.errors.push(`tour-spots 단계 최상위 예외: ${msg}`)
      console.error("[cron/ingest-curation-k] tour-spots 최상위 에러:", err)
    }
  }

  if (runSecondary) {
    try {
      const filming = await runFilmingSpotsIngest()
      combined.filming = filming
      combined.errors.push(...filming.errors)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      combined.errors.push(`filming-spots 단계 최상위 예외: ${msg}`)
      console.error("[cron/ingest-curation-k] filming-spots 최상위 에러:", err)
    }

    try {
      const kpop = await runKpopSpotsIngest()
      combined.kpop = kpop
      combined.errors.push(...kpop.errors)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      combined.errors.push(`kpop-spots 단계 최상위 예외: ${msg}`)
      console.error("[cron/ingest-curation-k] kpop-spots 최상위 에러:", err)
    }
  }

  // /curation-k 페이지 + 지도 핀 API 캐시 즉시 무효화
  revalidatePath("/curation-k")
  revalidatePath("/api/curation-k/map")
  revalidatePath("/api/curation-k/filming-spots")
  revalidatePath("/api/curation-k/tour-spots")
  revalidatePath("/api/curation-k/kpop-spots")

  const anyFailed = combined.errors.length > 0
  await recordCronLog("ingest-curation-k", anyFailed ? "failed" : "success", combined)

  const status = anyFailed ? 207 : 200
  return NextResponse.json(combined, { status })
}
