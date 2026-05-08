import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/auth"
import { runKpopStatsIngest } from "@/lib/ingest/kpop-stats"

export const maxDuration = 30
export const dynamic = "force-dynamic"

// 어드민 — 단일 아티스트 stats 수동 갱신
// (cron 기다리지 않고 새 channel ID 입력 직후 즉시 검증용)
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "unauthenticated" ? 401 : 403 })
  }

  const { id } = await params
  const result = await runKpopStatsIngest([id])
  const status = result.errors.length > 0 ? 207 : 200
  return NextResponse.json(result, { status })
}
