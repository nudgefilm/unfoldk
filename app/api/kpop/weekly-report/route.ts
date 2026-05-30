import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// GET /api/kpop/weekly-report — 최신 주간 K팝 리포트
export const dynamic = "force-dynamic"
export const revalidate = 3600 // 1h

export async function GET() {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from("kpop_weekly_report")
    .select("week_start, report_text, created_at")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("[/api/kpop/weekly-report]", error.message)
    return NextResponse.json({ report: null })
  }

  return NextResponse.json({ report: data ?? null })
}
