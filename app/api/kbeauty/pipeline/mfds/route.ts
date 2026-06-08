import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// 식약처 화장품 제조업체 정보 목록 조회
// 엔드포인트: apis.data.go.kr/1471000/CsmtcsMfcrtrInfoService01/getCsmtcsMfcrtrInfoList01
// ⚠️ MFDS_COSMETICS_API_KEY: data.go.kr 발급 "일반 인증키(Decoding)" 사용
const MFDS_BASE = "https://apis.data.go.kr/1471000/CsmtcsMfcrtrInfoService01/getCsmtcsMfcrtrInfoList01"
const PAGE_SIZE = 100

// 실제 API 응답 필드 (대문자 스네이크케이스)
interface MfdsItem {
  ENTP_NAME?: string         // 업체명 → company_name_ko
  BIZRNO?: string            // 사업자등록번호 → business_registration_number
  FACTORY_ADDR?: string      // 공장 주소 → address_ko
  BOSS_NAME?: string         // 대표자명 (스킵)
  INDUTY?: string            // 업종 (화장품제조 / 화장품책임판매) → license_type
  ENTP_PERMIT_DATE?: string  // 허가일 (스킵)
  [key: string]: unknown
}

interface MfdsResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string }
    body?: {
      items?: MfdsItem[]     // 직접 배열로 반환
      totalCount?: number
      numOfRows?: number
      pageNo?: number
    }
  }
}

// body.items 가 직접 배열로 오는 구조
function normalizeItems(raw: unknown): MfdsItem[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as MfdsItem[]
  // 만약 { item: [...] } 중첩 구조라면 하위 호환
  const obj = raw as { item?: MfdsItem | MfdsItem[] }
  if (!obj.item) return []
  return Array.isArray(obj.item) ? obj.item : [obj.item]
}

// URLSearchParams로 URL 구성 — serviceKey 자동 인코딩
function buildMfdsUrl(apiKey: string, pageNo: number): string {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    pageNo:     String(pageNo),
    numOfRows:  String(PAGE_SIZE),
    type:       "json",
  })
  return `${MFDS_BASE}?${params.toString()}`
}

// text() 먼저 수신 후 JSON 파싱 — API 에러 시 XML/텍스트 반환 대비
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

  const apiKey = process.env.MFDS_COSMETICS_API_KEY
  console.log("[MFDS] MFDS_COSMETICS_API_KEY 앞 5자리:", apiKey ? apiKey.slice(0, 5) : "없음(미설정)")
  if (!apiKey) return NextResponse.json({ error: "MFDS_COSMETICS_API_KEY 환경변수 미설정" }, { status: 500 })

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

  // JSON 파싱 실패 → 원본 텍스트 로그 + 에러 반환
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

  // API 레벨 오류 코드 확인
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

  // 응답 구조 확인용 로그
  console.log("[MFDS] header:", header)
  console.log("[MFDS] totalCount:", totalCount, "/ body keys:", body ? Object.keys(body) : "없음")
  if (body?.items && body.items.length > 0) {
    console.log("[MFDS] 첫 번째 item 키:", Object.keys(body.items[0]))
  }

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
        if (!item.ENTP_NAME) return false
        // BIZRNO 중복 스킵
        if (item.BIZRNO && existingBizNos.has(item.BIZRNO)) return false
        return true
      })
      .map(item => ({
        company_name_ko:             item.ENTP_NAME ?? "",
        address_ko:                  item.FACTORY_ADDR ?? null,
        business_registration_number: item.BIZRNO ?? null,
        license_number:              null,
        license_type:                item.INDUTY ?? null,          // 화장품제조 / 화장품책임판매
        status_ko:                   item.ENTP_PERMIT_DATE ?? null, // 허가일
        translate_status:            "pending",
        apollo_status:               "pending",
        invite_status:               "pending",
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
