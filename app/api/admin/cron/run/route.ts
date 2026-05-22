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
const PostSchema = z.object({
  route: z.enum([
    "ingest-all",
    "ingest-ticketmaster",
    "ingest-kpop-stats",
    "ingest-tmdb-dramas",
    "ingest-curation-k",
    "ingest-korean-phrases",
    "ingest-food-recipes",
    "send-reminders",
    "backfill-filming-descriptions",
  ]),
  // 선택적 쿼리 파라미터 — cron 라우트가 옵션을 받을 때 (e.g. ingest-curation-k?include_filming=true)
  // 값은 모두 문자열로 직렬화. 키·값 길이는 64자 cap.
  params: z
    .record(z.string().max(64), z.string().max(64))
    .optional(),
})

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "unauthenticated" ? 401 : 403 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    // flatten 객체를 그대로 반환하면 클라이언트가 .toString() 으로 "[object Object]" 변환
    // → 사람이 읽을 수 있는 문자열로 압축 (route 값 문제가 가장 흔함)
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ")
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
    return NextResponse.json({ error: "CRON_SECRET 미설정" }, { status: 500 })
  }

  // 베이스 URL: 프로덕션은 NEXT_PUBLIC_APP_URL, 로컬은 요청 origin
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  const params = parsed.data.params ?? {}
  const qs = new URLSearchParams(params).toString()
  const targetUrl = `${appUrl}/api/cron/${parsed.data.route}${qs ? `?${qs}` : ""}`

  const t0 = Date.now()
  try {
    const res = await fetch(targetUrl, {
      headers: { Authorization: `Bearer ${cronSecret}` },
      cache: "no-store",
    })
    const json = await res.json().catch(() => ({}))
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      elapsedMs: Date.now() - t0,
      result: json,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "fetch 실패" },
      { status: 500 }
    )
  }
}
