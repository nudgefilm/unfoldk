import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// data.go.kr 화장품 책임판매업체 전수 조회
// API 문서: https://www.data.go.kr → "화장품책임판매업" 검색
// 엔드포인트: apis.data.go.kr/1471000/CsmtcsRpsblSaleEntpBs01/getCsmtcsRpsblSaleEntpBs01
// 실제 응답 필드명은 API 발급 후 샘플 응답으로 재확인 필요
const MFDS_BASE = "https://apis.data.go.kr/1471000/CsmtcsRpsblSaleEntpBs01/getCsmtcsRpsblSaleEntpBs01"
const PAGE_SIZE = 100

interface MfdsItem {
  entrpNm?: string   // 업체명
  bizrno?: string    // 사업자등록번호
  addr?: string      // 주소
  lcsNo?: string     // 허가번호
  lcnsTy?: string    // 허가유형
  stts?: string      // 상태
}

interface MfdsResponse {
  response?: {
    body?: {
      items?: { item?: MfdsItem | MfdsItem[] }
      totalCount?: number
    }
  }
}

function normalizeItems(raw: MfdsItem | MfdsItem[] | undefined): MfdsItem[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  return [raw]
}

export async function POST() {
  // ── 1. 세션 인증 ──────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // ── 2. 어드민 검증 ────────────────────────────────────────────────────────
  const admin = createSupabaseAdminClient()
  const { data: userRow } = await admin
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()
  if (!userRow?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const apiKey = process.env.MFDS_API_KEY
  if (!apiKey) return NextResponse.json({ error: "MFDS_API_KEY 환경변수 미설정" }, { status: 500 })

  // ── 3. 기존 사업자번호 목록 조회 (중복 스킵용) ────────────────────────────
  const { data: existingRows } = await admin
    .from("beauty_suppliers_staging")
    .select("business_registration_number")
    .not("business_registration_number", "is", null)

  const existingBizNos = new Set(
    (existingRows ?? [])
      .map((r: { business_registration_number: string }) => r.business_registration_number)
      .filter(Boolean)
  )

  // ── 4. 전수 페이지네이션 조회 ─────────────────────────────────────────────
  let pageNo = 1
  let totalCount = 0
  let inserted = 0
  let skipped = 0

  // 1페이지로 totalCount 파악
  const firstUrl = new URL(MFDS_BASE)
  firstUrl.searchParams.set("serviceKey", apiKey)
  firstUrl.searchParams.set("pageNo", "1")
  firstUrl.searchParams.set("numOfRows", String(PAGE_SIZE))
  firstUrl.searchParams.set("type", "json")

  let firstRes: MfdsResponse
  try {
    const r = await fetch(firstUrl.toString())
    firstRes = await r.json() as MfdsResponse
  } catch (err) {
    return NextResponse.json(
      { error: `MFDS API 호출 실패: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    )
  }

  totalCount = firstRes?.response?.body?.totalCount ?? 0
  if (totalCount === 0) {
    return NextResponse.json({ total: 0, inserted: 0, skipped: 0, message: "MFDS 응답 데이터 없음" })
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // 모든 페이지 순차 조회 → INSERT
  for (pageNo = 1; pageNo <= totalPages; pageNo++) {
    let items: MfdsItem[]

    if (pageNo === 1) {
      items = normalizeItems(firstRes?.response?.body?.items?.item)
    } else {
      const url = new URL(MFDS_BASE)
      url.searchParams.set("serviceKey", apiKey)
      url.searchParams.set("pageNo", String(pageNo))
      url.searchParams.set("numOfRows", String(PAGE_SIZE))
      url.searchParams.set("type", "json")

      try {
        const r = await fetch(url.toString())
        const json = await r.json() as MfdsResponse
        items = normalizeItems(json?.response?.body?.items?.item)
      } catch {
        // 개별 페이지 실패 시 스킵하고 계속
        skipped += PAGE_SIZE
        continue
      }
    }

    const rows = items
      .filter(item => {
        if (!item.entrpNm) return false
        if (item.bizrno && existingBizNos.has(item.bizrno)) return false
        return true
      })
      .map(item => ({
        company_name_ko: item.entrpNm ?? "",
        address_ko: item.addr ?? null,
        business_registration_number: item.bizrno ?? null,
        license_number: item.lcsNo ?? null,
        license_type: item.lcnsTy ?? null,
        status_ko: item.stts ?? null,
        translate_status: "pending",
        apollo_status: "pending",
        invite_status: "pending",
      }))

    skipped += items.length - rows.length

    if (rows.length === 0) continue

    const { error } = await admin
      .from("beauty_suppliers_staging")
      .insert(rows)

    if (!error) {
      inserted += rows.length
      rows.forEach(r => {
        if (r.business_registration_number) existingBizNos.add(r.business_registration_number)
      })
    } else {
      skipped += rows.length
    }
  }

  return NextResponse.json({ total: totalCount, inserted, skipped })
}
