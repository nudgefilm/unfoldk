import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { recordCronLog } from "@/lib/cron/log"
import { runDramaIngest } from "@/lib/ingest/dramas"

// KdramaMatch (M+2) 드라마 카탈로그 인제스트
// vercel.json: 매일 UTC 05:30 (= KST 14:30) — ingest-all 04:00 와 30분 간격으로 부하 분산
// 수동 호출: Authorization: Bearer ${CRON_SECRET}
export const maxDuration = 300
export const dynamic = "force-dynamic"

// 임의 예외 → 디버그 가능한 직렬화 형태로 변환 (Error 객체는 JSON.stringify 시 {} 가 되는 문제 회피)
function serializeError(err: unknown): {
  message: string
  name?: string
  stack?: string
  cause?: string
  raw?: string
} {
  if (err instanceof Error) {
    return {
      message: err.message || "(empty error message)",
      name: err.name,
      stack: err.stack?.split("\n").slice(0, 5).join("\n"),
      cause: err.cause ? String(err.cause) : undefined,
    }
  }
  if (typeof err === "string") return { message: err }
  if (err && typeof err === "object") {
    try {
      const raw = JSON.stringify(err)
      return { message: raw.slice(0, 500), raw: raw }
    } catch {
      return { message: String(err) }
    }
  }
  return { message: String(err) }
}

export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  const t0 = Date.now()
  try {
    const result = await runDramaIngest()
    const payload = { elapsedMs: Date.now() - t0, ...result }
    // HTTP status 정책 — 다른 cron 라우트와 통일 (ingest-all/send-reminders/ingest-ticketmaster 패턴):
    //   · HTTP 200    = 함수가 정상 종료 (data-level 실패는 result.error 로 표현)
    //   · HTTP 500    = 함수 자체가 throw (outer catch 발동)
    //   · DB cron_logs.status = 실제 결과 (result.error 있으면 "failed", 없으면 "success")
    // 어드민 모니터 팝업은 HTTP 200 기준으로 "실행 완료" 라벨링, 데이터 오류는 description 에 노출.
    const dbStatus = result.error ? "failed" : "success"
    if (dbStatus === "failed") {
      console.error("[ingest-tmdb-dramas] 인제스트 실패 (정상화 반환):", payload)
    }
    await recordCronLog("ingest-tmdb-dramas", dbStatus, payload)
    return NextResponse.json(payload)
  } catch (err) {
    // throw 가 위까지 올라온 경우 — TMDB API 401/네트워크/genre fetch 등
    const errInfo = serializeError(err)
    console.error("[ingest-tmdb-dramas] 인제스트 예외:", errInfo)
    const payload = {
      elapsedMs: Date.now() - t0,
      source: "tmdb-dramas" as const,
      scanned: 0,
      upserted: 0,
      calendarLinked: 0,
      error: errInfo.message,
      errorName: errInfo.name,
      errorStack: errInfo.stack,
      errorCause: errInfo.cause,
    }
    await recordCronLog("ingest-tmdb-dramas", "failed", payload)
    return NextResponse.json(payload, { status: 500 })
  }
}
