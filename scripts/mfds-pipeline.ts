// 식약처 화장품 제조·책임판매업체 전수 적재 스크립트
//
// 실행:
//   pnpm dlx dotenv-cli -e .env.local -- pnpm tsx scripts/mfds-pipeline.ts
//
// 필요 환경변수 (.env.local):
//   MFDS_COSMETICS_API_KEY   — data.go.kr 발급 "일반 인증키(Decoding)"
//   NEXT_PUBLIC_SUPABASE_URL — Supabase 프로젝트 URL
//   SUPABASE_SERVICE_ROLE_KEY — RLS 우회용 서비스 롤 키
//
// 동작:
//   1. 기존 beauty_suppliers_staging 사업자번호 로드 (중복 스킵)
//   2. 식약처 API 전수 페이지네이션 (100건/페이지)
//   3. Supabase INSERT (페이지 단위 벌크)
//   4. 진행 현황 + 최종 요약 콘솔 출력

import { createClient } from "@supabase/supabase-js"

// ── 환경변수 ──────────────────────────────────────────────────────────────────
const API_KEY     = process.env.MFDS_COSMETICS_API_KEY ?? ""
const SUPA_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const SUPA_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

if (!API_KEY)  { console.error("❌ MFDS_COSMETICS_API_KEY 미설정"); process.exit(1) }
if (!SUPA_URL) { console.error("❌ NEXT_PUBLIC_SUPABASE_URL 미설정"); process.exit(1) }
if (!SUPA_KEY) { console.error("❌ SUPABASE_SERVICE_ROLE_KEY 미설정"); process.exit(1) }

console.log("✅ MFDS_COSMETICS_API_KEY 앞 5자리:", API_KEY.slice(0, 5))

// ── 상수 ──────────────────────────────────────────────────────────────────────
const MFDS_BASE = "https://apis.data.go.kr/1471000/CsmtcsMfcrtrInfoService01/getCsmtcsMfcrtrInfoList01"
const PAGE_SIZE = 100

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface MfdsItem {
  ENTP_NAME?: string
  BIZRNO?: string
  FACTORY_ADDR?: string
  BOSS_NAME?: string
  INDUTY?: string
  ENTP_PERMIT_DATE?: string
  [key: string]: unknown
}

interface MfdsResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string }
    body?: {
      items?: MfdsItem[]
      totalCount?: number
      numOfRows?: number
      pageNo?: number
    }
  }
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────
function buildUrl(pageNo: number): string {
  const params = new URLSearchParams({
    serviceKey: API_KEY,
    pageNo:     String(pageNo),
    numOfRows:  String(PAGE_SIZE),
    type:       "json",
  })
  return `${MFDS_BASE}?${params.toString()}`
}

async function safeFetch(url: string): Promise<{ json: MfdsResponse | null; raw: string }> {
  const res  = await fetch(url)
  const raw  = await res.text()
  try {
    return { json: JSON.parse(raw) as MfdsResponse, raw }
  } catch {
    return { json: null, raw }
  }
}

