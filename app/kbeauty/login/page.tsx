"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { cn } from "@/lib/utils"

const GOOGLE_SVG = (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

export default function KBeautyLoginPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState("")
  const [noAccount, setNoAccount] = useState(false)

  // 비밀번호 찾기
  const [showResetForm, setShowResetForm] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState("")
  const [isResetting, setIsResetting] = useState(false)

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)
    setError("")
    const origin =
      window.location.hostname === "localhost"
        ? window.location.origin
        : "https://www.unfoldk.com"
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/api/kbeauty/auth/callback` },
    })
    if (oauthError) {
      setError(oauthError.message)
      setIsGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setNoAccount(false)
    setIsSubmitting(true)

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.")
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError("로그인에 실패했습니다."); return }

      const { data: supplier } = await supabase
        .from("beauty_suppliers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (supplier) { router.push("/kbeauty/dashboard/supplier"); return }

      const { data: buyer } = await supabase
        .from("beauty_buyers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (buyer) { router.push("/kbeauty/dashboard/buyer"); return }

      setNoAccount(true)
    } catch {
      setError("서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!resetEmail.trim()) return
    setIsResetting(true)
    setResetError("")
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(resetEmail.trim())
    if (resetErr) {
      setResetError(resetErr.message)
    } else {
      setResetSent(true)
    }
    setIsResetting(false)
  }

  const inputBase =
    "w-full px-4 py-3 border border-[#E8E2DA] rounded-lg text-sm text-[#0F0F0F] placeholder:text-[#6B6B6B]/50 hover:border-[#1A3A5C]/40 focus:border-[#1A3A5C] focus:outline-none transition-colors duration-200"

  return (
    <div
      className="min-h-screen bg-[#F8F7F5] flex flex-col items-center justify-center px-4"
      style={{ fontFamily: '"Pretendard Variable", Pretendard, -apple-system, sans-serif' }}
    >
      <Link href="/kbeauty" className="flex items-center gap-1 mb-8">
        <span className="font-bold text-[#0F0F0F]">UnfoldK Beauty</span>
        <span className="text-[#C8A882]">&#9670;</span>
      </Link>

      <div
        className="w-full max-w-[420px] bg-white border border-[#E8E2DA] px-8 py-10 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
        style={{ borderRadius: 12 }}
      >
        <h1
          className="text-[#0F0F0F] mb-2 text-center"
          style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: 28, fontWeight: 600 }}
        >
          로그인 / Login
        </h1>
        <p className="text-sm text-[#6B6B6B] text-center mb-6">공급사 · 바이어 공통 로그인</p>

        {/* 계정 없음 안내 */}
        {noAccount && (
          <div className="mb-5 p-4 border border-[#E8E2DA] text-center" style={{ borderRadius: 10, background: "#F8F7F5" }}>
            <p className="text-sm text-[#0F0F0F] mb-3">
              kbeauty 계정이 없습니다.
              <br />공급사 또는 바이어로 가입해주세요.
            </p>
            <div className="flex gap-2">
              <Link href="/kbeauty/supplier" className="flex-1 text-center text-xs font-semibold py-2.5 rounded-lg hover:bg-[#153249] transition-colors" style={{ background: "#1A3A5C", color: "#fff" }}>
                공급사 파트너 신청
              </Link>
              <Link href="/kbeauty/buyer/register" className="flex-1 text-center text-xs font-semibold py-2.5 rounded-lg hover:opacity-80 transition-opacity" style={{ background: "#C8A882", color: "#0F0F0F" }}>
                바이어 가입
              </Link>
            </div>
          </div>
        )}

        {/* Google 로그인 */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading}
          className="w-full flex items-center justify-center gap-2.5 border border-[#E8E2DA] bg-white py-3 rounded-lg text-sm font-medium text-[#0F0F0F] hover:bg-[#F8F7F5] transition-colors disabled:opacity-60"
        >
          {GOOGLE_SVG}
          {isGoogleLoading ? "연결 중..." : "Google로 계속하기"}
        </button>

        {/* 구분선 */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[#E8E2DA]" />
          <span className="text-xs text-[#6B6B6B]">또는</span>
          <div className="flex-1 h-px bg-[#E8E2DA]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0F0F0F] mb-2">이메일 / Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@company.com" required className={inputBase} />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0F0F0F] mb-2">비밀번호 / Password</label>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={cn(inputBase, "pr-11")}
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && <p className="text-[13px] text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className={cn("w-full bg-[#1A3A5C] text-white font-semibold py-3.5 rounded-lg text-[15px] transition-colors", isSubmitting ? "opacity-60 cursor-not-allowed" : "hover:bg-[#153249]")}
          >
            {isSubmitting ? "로그인 중..." : "로그인 / Log in"}
          </button>
        </form>

        {/* 비밀번호 찾기 */}
        <div className="mt-4">
          {showResetForm ? (
            <div className="p-4 bg-[#F8F7F5] border border-[#E8E2DA] rounded-lg">
              {resetSent ? (
                <p className="text-sm text-green-600 text-center">비밀번호 재설정 이메일을 발송했습니다.</p>
              ) : (
                <>
                  <p className="text-sm text-[#0F0F0F] mb-3">이메일을 입력하면 재설정 링크를 보내드립니다.</p>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="contact@company.com"
                    className={cn(inputBase, "mb-2")}
                  />
                  {resetError && <p className="text-[13px] text-red-500 mb-2">{resetError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handlePasswordReset}
                      disabled={isResetting || !resetEmail.trim()}
                      className="flex-1 bg-[#1A3A5C] text-white text-sm font-medium py-2.5 rounded-lg hover:bg-[#153249] transition-colors disabled:opacity-60"
                    >
                      {isResetting ? "발송 중..." : "재설정 링크 보내기"}
                    </button>
                    <button
                      onClick={() => { setShowResetForm(false); setResetSent(false); setResetError("") }}
                      className="px-4 text-sm text-[#6B6B6B] hover:text-[#0F0F0F] border border-[#E8E2DA] rounded-lg transition-colors"
                    >
                      취소
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setShowResetForm(true); setResetEmail(email) }}
              className="w-full text-center text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors"
            >
              비밀번호를 잊으셨나요? / Forgot password?
            </button>
          )}
        </div>

        <div className="mt-5 text-center text-sm text-[#6B6B6B]">
          <p className="mb-2">처음이신가요? / New here?</p>
          <div className="flex gap-2 justify-center">
            <Link href="/kbeauty/supplier" className="text-xs font-medium px-3 py-1.5 border border-[#1A3A5C] text-[#1A3A5C] rounded-md hover:bg-[#1A3A5C]/5 transition-colors">
              공급사 가입 / Supplier Sign Up
            </Link>
            <Link href="/kbeauty/buyer/register" className="text-xs font-medium px-3 py-1.5 border border-[#C8A882] text-[#8B6F47] rounded-md hover:bg-[#C8A882]/10 transition-colors">
              바이어 가입 / Buyer Sign Up
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
