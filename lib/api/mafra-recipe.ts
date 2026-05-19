// 농림수산식품교육문화정보원 레시피 API 래퍼 (data.go.kr)
//
// 승인 엔드포인트 3종:
//   1) 기본정보  /openapi/tn_pubr_public_recipe_info_api
//   2) 재료정보  /openapi/tn_pubr_public_recipe_mtrials_info_api
//   3) 과정정보  /openapi/tn_pubr_public_recipe_process_api
//
// 인증: serviceKey (공공데이터포털 발급, **Encoding 키 그대로** 사용 — URL 빌드 시
//   직접 문자열 결합하므로 fetch 가 추가 인코딩하지 않음. TourAPI 와 동일한 함정 회피).
//
// 응답 캐싱: 모든 GET 24h revalidate (레시피 데이터 거의 영구).
// HTTPS 비지원 가능성 → HTTP 사용. (data.go.kr 공식 가이드 기준)
//
// 쿼터: 1,000건/기능 (데이터활용사례 등록 시 10,000건/일). cron weekly + cap 으로 통제.

const MAFRA_BASE = "http://api.data.go.kr/openapi"
const REVALIDATE_24H = 86400

export class MafraRecipeError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message)
    this.name = "MafraRecipeError"
  }
}

function getServiceKey(): string {
  const key = process.env.MAFRA_API_KEY
  if (!key) throw new MafraRecipeError("MAFRA_API_KEY 미설정")
  return key
}

// 공공데이터포털 응답 envelope — 본 API 군은 응답 형태가 일관되지 않을 수 있어
// 두 패턴 (items 배열 직접 vs items.item nested) 모두 방어.
interface MafraBody<T> {
  items?: T[] | { item?: T | T[] } | ""
  totalCount?: number
  pageNo?: number
  numOfRows?: number
}

interface MafraEnvelope<T> {
  response?: {
    header?: { resultCode?: string; resultMsg?: string }
    body?: MafraBody<T>
  }
}

function normalizeItems<T>(body: MafraBody<T> | undefined): T[] {
  if (!body) return []
  const items = body.items
  if (!items || typeof items === "string") return []
  if (Array.isArray(items)) return items
  const item = items.item
  if (!item) return []
  return Array.isArray(item) ? item : [item]
}

async function mafraFetch<T>(
  endpoint: string,
  params: Record<string, string | number>
): Promise<{ items: T[]; totalCount: number }> {
  // serviceKey 는 URL 빌드 시 직접 결합 (URLSearchParams 인코딩 회피 — 공공데이터포털 패턴)
  const qs = new URLSearchParams({
    type: "json",
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  })
  const url = `${MAFRA_BASE}/${endpoint}?serviceKey=${getServiceKey()}&${qs.toString()}`

  let res: Response
  try {
    res = await fetch(url, { next: { revalidate: REVALIDATE_24H } })
  } catch (err) {
    throw new MafraRecipeError(
      `네트워크 오류 (${endpoint}): ${err instanceof Error ? err.message : String(err)}`
    )
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new MafraRecipeError(
      `HTTP ${res.status} (${endpoint}): ${body.slice(0, 200)}`,
      res.status
    )
  }

  // 키 오류·범위 외에서 XML/HTML 에러를 200 으로 반환할 수 있어 방어
  const text = await res.text()
  let json: MafraEnvelope<T>
  try {
    json = JSON.parse(text)
  } catch {
    throw new MafraRecipeError(
      `응답 JSON 파싱 실패 (${endpoint}): ${text.slice(0, 200)}`
    )
  }

  const header = json.response?.header
  if (header?.resultCode && header.resultCode !== "00" && header.resultCode !== "0000") {
    throw new MafraRecipeError(
      `MAFRA error ${header.resultCode}: ${header.resultMsg ?? "unknown"} (${endpoint})`
    )
  }

  const body = json.response?.body
  return {
    items: normalizeItems<T>(body),
    totalCount: body?.totalCount ?? 0,
  }
}

