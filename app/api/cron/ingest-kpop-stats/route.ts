import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { runKpopStatsIngest } from "@/lib/ingest/kpop-stats"

export const maxDuration = 60
export const dynamic = "force-dynamic"

// 일별 KpopStats 인제스트 cron
// vercel.json 에서 매일 07:00 UTC (= 16:00 KST) 호출 — Last.fm·YouTube 통계가 안정된 시간대
// 어드민 수동 갱신은 /api/admin/kpop/[id]/refresh 가 같은 lib 함수를 다른 인증으로 호출
export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  try {
    const result = await runKpopStatsIngest()
    const status = result.errors.length > 0 ? 207 : 200    // 부분 실패는 207 Multi-Status
    return NextResponse.json(result, { status })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown"
    const stack = err instanceof Error ? err.stack : undefined
    console.error("[ingest-kpop-stats] 최상위 에러:", msg, stack)
    return NextResponse.json(
      { source: "kpop-stats", error: msg, stack },
      { status: 500 }
    )
  }
}
