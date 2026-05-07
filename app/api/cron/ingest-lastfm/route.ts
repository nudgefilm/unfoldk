import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron/auth"
import { runLastfmIngest } from "@/lib/ingest/lastfm"

export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason, debug: auth.debug }, { status: 401 })
  }

  try {
    const result = await runLastfmIngest()
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown"
    console.error("[ingest-lastfm] 에러:", msg)
    return NextResponse.json(
      { source: "lastfm", error: msg },
      { status: 500 }
    )
  }
}
