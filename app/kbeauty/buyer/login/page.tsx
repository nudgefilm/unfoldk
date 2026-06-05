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

export default function BuyerLoginPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState("")

  // Password reset
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
    setIsSubmitting(true)

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) { setError("Invalid email or password. Please try again."); return }
      router.push("/kbeauty/dashboard/buyer")
    } catch {
      setError("A server error occurred. Please try again.")
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
          Buyer Login
        </h1>
        <p className="text-sm text-[#6B6B6B] text-center mb-6">Enter your registered email and password.</p>

        {/* Google Login */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading}
          className="w-full flex items-center justify-center gap-2.5 border border-[#E8E2DA] bg-white py-3 rounded-lg text-sm font-medium text-[#0F0F0F] hover:bg-[#F8F7F5] transition-colors disabled:opacity-60"
        >
          {GOOGLE_SVG}
          {isGoogleLoading ? "Connecting..." : "Continue with Google"}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[#E8E2DA]" />
          <span className="text-xs text-[#6B6B6B]">or</span>
          <div className="flex-1 h-px bg-[#E8E2DA]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0F0F0F] mb-2">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@company.com" required className={inputBase} />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0F0F0F] mb-2">Password</label>
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
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Forgot Password */}
        <div className="mt-4">
          {showResetForm ? (
            <div className="p-4 bg-[#F8F7F5] border border-[#E8E2DA] rounded-lg">
              {resetSent ? (
                <p className="text-sm text-green-600 text-center">Password reset email has been sent.</p>
              ) : (
                <>
                  <p className="text-sm text-[#0F0F0F] mb-3">Enter your email to receive a reset link.</p>
                  <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="contact@company.com" className={cn(inputBase, "mb-2")} />
                  {resetError && <p className="text-[13px] text-red-500 mb-2">{resetError}</p>}
                  <div className="flex gap-2">
                    <button onClick={handlePasswordReset} disabled={isResetting || !resetEmail.trim()} className="flex-1 bg-[#1A3A5C] text-white text-sm font-medium py-2.5 rounded-lg hover:bg-[#153249] transition-colors disabled:opacity-60">
                      {isResetting ? "Sending..." : "Send Reset Link"}
                    </button>
                    <button onClick={() => { setShowResetForm(false); setResetSent(false); setResetError("") }} className="px-4 text-sm text-[#6B6B6B] hover:text-[#0F0F0F] border border-[#E8E2DA] rounded-lg transition-colors">
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button type="button" onClick={() => { setShowResetForm(true); setResetEmail(email) }} className="w-full text-center text-sm text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors">
              Forgot your password?
            </button>
          )}
        </div>

        <div className="mt-5 text-center text-sm text-[#6B6B6B]">
          Don&apos;t have an account?{" "}
          <Link href="/kbeauty/buyer/register" className="text-[#1A3A5C] font-medium hover:underline">Request Buyer Access</Link>
        </div>
      </div>
    </div>
  )
}
