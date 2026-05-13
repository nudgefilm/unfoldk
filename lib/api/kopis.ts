// KOPIS (공연예술통합전산망) OpenAPI 래퍼
// 공식 가이드: https://www.kopis.or.kr/po/openapi/openApiGuide.do
// 응답 형식: XML → fast-xml-parser 로 JSON 변환
// ⚠️ API 키는 절대 하드코딩 금지 — process.env.KOPIS_API_KEY 만 참조

import { XMLParser } from "fast-xml-parser"

const KOPIS_BASE = "http://www.kopis.or.kr/openApi/restful/pblprfr"

// KOPIS shcate(장르) 코드 — 대중음악 (K팝 콘서트/팬미팅)
// 검증 필요 시 KOPIS 가이드 페이지의 '공연시설/공연목록' shcate 표 확인
export const KOPIS_GENRE_KPOP = "AAAA"

// KOPIS prfstate(공연상태) 코드: 01=공연예정, 02=공연중, 03=공연완료
export type KopisPrfState = "01" | "02" | "03"

export interface KopisListItem {
  mt20id: string         // 공연 ID — UNIQUE 키
  prfnm: string          // 공연명
  prfpdfrom: string      // 시작일 'YYYY.MM.DD'
  prfpdto: string        // 종료일 'YYYY.MM.DD'
  fcltynm: string        // 공연시설명
  poster: string         // 포스터 이미지 URL
  area: string           // 지역
  genrenm: string        // 장르명 ('대중음악' 등)
  openrun: string        // 오픈런 여부 Y/N
  prfstate: string       // '공연예정' | '공연중' | '공연완료'
}

interface KopisListParams {
  stdate: string         // 'YYYYMMDD'
  eddate: string         // 'YYYYMMDD'
  shcate: string         // 장르코드
  prfstate?: KopisPrfState
  rows?: number
  cpage?: number
}

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,  // 모든 값을 문자열로 유지 (mt20id 숫자 변환 방지)
})

interface KopisRawResponse {
  dbs?: {
    db?: KopisListItem | KopisListItem[]
    comMsgHeader?: { errMsg?: string }
  }
}

export async function fetchKopisList(
  params: KopisListParams
): Promise<KopisListItem[]> {
  const apiKey = process.env.KOPIS_API_KEY
  if (!apiKey) throw new Error("KOPIS_API_KEY 미설정")

  const qs = new URLSearchParams({
    service: apiKey,
    stdate: params.stdate,
    eddate: params.eddate,
    shcate: params.shcate,
    rows: String(params.rows ?? 100),
    cpage: String(params.cpage ?? 1),
  })
  if (params.prfstate) qs.set("prfstate", params.prfstate)

  const url = `${KOPIS_BASE}?${qs.toString()}`
  const res = await fetch(url, { next: { revalidate: 3600 } })
  if (!res.ok) {
    throw new Error(`KOPIS pblprfr error ${res.status}: ${await res.text()}`)
  }
  const xml = await res.text()
  const parsed = parser.parse(xml) as KopisRawResponse

  const errMsg = parsed?.dbs?.comMsgHeader?.errMsg
  if (errMsg) throw new Error(`KOPIS error: ${errMsg}`)

  const raw = parsed?.dbs?.db
  if (!raw) return []
  return Array.isArray(raw) ? raw : [raw]
}

// KST 기준 YYYYMMDD — KOPIS 는 한국 시간 기준 날짜 필터링
export function toKopisDate(d: Date): string {
  const kstOffsetMs = 9 * 60 * 60 * 1000
  const kst = new Date(d.getTime() + kstOffsetMs)
  const y = kst.getUTCFullYear()
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0")
  const day = String(kst.getUTCDate()).padStart(2, "0")
  return `${y}${m}${day}`
}
