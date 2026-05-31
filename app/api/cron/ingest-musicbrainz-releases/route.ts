import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import { runMbReleasesIngest } from "@/lib/ingest/musicbrainz-releases"
import { revalidatePath } from "next/cache"

// 매주 화요일 05:00 UTC — MusicBrainz 앨범 히스토리 증분 수집
//
// 대상: musicbrainz_id 보유 아티스트 중 최근 30일 내 미동기화 아티스트
// 1회 실행당 최대 20명 처리 (1.1초 × 20 ≈ 22초 — maxDuration 60초 여유)
// MusicBrainz rate limit 1 req/sec 준수

export const maxDuration = 60
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  const t0 = Date.now()
  const result = await runMbReleasesIngest()

  // 아티스트 상세 페이지 캐시 무효화 (앨범 섹션 반영)
  revalidatePath("/kpop/[id]", "page")

  const hasErrors = result.errors.length > 0
  const payload = { ...result, elapsedMs: Date.now() - t0 }

  await recordCronLog(
    "ingest-musicbrainz-releases",
    hasErrors && result.processed === 0 ? "failed" : "success",
    payload
  )

  return NextResponse.json(payload, { status: hasErrors ? 207 : 200 })
}
