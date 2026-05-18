// 한국관광공사 TourAPI 4.0 (KorService2) 래퍼
//
// ⚠️ 키 형식 — 공공데이터포털 발급의 두 형식 중 **Decoding 키** (디코딩된 원본) 사용.
//    URL-encoded 형식 (%2B 등 포함) 을 그대로 쓰면 fetch 가 URLSearchParams 로 한 번 더
//    인코딩해 깨짐.
// ⚠️ 기본 endpoint 는 KorService2 (영문 메서드명 + JSON 응답). MobileApp 헤더는 임의 식별자.
// ⚠️ 응답이 가끔 빈 객체 (`response.body.items === ""`) 로 와 items?.item 안전 가드 필수.
//
// 응답 캐싱:
//   - GET 요청 모두 next.revalidate 적용 (CLAUDE.md §6 #5)
//   - 위치기반·키워드 검색: 6h (지점 데이터는 자주 안 바뀜)
//   - 행사 정보: 1h (시간 민감)
//   - 이미지 정보: 24h (이미지 URL 거의 영구)
//
// SDK 미사용 — 단순 GET 6 메서드라 fetch 직접 호출이 더 단순.

const TOUR_BASE = "https://apis.data.go.kr/B551011/KorService2"
const MOBILE_OS = "ETC"
const MOBILE_APP = "UnfoldK"

// TourAPI 4.0 contentTypeId — 자주 쓰는 4종만 상수화 (전체 목록은 공식 가이드)
export const CONTENT_TYPE = {
  TOURIST_SPOT: 12,   // 관광지
  CULTURAL: 14,       // 문화시설
  FESTIVAL: 15,       // 행사·축제·공연
  TRAVEL_COURSE: 25,  // 여행코스
  LEISURE_SPORTS: 28, // 레포츠
  LODGING: 32,        // 숙박
  SHOPPING: 38,       // 쇼핑
  RESTAURANT: 39,     // 음식점
} as const

export type ContentTypeId = (typeof CONTENT_TYPE)[keyof typeof CONTENT_TYPE]

// 지역 코드 areaCode (areaCode2 엔드포인트 응답 기준) — 자주 쓰는 광역만 상수화
export const AREA_CODE = {
  SEOUL: 1,
  INCHEON: 2,
  DAEJEON: 3,
  DAEGU: 4,
  GWANGJU: 5,
  BUSAN: 6,
  ULSAN: 7,
  SEJONG: 8,
  GYEONGGI: 31,
  GANGWON: 32,
  CHUNGCHEONGBUK: 33,
  CHUNGCHEONGNAM: 34,
  GYEONGSANGBUK: 35,
  GYEONGSANGNAM: 36,
  JEOLLABUK: 37,
  JEOLLANAM: 38,
  JEJU: 39,
} as const

export class TourApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message)
    this.name = "TourApiError"
  }
}

function getServiceKey(): string {
  const key = process.env.TOUR_API_KEY
  if (!key) throw new TourApiError("TOUR_API_KEY 미설정")
  return key
}

interface TourBaseResponse<T> {
  response?: {
    header?: { resultCode?: string; resultMsg?: string }
    body?: {
      items?: { item?: T | T[] } | ""
      numOfRows?: number
      pageNo?: number
      totalCount?: number
    }
  }
}

// items.item 이 단일 객체일 수도, 배열일 수도, 빈 문자열 ""일 수도 있음.
// 모든 케이스를 배열로 정규화.
type TourBody<T> = { items?: { item?: T | T[] } | ""; totalCount?: number } | undefined

function normalizeItems<T>(body: TourBody<T>): T[] {
  if (!body) return []
  const items = body.items
  if (!items || typeof items === "string") return []
  const item = items.item
  if (!item) return []
  return Array.isArray(item) ? item : [item]
}

