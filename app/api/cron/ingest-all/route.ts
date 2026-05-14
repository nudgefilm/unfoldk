import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import { runTmdbIngest } from "@/lib/ingest/tmdb"
import { runYoutubeIngest } from "@/lib/ingest/youtube"
import { runLastfmIngest } from "@/lib/ingest/lastfm"

// 3개 인제스트를 직렬 실행해 단일 cron 슬롯에 묶음 (Vercel Hobby 2개 한도 대응)
// 한 단계 실패가 다른 단계를 막지 않도록 각각 try/catch
export const maxDuration = 300 // 3 단계 합산 시간 — Pro 권장
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  const t0 = Date.now()
  const results: Record<string, unknown> = {}

  // TMDB
  try {
    results.tmdb = await runTmdbIngest()
  } catch (err) {
    results.tmdb = {
      source: "tmdb",
      error: err instanceof Error ? err.message : "unknown",
    }
  }

  // YouTube (Last.fm 시드 내장)
  try {
    results.youtube = await runYoutubeIngest()
  } catch (err) {
    results.youtube = {
      source: "youtube",
      error: err instanceof Error ? err.message : "unknown",
    }
  }

  // Last.fm (검증 전용)
  try {
    results.lastfm = await runLastfmIngest()
  } catch (err) {
    results.lastfm = {
      source: "lastfm",
      error: err instanceof Error ? err.message : "unknown",
    }
  }

  // 각 단계 결과의 upserted 합산 — 어드민 cron 카드의 "수집 이벤트" 메트릭.
  // 단계 결과 객체에 'error' 키가 있으면 upserted 가 없거나 0 (실패 단계는 자연스럽게 0 합산).
  // 새 단계 추가 시 별도 변경 불필요 — Object.values 자동 순회.
  const totalUpserted = Object.values(results).reduce<number>((acc, v) => {
    if (typeof v !== "object" || v === null) return acc
    const u = (v as { upserted?: unknown }).upserted
    return acc + (typeof u === "number" ? u : 0)
  }, 0)

  const payload = {
    elapsedMs: Date.now() - t0,
    total_upserted: totalUpserted,
    ...results,
  }

  // 어떤 단계 하나라도 error 키를 가지면 failed — 그렇지 않으면 success
  const anyFailed = Object.values(results).some(
    (r) => typeof r === "object" && r !== null && "error" in r
  )
  await recordCronLog("ingest-all", anyFailed ? "failed" : "success", payload)

  return NextResponse.json(payload)
}
