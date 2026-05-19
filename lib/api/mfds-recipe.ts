// 식약처 (MFDS) COOKRCP01 레시피 API 래퍼
//
// 용도: MAFRA 레시피 (food_recipes 테이블, 537건) 가 이미지를 제공하지 않아
//   RCP_NM ↔ RECIPE_NM_KO 텍스트 매칭으로 이미지 URL 만 backfill.
//
// 엔드포인트:
//   https://openapi.foodsafetykorea.go.kr/api/{KEY}/COOKRCP01/json/{startIdx}/{endIdx}
//   - KEY: serviceKey 가 URL path 에 박힘 (MAFRA 와 동일 패턴)
//   - startIdx/endIdx: 1-based inclusive, max 1000 per call
//
// 응답 envelope: { COOKRCP01: { total_count, row: [...] } }
//
// 이미지 URL: 응답이 `http://www.foodsafetykorea.go.kr/...` — 저장 전 https 로 변환.
//
// 쿼터: 1,000건/일 (개인). 전체 (~1,200건) 1회 fetch + 주 1회 backfill 이면 충분.

const MFDS_BASE = "https://openapi.foodsafetykorea.go.kr/api"
const MAX_ROWS_PER_PAGE = 1000

export class MfdsRecipeError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message)
    this.name = "MfdsRecipeError"
  }
}

function getApiKey(): string {
  const key = process.env.MFDS_API_KEY
  if (!key) throw new MfdsRecipeError("MFDS_API_KEY 미설정")
  return key
}

// MFDS COOKRCP01 row — 본 backfill 작업에서 사용하는 필드만 명시.
// (전체 필드는 50+ 개 — MANUAL01~20 / MANUAL_IMG01~20 / 영양 등)
export interface MfdsCookRecipe {
  RCP_SEQ?: string
  RCP_NM?: string                     // 메뉴명 (매칭 키)
  RCP_WAY2?: string                   // 조리 방법
  RCP_PAT2?: string                   // 요리 종류
  ATT_FILE_NO_MAIN?: string           // 대표 이미지 (큰)
  ATT_FILE_NO_MK?: string             // 대표 이미지 (작은 - 마크)
  RCP_PARTS_DTLS?: string             // 재료 상세
  HASH_TAG?: string
  INFO_ENG?: string                   // 열량
  INFO_NA?: string
  INFO_PRO?: string
  INFO_FAT?: string
  INFO_CAR?: string
  RCP_NA_TIP?: string                 // 저나트륨 팁
  // 단계별 — 동적 인덱스, 본 작업에선 미사용
  MANUAL01?: string
  MANUAL_IMG01?: string
  // (MANUAL02..20 / MANUAL_IMG02..20 동일 패턴, 필요 시 확장)
}

interface MfdsEnvelope {
  COOKRCP01?: {
    total_count?: string
    row?: MfdsCookRecipe[]
    RESULT?: { CODE?: string; MSG?: string }
  }
}

async function mfdsFetch(
  startIdx: number,
  endIdx: number
): Promise<{ items: MfdsCookRecipe[]; totalCount: number }> {
  const url = `${MFDS_BASE}/${getApiKey()}/COOKRCP01/json/${startIdx}/${endIdx}`

  let res: Response
  try {
    res = await fetch(url, { cache: "no-store" })
  } catch (err) {
    throw new MfdsRecipeError(
      `네트워크 오류: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new MfdsRecipeError(
      `HTTP ${res.status}: ${body.slice(0, 200)}`,
      res.status
    )
  }

  const text = await res.text()

  // 잘못된 key → HTML alert script 반환 (200 status). JSON.parse 실패로 잡힘.
  let json: MfdsEnvelope
  try {
    json = JSON.parse(text) as MfdsEnvelope
  } catch {
    throw new MfdsRecipeError(`응답 JSON 파싱 실패: ${text.slice(0, 200)}`)
  }

  const cook = json.COOKRCP01
  if (!cook) {
    throw new MfdsRecipeError(`응답에 COOKRCP01 없음: ${text.slice(0, 200)}`)
  }

  // 일부 응답은 RESULT.CODE 로 에러 (INFO-200 = "해당하는 데이터가 없습니다" 등)
  const code = cook.RESULT?.CODE
  if (code && code !== "INFO-000") {
    throw new MfdsRecipeError(`MFDS error ${code}: ${cook.RESULT?.MSG ?? "unknown"}`)
  }

  const totalCount = cook.total_count ? Number(cook.total_count) : 0
  return {
    items: cook.row ?? [],
    totalCount: Number.isFinite(totalCount) ? totalCount : 0,
  }
}

// 전체 페이지 순회 — total_count 기준으로 페이지네이션.
// 인덱스가 1-based inclusive 라 1/1000 → 1001/2000 패턴.
export async function getAllCookRecipes(): Promise<MfdsCookRecipe[]> {
  const out: MfdsCookRecipe[] = []
  // 첫 호출로 total_count 확인 후 나머지 페이지 산정.
  const first = await mfdsFetch(1, MAX_ROWS_PER_PAGE)
  out.push(...first.items)
  const total = first.totalCount

  let start = MAX_ROWS_PER_PAGE + 1
  while (start <= total) {
    const end = Math.min(start + MAX_ROWS_PER_PAGE - 1, total)
    const page = await mfdsFetch(start, end)
    out.push(...page.items)
    if (page.items.length === 0) break        // 무한 루프 방어
    start = end + 1
  }
  return out
}

// 이미지 URL 정규화 — `http://www.foodsafetykorea.go.kr/...` → `https://...`
// 빈 문자열 / 미존재 → null.
export function normalizeImageUrl(raw: string | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  if (trimmed.startsWith("https://")) return trimmed
  if (trimmed.startsWith("http://")) {
    return "https://" + trimmed.slice("http://".length)
  }
  return null  // 알 수 없는 scheme 은 저장 안 함
}

// 메뉴명 정규화 — 매칭 성공률 향상용.
// 공백·중점·구두점·괄호 제거 + 소문자 (한글은 case 영향 없음).
export function normalizeRecipeName(s: string): string {
  return s
    .normalize("NFC")
    .replace(/\s+/g, "")
    .replace(/[·\-_,.()/\\[\]{}!?]/g, "")
    .toLowerCase()
}

// COOKRCP01 row → 매칭 결과 픽: 대표 이미지 URL 만 추출.
// ATT_FILE_NO_MAIN (대) 우선, 없으면 ATT_FILE_NO_MK (작).
export function pickImageUrl(row: MfdsCookRecipe): string | null {
  return (
    normalizeImageUrl(row.ATT_FILE_NO_MAIN) ??
    normalizeImageUrl(row.ATT_FILE_NO_MK)
  )
}
