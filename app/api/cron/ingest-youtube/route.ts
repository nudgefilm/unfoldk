import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { runYoutubeIngest } from "@/lib/ingest/youtube"

export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  try {
    const result = await runYoutubeIngest()
    const status = result.error ? 500 : 200
    return NextResponse.json(result, { status })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown"
    const stack = err instanceof Error ? err.stack : undefined
    console.error("[ingest-youtube] 최상위 에러:", msg, stack)
    return NextResponse.json(
      { source: "youtube", error: msg, stack },
      { status: 500 }
    )
  }
}
