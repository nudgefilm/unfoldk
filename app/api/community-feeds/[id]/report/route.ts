import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const AUTO_HIDE_THRESHOLD = 5

// POST /api/community-feeds/[id]/report — 로그인 유저만, 1회만
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  let reason: string | undefined
  try {
    const body = await req.json()
    reason = typeof body?.reason === "string" ? body.reason.slice(0, 200) : undefined
  } catch { /* reason 선택 항목 */ }

  // 신고 INSERT (UNIQUE 위반 시 409)
  const { error: reportErr } = await supabase
    .from("community_feed_reports")
    .insert({ feed_id: id, user_id: user.id, reason: reason ?? null })

  if (reportErr) {
    if (reportErr.code === "23505") {
      return NextResponse.json({ error: "already_reported" }, { status: 409 })
    }
    return NextResponse.json({ error: reportErr.message }, { status: 500 })
  }

  // report_count +1 + 임계값 도달 시 hidden (admin 클라이언트로 RLS 우회)
  const admin = createSupabaseAdminClient()

  const { data: feedRow } = await admin
    .from("community_feeds")
    .select("report_count")
    .eq("id", id)
    .single()

  const newCount = ((feedRow as { report_count?: number } | null)?.report_count ?? 0) + 1
  const patch: Record<string, unknown> = { report_count: newCount, updated_at: new Date().toISOString() }
  if (newCount >= AUTO_HIDE_THRESHOLD) patch.status = "hidden"

  await admin.from("community_feeds").update(patch).eq("id", id)

  return NextResponse.json({ ok: true, report_count: newCount, auto_hidden: newCount >= AUTO_HIDE_THRESHOLD })
}
