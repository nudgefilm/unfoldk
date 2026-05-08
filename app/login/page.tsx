"use client"

// /login — Start 플로우 단일화로 폐지된 진입점
// 기존 북마크·외부 링크 방어용으로 페이지는 유지하되 즉시 / 로 보낸다.
// 새 플로우는 / 의 헤더·히어로·CTA 의 Start 버튼 → StartModal → OAuth.

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/")
  }, [router])

  return null
}
