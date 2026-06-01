"use client"

// 비로그인 유저 클릭 차단 + 툴팁 공통 래퍼
// isLoggedIn=false 일 때만 활성화. null(인증 확인 중)이면 차단 없음(깜빡임 방지).
// tooltipInside=true → overflow:hidden 부모 안에서 툴팁을 요소 내부 중앙에 표시.

import type { ReactNode } from "react"

interface AuthGateProps {
  isLoggedIn: boolean | null
  children: ReactNode
  className?: string
  tooltipInside?: boolean
}

export function AuthGate({ isLoggedIn, children, className, tooltipInside }: AuthGateProps) {
  return (
    <div className={`relative group/authgate ${className ?? ""}`}>
      {isLoggedIn === false && (
        <>
          {/* 클릭 차단 오버레이 */}
          <div
            className="absolute inset-0 z-10 cursor-not-allowed"
            onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
          />
          {/* 툴팁 — tooltipInside: 요소 중앙 / 기본: 요소 위쪽 */}
          <div
            className={`absolute z-20 pointer-events-none opacity-0 group-hover/authgate:opacity-100 transition-opacity duration-150 ${
              tooltipInside
                ? "inset-0 flex items-center justify-center"
                : "bottom-full left-1/2 -translate-x-1/2 mb-2"
            }`}
          >
            <div className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-white/10 text-xs text-white whitespace-nowrap shadow-lg">
              Sign up to access — it&apos;s free
            </div>
          </div>
        </>
      )}
      {children}
    </div>
  )
}
