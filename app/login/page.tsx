"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

// /login?next=... 쿼리에서 안전한 내부 경로만 허용 (open redirect 방지)
function safeRedirect(value: string | null): string {
  if (!value) return "/mypage"
  if (!value.startsWith("/") || value.startsWith("//")) return "/mypage"
  return value
}

// useSearchParams()는 Suspense boundary 안에서만 사용 가능 — Next.js 빌드 요구사항
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  )
}

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectAfter = safeRedirect(searchParams.get("next"))
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  // Google OAuth — Supabase 가 provider 페이지로 redirect, 콜백은 /api/auth/callback
  // ?next= 로 원래 가려던 경로를 callback 라우트까지 전달
  const handleGoogleLogin = async () => {
    setIsLoading(true)
    setErrorMsg("")
    const supabase = createSupabaseBrowserClient()
    const callbackUrl = `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(redirectAfter)}`
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
    // 성공 시 Supabase 가 외부 navigate 시키므로 별도 리디렉트 불필요
  }

  // 이메일 + 비밀번호 로그인
  const handleEmailLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg("")
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setErrorMsg(error.message)
      setIsLoading(false)
      return
    }
    router.push(redirectAfter)
    router.refresh() // 미들웨어가 새 세션 쿠키 인식하도록 RSC 캐시 무효화
  }

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: "#0d0d0f" }}
    >
      {/* Radial Gradient Glow */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(255, 75, 110, 0.05) 0%, transparent 50%)"
        }}
      />

      {/* Login Card */}
      <div 
        className="w-full max-w-[400px] rounded-2xl p-8 relative z-10"
        style={{ backgroundColor: "#141418" }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-semibold text-foreground mb-2 inline-block hover:opacity-80 transition-opacity">
            UnfoldK
          </Link>
          <p className="text-muted-foreground mt-2">Welcome back, Hallyu fan</p>
        </div>

        {/* Social Login Buttons */}
        <div className="space-y-2.5 mb-6">
          <Button
            variant="outline"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full h-11 bg-white hover:bg-gray-100 text-gray-900 border-0 rounded-lg font-medium"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-border/50" />
          <span className="text-muted-foreground text-sm">or</span>
          <div className="flex-1 h-px bg-border/50" />
        </div>

        {/* Error Message */}
        {errorMsg && (
          <p className="text-sm mb-4" style={{ color: "#FF4B6E" }}>
            {errorMsg}
          </p>
        )}

        {/* Email Login Form */}
        <form className="space-y-4 mb-6" onSubmit={handleEmailLogin}>
          <Input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 bg-[#1a1a1a] border-0 rounded-lg text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary"
          />

          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 bg-[#1a1a1a] border-0 rounded-lg text-foreground placeholder:text-muted-foreground pr-10 focus-visible:ring-1 focus-visible:ring-primary"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>

          <div className="flex justify-end">
            <Link 
              href="/forgot-password" 
              className="text-sm hover:underline"
              style={{ color: "#FF4B6E" }}
            >
              Forgot password?
            </Link>
          </div>

          {/* Login Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 rounded-full font-medium text-white"
            style={{ backgroundColor: "#FF4B6E" }}
          >
            Log in
          </Button>
        </form>

        {/* Footer Text */}
        <p className="text-center text-muted-foreground text-sm">
          Don&apos;t have an account?{" "}
          <Link 
            href="/signup" 
            className="font-medium hover:underline"
            style={{ color: "#FF4B6E" }}
          >
            Sign up
          </Link>
        </p>
      </div>

      {/* Copyright */}
      <p className="text-muted-foreground text-xs mt-8 relative z-10">
        © 2026 UNFOLD LAB · unfoldk.com
      </p>
    </div>
  )
}
