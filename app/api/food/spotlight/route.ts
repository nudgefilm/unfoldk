import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const revalidate = 3600

function getISOWeekString(): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`
}

export async function GET() {
  const admin = createSupabaseAdminClient()
  const weekStr = getISOWeekString()

  const { data } = await admin
    .from("food_recipes")
    .select("id, title_en, drama_title")
    .eq("featured_week", weekStr)
    .limit(1)
    .maybeSingle()
  if (data) return NextResponse.json({ recipe: data })

  const { data: latest } = await admin
    .from("food_recipes")
    .select("id, title_en, drama_title")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return NextResponse.json({ recipe: latest ?? null })
}
