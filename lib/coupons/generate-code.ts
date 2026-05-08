// 쿠폰 코드 생성 유틸 — 8자리 랜덤 대문자+숫자 (XXXX-XXXX 포맷)
//
// 디자인:
// - 모호한 글자 (0/O, I/1) 제외 → 받아 적기 쉬움
// - 4-4 split 으로 가독성 ↑ (예: KPOP-X7K2)
// - 대소문자 구분 없음 — apply 시 toUpperCase 로 정규화
// - DB 의 unique 제약과 충돌 시 최대 5회 재시도 후 throw

import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// 0/O, I/1 등 헷갈리는 글자 제외한 32자
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function randomChar(): string {
  return ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
}

// XXXX-XXXX 포맷 한 번 생성
function generateOnce(): string {
  let left = ""
  let right = ""
  for (let i = 0; i < 4; i++) left += randomChar()
  for (let i = 0; i < 4; i++) right += randomChar()
  return `${left}-${right}`
}

// 중복 없는 신규 쿠폰 코드 — DB unique 충돌 시 재시도
export async function generateUniqueCouponCode(maxAttempts = 5): Promise<string> {
  const supabase = createSupabaseAdminClient()
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateOnce()
    const { data, error } = await supabase
      .from("coupons")
      .select("id")
      .eq("code", code)
      .maybeSingle()

    if (error) {
      console.error("[coupons/generate-code] 중복 체크 실패:", error.message)
      throw new Error(`쿠폰 코드 중복 체크 실패: ${error.message}`)
    }
    if (!data) return code
  }
  // 32^8 ≈ 1조 조합이라 5회 충돌은 사실상 불가 — 도달 시 시스템 이상 신호
  throw new Error("쿠폰 코드 생성 실패: 5회 연속 중복 발생")
}
