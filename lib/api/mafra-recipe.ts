// 농림수산식품교육문화정보원 레시피 API 래퍼 (211.237.50.150:7080)
//
// ⚠️ 표준 data.go.kr 도메인이 아닌 농림부 별도 호스트 사용:
//   http://211.237.50.150:7080/openapi/{KEY}/json/{GRID_ID}/{startRow}/{endRow}
//
// 인증: serviceKey 가 URL 경로에 박힘 (쿼리파라미터 아님). Decoding 키 그대로 사용.
//   "sample" 자리에 키를 넣는 형태 — sample 은 100-row 무료 테스트용 placeholder.
//
// 데이터셋 (총 row 수, 2026-05 기준):
//   - Grid_20150827000000000226_1 : 레시피 기본정보 (537건)
//   - Grid_20150827000000000227_1 : 레시피 재료정보 (6,104건 — 레시피당 평균 11재료)
//   - Grid_20150827000000000228_1 : 레시피 과정정보 (3,022건 — 레시피당 평균 6단계)
//
// 페이징: API 가 RECIPE_ID 필터를 지원하지 않음 → 재료·과정은 전체 페이지 순회 후
//   호출자가 메모리에서 RECIPE_ID 로 join. 데이터셋이 작아 (총 9k row) 부담 없음.
//
// 응답 envelope: { [GRID_ID]: { totalCnt, startRow, endRow, result: { code, message }, row: [...] } }
// 성공 코드: "INFO-000".
//
// 캐싱: 24h revalidate.

const MAFRA_BASE = "http://211.237.50.150:7080/openapi"
const REVALIDATE_24H = 86400
const MAX_ROWS_PER_PAGE = 1000

export const RECIPE_GRID = {
  BASIC: "Grid_20150827000000000226_1",
  INGREDIENTS: "Grid_20150827000000000227_1",
  PROCESS: "Grid_20150827000000000228_1",
} as const

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

// 응답 envelope — grid id 가 동적 key 라 unknown 으로 추출 후 cast.
interface MafraEnvelope<T> {
  [gridId: string]: {
    totalCnt?: number
    startRow?: number
    endRow?: number
    result?: { code?: string; message?: string }
    row?: T[]
  }
}

async function mafraFetch<T>(
  gridId: string,
  startRow: number,
  endRow: number
): Promise<{ items: T[]; totalCount: number }> {
  // 키를 path 에 박는 형태 — Decoding 키 그대로 (encodeURIComponent 불필요, hex 키).
  const url = `${MAFRA_BASE}/${getServiceKey()}/json/${gridId}/${startRow}/${endRow}`

  let res: Response
  try {
    res = await fetch(url, { next: { revalidate: REVALIDATE_24H } })
  } catch (err) {
    throw new MafraRecipeError(
      `네트워크 오류 (${gridId}): ${err instanceof Error ? err.message : String(err)}`
    )
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new MafraRecipeError(
      `HTTP ${res.status} (${gridId}): ${body.slice(0, 200)}`,
      res.status
    )
  }

  const text = await res.text()
  let json: MafraEnvelope<T>
  try {
    json = JSON.parse(text) as MafraEnvelope<T>
  } catch {
    throw new MafraRecipeError(
      `응답 JSON 파싱 실패 (${gridId}): ${text.slice(0, 200)}`
    )
  }

  const grid = json[gridId]
  if (!grid) {
    throw new MafraRecipeError(`응답에 grid 없음 (${gridId}): ${text.slice(0, 200)}`)
  }
  const code = grid.result?.code
  if (code && code !== "INFO-000") {
    throw new MafraRecipeError(
      `MAFRA error ${code}: ${grid.result?.message ?? "unknown"} (${gridId})`
    )
  }

  return {
    items: grid.row ?? [],
    totalCount: grid.totalCnt ?? 0,
  }
}

// ─── 응답 타입 ────────────────────────────────────────────────

// 기본정보 (grid 226)
export interface MafraRecipeBasic {
  ROW_NUM?: number
  RECIPE_ID: number                // 멱등 키 (전역 unique)
  RECIPE_NM_KO?: string            // 요리명 한글 (예: "나물비빔밥")
  SUMRY?: string                   // 요약 (한 줄 설명)
  NATION_CODE?: string
  NATION_NM?: string               // "한식" 등
  TY_CODE?: string
  TY_NM?: string                   // "밥" / "국" / "반찬" 등
  COOKING_TIME?: string            // "60분"
  CALORIE?: string                 // "580Kcal"
  QNT?: string                     // "4인분"
  LEVEL_NM?: string                // "보통" / "쉬움" / "어려움"
  IRDNT_CODE?: string              // "곡류" / "어패류" 등 (대표 재료)
  PC_NM?: string                   // "5,000원" (예상 가격)
}

// 재료정보 (grid 227) — RECIPE_ID 당 여러 행 (재료별 분리)
export interface MafraRecipeIngredient {
  ROW_NUM?: number
  RECIPE_ID: number
  IRDNT_SN?: number                // 순서
  IRDNT_NM?: string                // 재료명 (예: "쌀")
  IRDNT_CPCTY?: string             // 분량 (예: "4컵", "200g")
  IRDNT_TY_CODE?: string
  IRDNT_TY_NM?: string             // "주재료" / "양념" 등
}

// 과정정보 (grid 228) — RECIPE_ID 당 여러 행 (단계별 분리)
export interface MafraRecipeStep {
  ROW_NUM?: number
  RECIPE_ID: number
  COOKING_NO?: number              // 단계 번호 (1, 2, 3, ...)
  COOKING_DC?: string              // 단계 설명
  STEP_TIP?: string                // 단계별 팁
}

// ─── 단일 페이지 호출 (페이징은 호출자가 관리) ────────────────
export async function getRecipeBasics(
  startRow: number,
  endRow: number
): Promise<{ items: MafraRecipeBasic[]; totalCount: number }> {
  return mafraFetch<MafraRecipeBasic>(RECIPE_GRID.BASIC, startRow, endRow)
}

export async function getRecipeIngredients(
  startRow: number,
  endRow: number
): Promise<{ items: MafraRecipeIngredient[]; totalCount: number }> {
  return mafraFetch<MafraRecipeIngredient>(RECIPE_GRID.INGREDIENTS, startRow, endRow)
}

export async function getRecipeProcess(
  startRow: number,
  endRow: number
): Promise<{ items: MafraRecipeStep[]; totalCount: number }> {
  return mafraFetch<MafraRecipeStep>(RECIPE_GRID.PROCESS, startRow, endRow)
}

// ─── 전체 페이지 순회 ─────────────────────────────────────────
// 데이터셋이 작아 (재료 6k / 과정 3k) 전체 fetch 후 RECIPE_ID 별 join 이 효율적.
async function fetchAll<T>(
  fetcher: (start: number, end: number) => Promise<{ items: T[]; totalCount: number }>
): Promise<T[]> {
  const out: T[] = []
  let start = 1
  while (true) {
    const end = start + MAX_ROWS_PER_PAGE - 1
    const { items, totalCount } = await fetcher(start, end)
    out.push(...items)
    if (items.length < MAX_ROWS_PER_PAGE) break
    if (out.length >= totalCount) break
    start += MAX_ROWS_PER_PAGE
  }
  return out
}

export async function getAllRecipeIngredients(): Promise<MafraRecipeIngredient[]> {
  return fetchAll(getRecipeIngredients)
}

export async function getAllRecipeProcess(): Promise<MafraRecipeStep[]> {
  return fetchAll(getRecipeProcess)
}
