import { NextRequest, NextResponse } from "next/server"

// 국세청 사업자 상태코드: "01" = 계속사업자, "02" = 휴업자, "03" = 폐업자
const ACTIVE_CODE = "01"

export async function POST(request: NextRequest) {
  try {
    const { businessNumber } = await request.json()

    if (!businessNumber) {
      return NextResponse.json(
        { error: "사업자등록번호를 입력하세요." },
        { status: 400 }
      )
    }

    // 하이픈 제거 후 10자리 숫자 검증
    const cleaned = String(businessNumber).replace(/-/g, "").trim()
    if (!/^\d{10}$/.test(cleaned)) {
      return NextResponse.json(
        { error: "올바른 형식이 아닙니다. (000-00-00000)" },
        { status: 400 }
      )
    }

    const apiKey = process.env.NTSAPI_KEY
    if (!apiKey) {
      console.error("[verify-business] NTSAPI_KEY 환경변수 미설정")
      return NextResponse.json(
        { error: "서버 설정 오류입니다. 관리자에게 문의하세요." },
        { status: 500 }
      )
    }

    // 국세청 사업자 상태조회 API
    // 공공데이터포털: https://api.odcloud.kr/api/nts-businessman/v1/status
    const ntsRes = await fetch(
      `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ b_no: [cleaned] }),
        // 국세청 API 응답 지연 대비 타임아웃
        signal: AbortSignal.timeout(10_000),
      }
    )

    if (!ntsRes.ok) {
      console.error("[verify-business] 국세청 API 응답 오류", ntsRes.status)
      return NextResponse.json(
        { error: "국세청 API 호출에 실패했습니다. 잠시 후 다시 시도하세요." },
        { status: 502 }
      )
    }

    const ntsData = await ntsRes.json()
    // 국세청 API 전체 응답 확인용 — 필드 구조 파악 후 제거 가능
    console.log("[verify-business] 국세청 응답 전체:", JSON.stringify(ntsData, null, 2))

    const result = ntsData?.data?.[0]
    console.log("[verify-business] result 필드:", result)

    if (!result) {
      return NextResponse.json(
        { error: "사업자 정보를 조회할 수 없습니다." },
        { status: 404 }
      )
    }

    if (result.b_stt_cd === ACTIVE_CODE) {
      // 계속사업자 — 인증 성공
      return NextResponse.json({ verified: true })
    }

    // 휴업자·폐업자·기타
    const statusLabel = result.b_stt || "확인 불가"
    return NextResponse.json(
      { error: `인증 불가 (${statusLabel}). 계속사업자만 신청할 수 있습니다.` },
      { status: 422 }
    )
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return NextResponse.json(
        { error: "국세청 API 응답 시간이 초과되었습니다. 잠시 후 다시 시도하세요." },
        { status: 504 }
      )
    }
    console.error("[verify-business]", err)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    )
  }
}
