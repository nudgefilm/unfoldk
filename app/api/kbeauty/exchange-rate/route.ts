import { NextResponse } from "next/server"

export const revalidate = 3600

export async function GET() {
  const key = process.env.EXCHANGERATE_API_KEY
  if (!key) {
    return NextResponse.json({ rate: 1400, updated_at: new Date().toISOString() })
  }

  try {
    const res = await fetch(
      `https://v6.exchangerate-api.com/v6/${key}/pair/USD/KRW`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) throw new Error(`status ${res.status}`)
    const json = await res.json()
    return NextResponse.json({
      rate: json.conversion_rate as number,
      updated_at: json.time_last_update_utc as string,
    })
  } catch {
    return NextResponse.json({ rate: 1400, updated_at: new Date().toISOString() })
  }
}
