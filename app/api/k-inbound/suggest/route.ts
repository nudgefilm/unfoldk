import { NextResponse } from "next/server"
import { cache } from "../flight/route"

export const dynamic = "force-dynamic"

// cron이 캐싱한 항공편 중 가장 최근 것을 반환
export async function GET() {
  let best: { number: string; fetchedAt: number } | null = null
  for (const [number, entry] of cache.entries()) {
    if (!best || entry.fetchedAt > best.fetchedAt) {
      best = { number, fetchedAt: entry.fetchedAt }
    }
  }
  return NextResponse.json({ flight: best?.number ?? "KE017" })
}
