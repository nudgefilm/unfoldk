"use client"

// /login — Start 플로우 단일화로 폐지된 진입점 (커밋 7bf5cbc).
// 기존 북마크·외부 링크 방어용으로 페이지는 유지하되 즉시 / 로 보낸다.
// 새 플로우는 / 의 헤더·히어로·CTA 의 Start 버튼 → StartModal → OAuth.
//
// `?redirect=` 파라미터 forward — ReportButton 등 옛 /login?redirect=X 패턴
// 호출에 대해 redirect 대상을 잃지 않도록 /?next=X 형태로 변환해 보존.
// (auth/callback 가 next 파라미터로 OAuth 완료 후 X 로 보냄)
//
// useSearchParams 는 Suspense 경계 필수 — 정적 prerender 안전 처리.

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function LoginRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const redirect = searchParams.get("redirect")
    router.replace(redirect ? `/?next=${encodeURIComponent(redirect)}` : "/")
  }, [router, searchParams])

  return null
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginRedirect />
    </Suspense>
  )
}
