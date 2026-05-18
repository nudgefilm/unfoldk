import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import { runTourSpotsIngest, type TourSpotsIngestResult } from "@/lib/ingest/tour-spots"
import {
  runFilmingSpotsIngest,
  type FilmingSpotsIngestResult,
} from "@/lib/curation-k/filming-spots"

export const maxDuration = 300
export const dynamic = "force-dynamic"

// /api/cron/ingest-curation-k — 매일 03:00 UTC (= 12:00 KST)
//
// 단일 cron 으로 Curation K 데이터 전체를 갱신:
//   1) tour_spots: TourAPI 5개 카테고리 (15/12/14/32/39) 통합 수집 + Claude 번역
//   2) filming_spots: ?include_filming=true 일 때만 (자동 cron 에선 수동 큐레이션 정책상 skip)
//
// 수동 트리거:
//   GET /api/cron/ingest-curation-k                          → tour_spots 만
//   GET /api/cron/ingest-curation-k?include_filming=true     → tour_spots + filming_spots

interface CombinedResult {
  source: "curation-k"
  total_upserted: number          // tour_spots 신규/변경 row 수 (어드민 카드 메트릭)
  total_translated: number        // 본 실행에서 번역된 행 수
  categories: TourSpotsIngestResult["categories"]
  filming: FilmingSpotsIngestResult | null
  errors: string[]
}

export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const includeFilming = searchParams.get("include_filming") === "true"

  const combined: CombinedResult = {
    source: "curation-k",
    total_upserted: 0,
    total_translated: 0,
    categories: [],
    filming: null,
    errors: [],
  }

  try {
    const tour = await runTourSpotsIngest()
    combined.total_upserted = tour.total_upserted
    combined.total_translated = tour.total_translated
    combined.categories = tour.categories
    combined.errors.push(...tour.errors)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    combined.errors.push(`tour-spots 단계 최상위 예외: ${msg}`)
    console.error("[cron/ingest-curation-k] tour-spots 최상위 에러:", err)
  }

  if (includeFilming) {
    try {
      const filming = await runFilmingSpotsIngest()
      combined.filming = filming
      combined.errors.push(...filming.errors)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      combined.errors.push(`filming-spots 단계 최상위 예외: ${msg}`)
      console.error("[cron/ingest-curation-k] filming-spots 최상위 에러:", err)
    }
  }

  // /curation-k 페이지 + 지도 핀 API 캐시 즉시 무효화
  revalidatePath("/curation-k")
  revalidatePath("/api/curation-k/map")
  revalidatePath("/api/curation-k/filming-spots")
  revalidatePath("/api/curation-k/tour-spots")

  const anyFailed = combined.errors.length > 0
  await recordCronLog("ingest-curation-k", anyFailed ? "failed" : "success", combined)

  const status = anyFailed ? 207 : 200
  return NextResponse.json(combined, { status })
}
