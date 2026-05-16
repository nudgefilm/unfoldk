import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin/auth"

export const dynamic = "force-dynamic"
export const maxDuration = 300

// 어드민 모니터에서 cron 라우트를 수동 실행할 수 있게 프록시
// 이유: 클라이언트는 CRON_SECRET을 알 수 없으므로 서버 측에서 헤더 주입
const PostSchema = z.object({
  route: z.enum(["ingest-all", "ingest-ticketmaster", "send-reminders"]),
})

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "unauthenticated" ? 401 : 403 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET 미설정" }, { status: 500 })
  }

  // 베이스 URL: 프로덕션은 NEXT_PUBLIC_APP_URL, 로컬은 요청 origin
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  const targetUrl = `${appUrl}/api/cron/${parsed.data.route}`

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
