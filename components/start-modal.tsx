"use client"

// Start 모달 — 단일 진입점
// "Log in" / "Try for Free" 분리를 폐지하고 어디서든 이 모달 하나로 OAuth 진입.
// Google OAuth 는 외부 redirect 가 필요해 모달 안에서 플랜·약관까지 처리하지 못하므로,
// 모달은 OAuth 시작만 담당하고 신규 유저의 플랜·약관 동의는 /start 페이지에서 받는다.
// 분기 판정: api/auth/callback 에서 users.agreed_to_terms 조회.
//   - false → /start?new=true (플랜 + 약관 화면)
//   - true  → next 경로 (기본 /mypage)

import { useState, type ReactNode } from "react"
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

interface StartModalProps {
  // 트리거 엘리먼트(버튼 등) — asChild 로 감싸 모달 open 토글에 연결
  trigger: ReactNode
}

export function StartModal({ trigger }: StartModalProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  // Google OAuth — 콜백은 /api/auth/callback (신규/기존 분기 처리)
  // 현재 URL 의 ?next=X 를 콜백 URL 에 forward — ReportButton 등에서
  //   /login?redirect=/calendar → /?next=%2Fcalendar 로 들어온 경우
  //   OAuth 완료 후 /calendar 로 복귀하기 위해 필요.
  // useSearchParams 대신 클릭 시점 window.location.search 를 읽어 Suspense 경계 부담 회피.
  const handleGoogleStart = async () => {
    setIsLoading(true)
    setErrorMsg("")
    const supabase = createSupabaseBrowserClient()
    const nextRaw = new URLSearchParams(window.location.search).get("next")
    // 내부 경로만 forward — open redirect 방지 (callback 도 재검증하지만 클라이언트에서도 가드)
    const next = nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : null
    const callbackUrl = next
      ? `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`
      : `${window.location.origin}/api/auth/callback`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
      },
    })
    if (error) {
      setErrorMsg(error.message)
      setIsLoading(false)
    }
    // 성공 시 Supabase 가 외부 navigate 하므로 별도 처리 불필요
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="sm:max-w-[420px] border-0 p-0 gap-0 rounded-2xl"
        style={{ backgroundColor: "#141418" }}
      >
        {/* 시각적으론 가렸으나 스크린리더용 타이틀·설명은 필수 (Radix 접근성 요구사항) */}
        <DialogTitle className="sr-only">Start with UnfoldK</DialogTitle>
        <DialogDescription className="sr-only">
          Sign in with Google to get started with your Hallyu journey.
        </DialogDescription>

        <div className="p-8">
          {/* 헤더 */}
          <div className="text-center mb-6">
            <span className="text-2xl font-semibold text-foreground inline-block">UnfoldK</span>
            <p className="text-muted-foreground mt-2 text-sm">
              Your pass to Korean culture
            </p>
          </div>

          {/* Google OAuth 버튼 */}
          <Button
            variant="outline"
            onClick={handleGoogleStart}
            disabled={isLoading}
            className="w-full h-11 bg-white hover:bg-gray-100 text-gray-900 border-0 rounded-lg font-medium mb-4"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button>

          {/* 에러 메시지 */}
          {errorMsg && (
            <p className="text-sm text-center mb-3" style={{ color: "#FF4B6E" }}>
              {errorMsg}
            </p>
          )}

          {/* 안내 문구 — 신규 유저는 다음 화면에서 플랜·약관 선택 안내 */}
          <p className="text-center text-muted-foreground text-xs mt-4 leading-relaxed">
            New here? You&apos;ll choose your plan and review terms after signing in.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
