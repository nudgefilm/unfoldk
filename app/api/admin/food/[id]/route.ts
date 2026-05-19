import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// /api/admin/food/[id] PATCH — 레시피 이미지 URL · 출처 갱신
//
// body:
//   { image_url: string|null, image_source: 'mfds'|'unsplash'|'upload'|'manual'|null }
// 정책:
//   - requireAdmin (어드민만)
//   - image_url=null 이면 image_source 도 null 강제 (역도 동일)
//   - URL 형식만 가볍게 검증 — 외부 호스트 화이트리스트는 별도 검토(추후)

const SOURCE_ENUM = ["mfds", "unsplash", "upload", "manual"] as const
const PatchSchema = z.object({
  image_url: z.string().trim().url().max(2000).nullable(),
  image_source: z.enum(SOURCE_ENUM).nullable(),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.reason },
      { status: auth.reason === "unauthenticated" ? 401 : 403 }
    )
  }

  const { id } = await context.params
  if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const parsed = PatchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 }
    )
  }

  // image_url 과 image_source 정합 — 한쪽 null 이면 다른 쪽도 null.
  const url = parsed.data.image_url
  const src = parsed.data.image_source
  if ((url === null) !== (src === null)) {
    return NextResponse.json(
      { error: "image_url 과 image_source 는 동시 null 또는 동시 값" },
      { status: 400 }
    )
  }

  const admin = createSupabaseAdminClient()
  const { error } = await admin
    .from("food_recipes")
    .update({ image_url: url, image_source: src })
    .eq("id", id)

  if (error) {
    console.error("[admin/food/[id]] update 실패:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, image_url: url, image_source: src })
}
