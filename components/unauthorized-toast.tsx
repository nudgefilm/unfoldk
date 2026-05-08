"use client"

// 비관리자 /admin 접근 거부 토스트
// middleware 가 비관리자를 / 로 redirect 하면서 ?toast=unauthorized 파라미터를 붙이면
// 이 컴포넌트가 감지해 화면 상단 중앙에 1초 노출 후 자동 사라짐 + URL 파라미터 제거.
// (URL 잔존 시 새로고침으로 재노출되는 현상 방지)
//
// ⚠️ 가시성 = URL 파라미터에서 직접 파생 (useState 미사용).
//    이전 useState + setVisible(true) 패턴은 React 19 + Next 15 의 Suspense unblock
//    이후 effect 타이밍에 따라 "보일 새도 없이" false 로 넘어가는 케이스가 있어 토스트가
//    뜨지 않고 URL 파라미터만 제거되는 문제가 있었음. URL 만 가지고 렌더 여부를 결정하면
//    `?toast=unauthorized` 가 붙는 즉시 토스트가 뜨고, router.replace 로 파라미터를 떼면
//    같은 렌더 사이클에서 자동으로 사라짐.

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function UnauthorizedToastInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const showToast = searchParams.get("toast") === "unauthorized"

  // 진단 로그 — 브라우저 콘솔에서 마운트/표시 여부 즉시 확인용
  useEffect(() => {
    console.log("[unauthorized-toast]", {
      showToast,
      href: typeof window !== "undefined" ? window.location.href : null,
    })
  }, [showToast])

  // 토스트 표시 중일 때만 1초 타이머 등록 → URL 파라미터 제거
  useEffect(() => {
    if (!showToast) return

    const timer = setTimeout(() => {
      // toast 만 제거하고 다른 쿼리(있다면) 보존
      const params = new URLSearchParams(searchParams.toString())
      params.delete("toast")
      const query = params.toString()
      router.replace(query ? `/?${query}` : "/")
    }, 3000)

    return () => clearTimeout(timer)
  }, [showToast, searchParams, router])

  if (!showToast) return null

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] bg-[#1a1a1a] border border-border/30 rounded-xl px-6 py-3 shadow-lg">
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
