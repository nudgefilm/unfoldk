import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { runBlogGenerationCron } from "@/lib/blog-gen/run"

// Vercel Cron — vercel.json 매일 08:00 UTC.
// 흐름:
//   Haiku 본문 → Unsplash 이미지 → GitHub Contents PUT → Vercel 자동 재배포.
//
// 응답 코드:
//   200 — 완료 (push 성공) 또는 멱등 skip (오늘 파일 이미 존재)
//   401 — CRON_SECRET 미일치
//   207 — 부분 진행 (예: idempotency skip 은 200, 본문 생성 실패는 500)
//   500 — 외부 API 실패 (Haiku / Unsplash / GitHub)
//
// maxDuration — Haiku 응답 + Unsplash + GitHub 합쳐 30s 면 충분. 60s 마진.

export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  try {
    const result = await runBlogGenerationCron()

    if (result.ok) {
      // 멱등 skip 도 200 (cron 재실행 시 명확한 신호)
      return NextResponse.json(result, { status: 200 })
    }

    // 실패 — stage 별 5xx
    const status = result.duplicate ? 200 : 500
    return NextResponse.json(result, { status })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown"
    const stack = err instanceof Error ? err.stack : undefined
    console.error("[cron/generate-blog-post] 최상위 에러:", msg, stack)
    return NextResponse.json(
      { ok: false, stage: "complete", error: msg, stack },
      { status: 500 }
    )
  }
}