async function tourFetch<T>(
  endpoint: string,
  params: Record<string, string | number>,
  revalidate: number
): Promise<{ items: T[]; totalCount: number }> {
  const qs = new URLSearchParams({
    serviceKey: getServiceKey(),
    MobileOS: MOBILE_OS,
    MobileApp: MOBILE_APP,
    _type: "json",
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  })

  const url = `${TOUR_BASE}/${endpoint}?${qs.toString()}`
  let res: Response
  try {
    res = await fetch(url, { next: { revalidate } })
  } catch (err) {
    throw new TourApiError(
      `네트워크 오류 (${endpoint}): ${err instanceof Error ? err.message : String(err)}`
    )
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new TourApiError(`HTTP ${res.status} (${endpoint}): ${body.slice(0, 200)}`, res.status)
  }

  // TourAPI 가 키 오류·범위 외 등에서 XML 에러 페이지를 200 으로 반환하는 경우 방어
  const text = await res.text()
  let json: TourBaseResponse<T>
  try {
    json = JSON.parse(text)
  } catch {
    throw new TourApiError(
      `응답 JSON 파싱 실패 (${endpoint}): ${text.slice(0, 200)}`
    )
  }

  const header = json.response?.header
  if (header?.resultCode && header.resultCode !== "0000") {
    throw new TourApiError(
      `TourAPI error ${header.resultCode}: ${header.resultMsg ?? "unknown"} (${endpoint})`
    )
  }

  const body = json.response?.body as TourBody<T>
  return {
    items: normalizeItems<T>(body),
    totalCount: body?.totalCount ?? 0,
  }
}

// ─── 공통 아이템 형상 (엔드포인트마다 일부 필드 추가) ───────
export interface TourItem {
  contentid: string
  contenttypeid: string
  title: string
  addr1?: string
  addr2?: string
  areacode?: string
  sigungucode?: string
  firstimage?: string  // 큰 이미지 (가끔 ""), 가끔 누락
  firstimage2?: string // 썸네일 — 우선 사용 (작은 카드)
  mapx?: string        // 경도 (WGS84) — TourAPI 응답은 문자열
  mapy?: string        // 위도
  tel?: string
  cat1?: string
  cat2?: string
  cat3?: string
  modifiedtime?: string
  // searchFestival2 응답 추가 필드 (다른 엔드포인트에선 undefined)
  eventstartdate?: string  // YYYYMMDD
  eventenddate?: string    // YYYYMMDD
}

// ─── 1. 위치기반 관광정보조회 (locationBasedList2) ──────────────
// GPS + 반경 (m) 기반. 촬영지·아티스트 성지 근처 추천 카드용.
export async function locationBasedList(args: {
  mapX: number       // 경도
  mapY: number       // 위도
  radius: number     // m, 최대 20000
  contentTypeId?: ContentTypeId
  numOfRows?: number
  pageNo?: number
}): Promise<{ items: TourItem[]; totalCount: number }> {
  return tourFetch<TourItem>("locationBasedList2", {
    mapX: args.mapX,
    mapY: args.mapY,
    radius: Math.min(20000, Math.max(0, args.radius)),
    numOfRows: args.numOfRows ?? 30,
    pageNo: args.pageNo ?? 1,
    arrange: "S",  // 거리순
    ...(args.contentTypeId ? { contentTypeId: args.contentTypeId } : {}),
  }, 21600) // 6h
}

// ─── 2. 키워드 검색 (searchKeyword2) ─────────────────────────
// 촬영지 → GPS 매핑 핵심 (drama/장소명 검색 → GPS 자동 추출)
export async function searchKeyword(args: {
  keyword: string
  contentTypeId?: ContentTypeId
  areaCode?: number
  numOfRows?: number
  pageNo?: number
}): Promise<{ items: TourItem[]; totalCount: number }> {
  return tourFetch<TourItem>("searchKeyword2", {
    keyword: args.keyword,
    numOfRows: args.numOfRows ?? 10,
    pageNo: args.pageNo ?? 1,
    arrange: "Q", // 정확도순 (이미지 있는 항목 우선이 'O' 지만 정확도가 더 중요)
    ...(args.contentTypeId ? { contentTypeId: args.contentTypeId } : {}),
    ...(args.areaCode ? { areaCode: args.areaCode } : {}),
  }, 21600)
}

// ─── 3. 지역기반 관광정보조회 (areaBasedList2) ───────────────
// 광역시도 + contentTypeId 조합. 카테고리별 카드 (음식점·숙박) 핵심.
export async function areaBasedList(args: {
  areaCode?: number
  sigunguCode?: number
  contentTypeId?: ContentTypeId
  numOfRows?: number
  pageNo?: number
}): Promise<{ items: TourItem[]; totalCount: number }> {
  return tourFetch<TourItem>("areaBasedList2", {
    numOfRows: args.numOfRows ?? 20,
    pageNo: args.pageNo ?? 1,
    arrange: "P", // 인기도순 (조회수 기반)
    ...(args.areaCode ? { areaCode: args.areaCode } : {}),
    ...(args.sigunguCode ? { sigunguCode: args.sigunguCode } : {}),
    ...(args.contentTypeId ? { contentTypeId: args.contentTypeId } : {}),
  }, 21600)
}