// ─── 응답 타입 ────────────────────────────────────────────────

// 기본정보 (요리명·조리방법·종류·영양·이미지)
export interface MafraRecipeBasic {
  rcpSeq: string                 // 레시피번호 (멱등 키)
  rcpNm?: string                 // 요리명 (한글)
  rcpWay2?: string               // 조리방법 (예: "굽기", "끓이기")
  rcpPat2?: string               // 요리종류 (예: "반찬", "국&찌개")
  infoEng?: string               // 열량 (kcal)
  infoCar?: string               // 탄수화물 (g)
  infoPro?: string               // 단백질 (g)
  infoFat?: string               // 지방 (g)
  infoNa?: string                // 나트륨 (mg)
  rcpNaTip?: string              // 저나트륨 조리팁
  attFileNoMk?: string           // 대표 이미지 URL 1
  attFileNoMain?: string         // 대표 이미지 URL 2
}

// 재료정보
export interface MafraRecipeIngredient {
  rcpSeq: string
  rcpPartsDtls?: string          // 재료 상세 (예: "쌀밥 1공기, 김 2장, ...")
}

// 과정정보
export interface MafraRecipeStep {
  rcpSeq: string
  cookingNo?: string             // 순서 (1, 2, 3, ...)
  cookingDc?: string             // 조리 설명 (해당 단계 안내)
  stepFileUrl?: string           // 단계 이미지 URL
}

// ─── 1. 레시피 기본정보 목록 ──────────────────────────────────
export async function getRecipeList(args: {
  pageNo?: number
  numOfRows?: number
}): Promise<{ items: MafraRecipeBasic[]; totalCount: number }> {
  return mafraFetch<MafraRecipeBasic>("tn_pubr_public_recipe_info_api", {
    pageNo: args.pageNo ?? 1,
    numOfRows: args.numOfRows ?? 50,
  })
}

// ─── 2. 레시피 재료정보 ───────────────────────────────────────
// rcpSeq 단위 조회. 응답이 여러 행 (재료별 분리) 일 수도, 단일 rcpPartsDtls 일 수도 있어
// 호출자에서 join 처리 필요.
export async function getRecipeIngredients(
  rcpSeq: string,
  numOfRows = 50
): Promise<MafraRecipeIngredient[]> {
  const { items } = await mafraFetch<MafraRecipeIngredient>(
    "tn_pubr_public_recipe_mtrials_info_api",
    { pageNo: 1, numOfRows, RCP_SEQ: rcpSeq }
  )
  return items
}

// ─── 3. 레시피 과정정보 ───────────────────────────────────────
// rcpSeq 단위 조회. cookingNo 정렬 호출자에서 처리.
export async function getRecipeProcess(
  rcpSeq: string,
  numOfRows = 30
): Promise<MafraRecipeStep[]> {
  const { items } = await mafraFetch<MafraRecipeStep>(
    "tn_pubr_public_recipe_process_api",
    { pageNo: 1, numOfRows, RCP_SEQ: rcpSeq }
  )
  return items
}

// ─── 4. 통합 상세 (기본+재료+과정) ────────────────────────────
// 기본정보는 list 조회 결과로부터 입력받음 (list 응답에 이미 포함되어 있어 재호출 회피).
// 재료·과정만 추가 호출.
export interface MafraRecipeDetail {
  basic: MafraRecipeBasic
  ingredients: MafraRecipeIngredient[]
  steps: MafraRecipeStep[]
}

export async function getRecipeDetail(
  basic: MafraRecipeBasic
): Promise<MafraRecipeDetail> {
  const [ingredients, steps] = await Promise.all([
    getRecipeIngredients(basic.rcpSeq),
    getRecipeProcess(basic.rcpSeq),
  ])
  return { basic, ingredients, steps }
}
