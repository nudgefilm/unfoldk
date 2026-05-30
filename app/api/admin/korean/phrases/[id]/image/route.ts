import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const maxDuration = 30

// POST /api/admin/korean/phrases/[id]/image — 표현 이미지 파일 업로드
// food-images 패턴 동일. 버킷: korean-phrase-images

const STORAGE_BUCKET = "korean-phrase-images"
const MAX_BYTES = 5 * 1024 * 1024
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 })
  }

  const { id } = await context.params
  if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file 필드 누락" }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "빈 파일" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `파일 크기 ${(file.size / 1024 / 1024).toFixed(2)}MB — 5MB 이하만 허용` },
      { status: 400 }
    )
  }
  const ext = MIME_EXT[file.type]
  if (!ext) {
    return NextResponse.json(
      { error: `MIME ${file.type} 미허용 (JPG/PNG/WEBP 만)` },
      { status: 400 }
    )
  }

  const admin = createSupabaseAdminClient()
  const path = `${id}.${ext}`
  const buffer = await file.arrayBuffer()

  const { error: upErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, { cacheControl: "3600", upsert: true, contentType: file.type })

  if (upErr) {
    console.error("[admin/korean/phrases/image] storage upload 실패:", upErr)
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  const { data: pub } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  const imageUrl = `${pub.publicUrl}?v=${Date.now()}`

  const { error: dbErr } = await admin
    .from("korean_phrases")
    .update({ image_url: imageUrl })
    .eq("id", id)

  if (dbErr) {
    console.error("[admin/korean/phrases/image] DB update 실패:", dbErr)
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, image_url: imageUrl })
}
