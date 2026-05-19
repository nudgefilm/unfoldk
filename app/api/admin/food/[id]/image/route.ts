import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const maxDuration = 30

// /api/admin/food/[id]/image POST — 어드민 이미지 파일 업로드
//
// 흐름:
//   1. requireAdmin (인증·권한)
//   2. multipart/form-data 의 "file" 필드 추출
//   3. 사이즈·MIME 검증 (5MB · JPG/PNG/WEBP)
//   4. service_role Storage 클라이언트로 food-images/{id}.{ext} upsert
//      → Storage RLS bypass (RLS 정책이 is_admin(auth.uid()) 평가 시 browser 컨텍스트에서
//        false 반환하는 케이스 회피. 어드민 권한 검증은 requireAdmin 으로 충분)
//   5. publicUrl + ?v=timestamp 캐시 우회 query 부여 → food_recipes UPDATE
//   6. { ok, image_url, image_source } 반환
//
// 보안:
//   - requireAdmin 이 단일 게이트. Storage 인증은 service_role 이라 RLS 무시.
//   - id 는 UUID 형식 검증.

const STORAGE_BUCKET = "food-images"
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
    return NextResponse.json(
      { error: auth.reason },
      { status: auth.reason === "unauthenticated" ? 401 : 403 }
    )
  }

  const { id } = await context.params
  if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }

  // FormData 파싱
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

  // service_role Storage 업로드 — RLS bypass
  const admin = createSupabaseAdminClient()
  const path = `${id}.${ext}`

  // File → ArrayBuffer (supabase-js 가 Buffer/ArrayBuffer 모두 허용)
  const buffer = await file.arrayBuffer()
  const { error: upErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    })
  if (upErr) {
    console.error("[admin/food/image] storage upload 실패:", upErr)
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  const { data: pub } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  // 같은 경로 덮어쓰기 시 브라우저·CDN 캐시 우회용 ?v=timestamp
  const imageUrl = `${pub.publicUrl}?v=${Date.now()}`

  // food_recipes UPDATE — image_source='upload' 추적
  const { error: dbErr } = await admin
    .from("food_recipes")
    .update({ image_url: imageUrl, image_source: "upload" })
    .eq("id", id)
  if (dbErr) {
    console.error("[admin/food/image] food_recipes update 실패:", dbErr)
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    image_url: imageUrl,
    image_source: "upload" as const,
  })
}