function normalizeItems(raw: unknown): MfdsItem[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as MfdsItem[]
  const obj = raw as { item?: MfdsItem | MfdsItem[] }
  if (!obj.item) return []
  return Array.isArray(obj.item) ? obj.item : [obj.item]
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
async function main() {
  const supabase = createClient(SUPA_URL, SUPA_KEY)

  // 1. 기존 사업자번호 로드
  console.log("\n[1/4] 기존 사업자번호 목록 조회 중...")
  const { data: existingRows, error: existingErr } = await supabase
    .from("beauty_suppliers_staging")
    .select("business_registration_number")
    .not("business_registration_number", "is", null)

  if (existingErr) {
    console.error("❌ Supabase 조회 오류:", existingErr.message)
    process.exit(1)
  }

  const existingBizNos = new Set<string>(
    (existingRows ?? [])
      .map((r: { business_registration_number: string }) => r.business_registration_number)
      .filter(Boolean)
  )
  console.log(`   → 기존 적재 ${existingBizNos.size.toLocaleString()}건 (중복 스킵 대상)`)

  // 2. 1페이지 시범 호출 — totalCount 확인
  console.log("\n[2/4] 식약처 API 1페이지 시범 호출...")
  const { json: first, raw: firstRaw } = await safeFetch(buildUrl(1))

  if (!first) {
    console.error("❌ JSON 파싱 실패. 원본 응답 (앞 300자):\n", firstRaw.slice(0, 300))
    process.exit(1)
  }

  const header = first.response?.header
  if (header?.resultCode && header.resultCode !== "00") {
    console.error(`❌ API 오류 — resultCode: ${header.resultCode}, msg: ${header.resultMsg}`)
    process.exit(1)
  }

  const body       = first.response?.body
  const totalCount = body?.totalCount ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  if (totalCount === 0) {
    console.error("❌ totalCount=0. API 키·파라미터를 확인하세요.\n원본:", firstRaw.slice(0, 300))
    process.exit(1)
  }

  console.log(`   → totalCount: ${totalCount.toLocaleString()}건 / ${totalPages}페이지`)

  // 3. 전수 페이지네이션 → INSERT
  console.log(`\n[3/4] 전수 적재 시작 (${PAGE_SIZE}건/페이지, 총 ${totalPages}페이지)`)
  let inserted = 0
  let skipped  = 0
  let errors   = 0

  for (let pageNo = 1; pageNo <= totalPages; pageNo++) {
    let items: MfdsItem[]

    if (pageNo === 1) {
      items = normalizeItems(body?.items)
    } else {
      const { json, raw } = await safeFetch(buildUrl(pageNo))
      if (!json) {
        console.warn(`  ⚠️  페이지 ${pageNo} JSON 파싱 실패:`, raw.slice(0, 100))
        skipped += PAGE_SIZE
        errors++
        continue
      }
      items = normalizeItems(json.response?.body?.items)
    }

    const rows = items
      .filter(item => {
        if (!item.ENTP_NAME) return false
        if (item.BIZRNO && existingBizNos.has(item.BIZRNO)) return false
        return true
      })
      .map(item => ({
        company_name_ko:              item.ENTP_NAME ?? "",
        address_ko:                   item.FACTORY_ADDR ?? null,
        business_registration_number: item.BIZRNO ?? null,
        license_number:               null,
        license_type:                 item.INDUTY ?? null,
        status_ko:                    item.ENTP_PERMIT_DATE ?? null,
        translate_status:             "pending",
        apollo_status:                "pending",
        invite_status:                "pending",
      }))

    const pageSkipped = items.length - rows.length
    skipped += pageSkipped

    if (rows.length > 0) {
      const { error: insertErr } = await supabase
        .from("beauty_suppliers_staging")
        .insert(rows)

      if (insertErr) {
        console.warn(`  ⚠️  페이지 ${pageNo} INSERT 오류:`, insertErr.message)
        skipped += rows.length
        errors++
      } else {
        inserted += rows.length
        rows.forEach(r => {
          if (r.business_registration_number) existingBizNos.add(r.business_registration_number)
        })
      }
    }

    // 10페이지마다 진행 현황 출력
    if (pageNo % 10 === 0 || pageNo === totalPages) {
      const pct = ((pageNo / totalPages) * 100).toFixed(1)
      process.stdout.write(
        `\r  진행: ${pageNo}/${totalPages}페이지 (${pct}%) | 적재 ${inserted.toLocaleString()}건 | 스킵 ${skipped.toLocaleString()}건`
      )
    }
  }

  // 4. 최종 요약
  console.log("\n\n[4/4] 완료")
  console.log("─".repeat(40))
  console.log(`  전체 조회:  ${totalCount.toLocaleString()}건`)
  console.log(`  신규 적재:  ${inserted.toLocaleString()}건`)
  console.log(`  스킵(중복): ${skipped.toLocaleString()}건`)
  if (errors > 0) console.log(`  오류 페이지: ${errors}개`)
  console.log("─".repeat(40))
}

main().catch(err => {
  console.error("❌ 예외:", err)
  process.exit(1)
})
