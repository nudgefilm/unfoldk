"use client"

// 비관리자 /admin 접근 거부 토스트
// middleware 가 비관리자를 / 로 redirect 하면서 ?toast=unauthorized 파라미터를 붙이면
// 이 컴포넌트가 감지해 화면 상단 중앙에 1초 노출 후 자동 사라짐 + URL 파라미터 제거.
// (URL 잔존 시 새로고침으로 재노출되는 현상 방지)

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function UnauthorizedToastInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (searchParams.get("toast") !== "unauthorized") return

    setVisible(true)
    const timer = setTimeout(() => {
      setVisible(false)
      // toast 만 제거하고 다른 쿼리(있다면) 보존
      const params = new URLSearchParams(searchParams.toString())
      params.delete("toast")
      const query = params.toString()
      router.replace(query ? `/?${query}` : "/")
    }, 1000)

    return () => clearTimeout(timer)
  }, [searchParams, router])

  if (!visible) return null

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a1a] border border-border/30 rounded-xl px-6 py-3 shadow-lg">
      <p className="text-sm font-medium" style={{ color: "#FF4B6E" }}>
        This area is for administrators only.
      </p>
    </div>
  )
}

// useSearchParams() 는 Suspense boundary 안에서만 사용 가능 — Next.js 빌드 요구사항
export function UnauthorizedToast() {
  return (
    <Suspense fallback={null}>
      <UnauthorizedToastInner />
    </Suspense>
  )
}