// ─── 4. 음식점 — areaBasedList wrapper (contentTypeId=39) ────
export async function getRestaurants(args: {
  areaCode?: number
  numOfRows?: number
  pageNo?: number
}): Promise<{ items: TourItem[]; totalCount: number }> {
  return areaBasedList({ ...args, contentTypeId: CONTENT_TYPE.RESTAURANT })
}

// ─── 5. 숙박 — areaBasedList wrapper (contentTypeId=32) ──────
export async function getLodging(args: {
  areaCode?: number
  numOfRows?: number
  pageNo?: number
}): Promise<{ items: TourItem[]; totalCount: number }> {
  return areaBasedList({ ...args, contentTypeId: CONTENT_TYPE.LODGING })
}

// ─── 6. 이미지 정보 (detailImage2) ──────────────────────────
// 특정 contentId 의 추가 이미지 갤러리 — 상세 페이지·hover 모달에서 사용.
export interface TourImage {
  contentid: string
  originimgurl?: string
  smallimageurl?: string
  imgname?: string
  serialnum?: string
}

export async function detailImage(
  contentId: string,
  numOfRows = 10
): Promise<{ items: TourImage[]; totalCount: number }> {
  return tourFetch<TourImage>("detailImage2", {
    contentId,
    imageYN: "Y",
    numOfRows,
    pageNo: 1,
  }, 86400) // 24h
}

// ─── 7. 공통 상세 (detailCommon2) ────────────────────────────
// list 응답이 제공 안 하는 overview / homepage / modifiedtime 보강용.
// areaBasedList2 / searchFestival2 결과 contentId 별 1회 호출.
export interface TourDetailCommon {
  contentid: string
  contenttypeid?: string
  title?: string
  overview?: string                  // 본문 (한국어, HTML 가능)
  homepage?: string                  // HTML <a> 태그 포함될 수 있음
  modifiedtime?: string              // YYYYMMDDHHMMSS
  firstimage?: string
  firstimage2?: string
  addr1?: string
  addr2?: string
  mapx?: string
  mapy?: string
  areacode?: string
  sigungucode?: string
}

export async function detailCommon(
  contentId: string
): Promise<TourDetailCommon | null> {
  const { items } = await tourFetch<TourDetailCommon>("detailCommon2", {
    contentId,
    numOfRows: 1,
    pageNo: 1,
  }, 21600) // 6h
  return items[0] ?? null
}


// ─── 8. 행사·축제·공연 (searchFestival2) ────────────────────
// 한류 페스티벌·콘서트·팝업 정보. 캘린더 보완 데이터로 활용 가능.
export async function searchFestival(args: {
  eventStartDate: string   // YYYYMMDD
  eventEndDate?: string    // YYYYMMDD
  areaCode?: number
  numOfRows?: number
  pageNo?: number
}): Promise<{ items: TourItem[]; totalCount: number }> {
  return tourFetch<TourItem>("searchFestival2", {
    eventStartDate: args.eventStartDate,
    numOfRows: args.numOfRows ?? 30,
    pageNo: args.pageNo ?? 1,
    arrange: "P",
    ...(args.eventEndDate ? { eventEndDate: args.eventEndDate } : {}),
    ...(args.areaCode ? { areaCode: args.areaCode } : {}),
  }, 3600) // 1h
}

// ─── 헬퍼: TourItem → 표준 spot 표현 ────────────────────────
// mapx/mapy 가 문자열이라 number 변환 + 빈 문자열 가드.
export interface NormalizedSpot {
  contentId: string
  title: string
  address: string | null
  latitude: number | null
  longitude: number | null
  imageUrl: string | null
}

export function normalizeSpot(item: TourItem): NormalizedSpot {
  const mapxNum = item.mapx ? Number(item.mapx) : null
  const mapyNum = item.mapy ? Number(item.mapy) : null
  return {
    contentId: item.contentid,
    title: item.title,
    address: [item.addr1, item.addr2].filter(Boolean).join(" ").trim() || null,
    latitude: Number.isFinite(mapyNum) && mapyNum !== 0 ? mapyNum : null,
    longitude: Number.isFinite(mapxNum) && mapxNum !== 0 ? mapxNum : null,
    imageUrl: item.firstimage || item.firstimage2 || null,
  }
}
