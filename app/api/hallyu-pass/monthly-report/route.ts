import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { hasProAccess } from "@/lib/auth/plan"

export const dynamic = "force-dynamic"

// GET: 가장 최근 monthly_trend_reports 1건 반환
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("users")
    .select("plan_type, trial_ends_at, is_admin")
    .eq("id", user.id)
    .single()

  const p = profile as { plan_type?: string; trial_ends_at?: string; is_admin?: boolean } | null
  if (
    !hasProAccess({ planType: p?.plan_type, trialEndsAt: p?.trial_ends_at, isAdmin: p?.is_admin })
  ) {
    return NextResponse.json({ error: "Pro access required" }, { status: 403 })
  }

  const admin = createSupabaseAdminClient()

  const { data: report } = await admin
    .from("monthly_trend_reports")
    .select("id, year_month, report_content, summary_text, created_at")
    .order("year_month", { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ report: report ?? null })
}
