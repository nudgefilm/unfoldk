"use client"

// 브라우저 번역 활성 상태에서 SPA 라우팅 시 발생하는 React hydration 에러 방지.
// Google 번역 등이 DOM을 수정한 채로 Next.js soft navigation이 일어나면
// virtual DOM reconciliation 실패 → 페이지 먹통.
// 번역 중일 때 경로가 바뀌면 full reload로 전환해 항상 새 DOM으로 시작.

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

function isBrowserTranslating(): boolean {
  if (typeof document === "undefined") return false
  const cls = document.documentElement.classList
  return cls.contains("translated-ltr") || cls.contains("translated-rtl")
}

export function TranslationGuard() {
  const pathname = usePathname()
  const prevPathname = useRef(pathname)

  useEffect(() => {
    if (prevPathname.current === pathname) return
    prevPathname.current = pathname

    if (isBrowserTranslating()) {
      // 번역 활성 상태 → SPA 라우팅 대신 full reload
      // 새 페이지가 번역 없는 깨끗한 DOM으로 로드되고, 브라우저가 신규 페이지를 다시 번역
      window.location.href = pathname
    }
  }, [pathname])

  return null
}
