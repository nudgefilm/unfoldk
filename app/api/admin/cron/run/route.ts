import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin/auth"

export const dynamic = "force-dynamic"
export const maxDuration = 300

// 어드민 모니터에서 cron 라우트를 수동 실행할 수 있게 프록시
// 이유: 클라이언트는 CRON_SECRET을 알 수 없으므로 서버 측에서 헤더 주입
//
// HTTP status 통일 정책:
//   - 모든 cron 라우트는 정상 종료 시 HTTP 200 반환 (data-level 실패는 result.error 로 표현)
//   - HTTP 500 은 cron 함수 자체의 uncaught exception 만 의미
//   - 본 프록시도 inner res.ok 를 그대로 ok 필드로 전달 → 어드민 모니터가 HTTP 200 기준으로 판별
//
// ⚠️ 신규 cron 라우트 추가 시:
//   1. vercel.json crons 배열
//   2. app/admin/cron/page.tsx ROUTES + ROUTE_DISPLAY_NAMES
//   3. 본 enum
//   4. components/admin/cron-monitor.tsx summarizeRunResult
//   네 곳을 함께 갱신해야 어드민 수동 실행이 정상 동작 (enum 누락 시 zod 400 → "Object Object").

// 270s — 300s 만료 직전에 먼저 끊어 클라이언트에 명확한 응답 반환.
// 타임아웃 시 { ok: true, timedOut: true } 반환 → UI 가 "백그라운드 실행 중" toast 노출.
const INNER_TIMEOUT_MS = 270_000

const PostSchema = z.object({
  route: z.enum([
    "ingest-all",
    "ingest-ticketmaster",
    "ingest-kpop-stats",
    "ingest-tmdb-dramas",
    "ingest-tour-spots",
    "ingest-filming-kpop",
    "ingest-korean-phrases",
    "ingest-food-recipes",
    "send-reminders",
    "backfill-filming-descriptions",
  ]),
  // 선택적 쿼리 파라미터 — cron 라우트가 옵션을 받을 때 (e.g. ingest-tour-spots?only_festivals=true)
  // 값은 모두 문자열로 직렬화. 키·값 길이는 64자 cap.
  params: z
    .record(z.string().max(64), z.string().max(64))
    .optional(),
})

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    console.warn("[admin/cron/run] auth 실패:", auth.reason)
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "unauthenticated" ? 401 : 403 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ")
    console.warn("[admin/cron/run] zod parse 실패:", issues, "| receivedRoute:", (body as { route?: unknown })?.route)
    return NextResponse.json(
      {
        error: `invalid_body: ${issues}`,
        receivedRoute: (body as { route?: unknown })?.route,
      },
      { status: 400 }
    )
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[admin/cron/run] CRON_SECRET 미설정")
    return NextResponse.json({ error: "CRON_SECRET 미설정" }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  const params = parsed.data.params ?? {}
  const qs = new URLSearchParams(params).toString()
  const targetUrl = `${appUrl}/api/cron/${parsed.data.route}${qs ? `?${qs}` : ""}`

  console.log("[admin/cron/run] fetch 시작 →", targetUrl)

  const t0 = Date.now()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), INNER_TIMEOUT_MS)

  try {
    const res = await fetch(targetUrl, {
      headers: { Authorization: `Bearer ${cronSecret}` },
      cache: "no-store",
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    console.log("[admin/cron/run] fetch 완료 status:", res.status, "elapsed:", Date.now() - t0, "ms")
    const json = await res.json().catch(() => ({}))
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      elapsedMs: Date.now() - t0,
      result: json,
    })
  } catch (err) {
    clearTimeout(timeoutId)
    // AbortError = 270s 타임아웃 — cron 자체는 백그라운드에서 계속 실행 중
    if (err instanceof Error && err.name === "AbortError") {
      console.log("[admin/cron/run] 270s 타임아웃 — cron 백그라운드 실행 중")
      return NextResponse.json({
        ok: true,
        timedOut: true,
        elapsedMs: Date.now() - t0,
        result: null,
      })
    }
    console.error("[admin/cron/run] fetch 예외:", err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "fetch 실패" },
      { status: 500 }
    )
  }
}
