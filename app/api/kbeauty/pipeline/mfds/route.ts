import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// 식약처 화장품 제조(판매)업 정보조회
// 엔드포인트: apis.data.go.kr/1471000/CsmtcsInspctTrsmMgmtService/getCsmtcsBsshInfoList
// ⚠️ MFDS_API_KEY: data.go.kr 발급 "일반 인증키(Decoding)" 사용 — Encoding 키 사용 시 이중 인코딩 오류
const MFDS_BASE = "https://apis.data.go.kr/1471000/CsmtcsInspctTrsmMgmtService/getCsmtcsBsshInfoList"
const PAGE_SIZE = 100

interface MfdsItem {
  entrpNm?: string    // 업체명
  bizrno?: string     // 사업자등록번호
  addr?: string       // 주소
  lcsNo?: string      // 허가번호
  lcnsTy?: string     // 허가유형
  stts?: string       // 상태
  [key: string]: unknown
}

interface MfdsBody {
  items?: { item?: MfdsItem | MfdsItem[] } | MfdsItem[]
  totalCount?: number
  numOfRows?: number
  pageNo?: number
}

interface MfdsResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string }
    body?: MfdsBody
  }
}

function normalizeItems(raw: unknown): MfdsItem[] {
  if (!raw) return []
  // items가 배열로 직접 오는 경우
  if (Array.isArray(raw)) return raw as MfdsItem[]
  // items.item 구조
  const obj = raw as { item?: MfdsItem | MfdsItem[] }
  if (!obj.item) return []
  if (Array.isArray(obj.item)) return obj.item
  return [obj.item]
}

// URLSearchParams로 URL 구성 — serviceKey 자동 인코딩 (직접 문자열 concatenation 금지)
function buildMfdsUrl(apiKey: string, pageNo: number): string {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    pageNo:     String(pageNo),
    numOfRows:  String(PAGE_SIZE),
    type:       "json",
  })
  return `${MFDS_BASE}?${params.toString()}`
}

// text()로 먼저 받은 후 JSON 파싱 — API가 에러 시 XML/텍스트를 반환하는 경우 대비
async function safeFetchJson(url: string): Promise<{ json: MfdsResponse | null; raw: string; ok: boolean }> {
  const res = await fetch(url)
  const raw = await res.text()
  try {
    const json = JSON.parse(raw) as MfdsResponse
    return { json, raw, ok: true }
  } catch {
    return { json: null, raw, ok: false }
  }
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

  // ── 4. 1페이지 시범 호출 — totalCount 파악 + API 응답 검증 ─────────────────
  const firstUrl = buildMfdsUrl(apiKey, 1)

  // serviceKey 앞 20자만 로그 출력 (전체 키 노출 방지)
  console.log("[MFDS] 호출 URL:", firstUrl.replace(
    encodeURIComponent(apiKey),
    apiKey.slice(0, 20) + "***"
  ))

  let firstResult: Awaited<ReturnType<typeof safeFetchJson>>
  try {
    firstResult = await safeFetchJson(firstUrl)
  } catch (err) {
    return NextResponse.json(
      { error: `MFDS API 네트워크 오류: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    )
  }

  // JSON 파싱 실패 → 원본 텍스트 로그 출력 후 에러 반환
  if (!firstResult.ok || !firstResult.json) {
    console.error("[MFDS] JSON 파싱 실패. 원본 응답:", firstResult.raw.slice(0, 500))
    return NextResponse.json(
      {
        error: "MFDS API가 JSON이 아닌 응답을 반환했습니다. 서버 로그에서 원본 응답을 확인하세요.",
        rawPreview: firstResult.raw.slice(0, 200),
      },
      { status: 502 }
    )
  }

  // API 레벨 오류 코드 확인 (resultCode가 '00'이 아닌 경우)
  const header = firstResult.json.response?.header
  if (header?.resultCode && header.resultCode !== "00") {
    console.error("[MFDS] API 오류 응답:", header)
    return NextResponse.json(
      { error: `MFDS API 오류 — resultCode: ${header.resultCode}, msg: ${header.resultMsg}` },
      { status: 502 }
    )
  }

  const body = firstResult.json.response?.body
  const totalCount = body?.totalCount ?? 0

  // 테스트 로그: 첫 번째 응답 구조 확인용
  console.log("[MFDS] 1페이지 응답 헤더:", header)
  console.log("[MFDS] totalCount:", totalCount, "/ body keys:", body ? Object.keys(body) : "없음")

  if (totalCount === 0) {
    return NextResponse.json({
      total: 0, inserted: 0, skipped: 0,
      message: "MFDS 응답 데이터 없음 (totalCount=0). API 키·엔드포인트·파라미터를 확인하세요.",
      rawPreview: firstResult.raw.slice(0, 300),
    })
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  let inserted = 0
  let skipped = 0

  // ── 5. 전수 페이지네이션 조회 → INSERT ───────────────────────────────────
  for (let pageNo = 1; pageNo <= totalPages; pageNo++) {
    let items: MfdsItem[]

    if (pageNo === 1) {
      items = normalizeItems(body?.items)
    } else {
      const url = buildMfdsUrl(apiKey, pageNo)
      try {
        const result = await safeFetchJson(url)
        if (!result.ok || !result.json) {
          console.error(`[MFDS] 페이지 ${pageNo} JSON 파싱 실패:`, result.raw.slice(0, 200))
          skipped += PAGE_SIZE
          continue
        }
        items = normalizeItems(result.json.response?.body?.items)
      } catch {
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
      console.error(`[MFDS] INSERT 오류 (페이지 ${pageNo}):`, error.message)
      skipped += rows.length
    }
  }

  return NextResponse.json({ total: totalCount, inserted, skipped })
}
