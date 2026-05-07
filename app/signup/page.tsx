"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

export default function SignupPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [selectedPlan, setSelectedPlan] = useState<"free" | "pro">("pro")
  const [isAnnual, setIsAnnual] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  // Google OAuth — login 과 동일
  const handleGoogleSignup = async () => {
    setIsLoading(true)
    setErrorMsg("")
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })
    if (error) {
      setErrorMsg(error.message)
      setIsLoading(false)
    }
  }

  // 이메일 회원가입 — 약관 동의·비밀번호 일치 검증 후 Supabase signUp
  const handleEmailSignup = async () => {
    setErrorMsg("")
    // 1. 약관 동의 필수
    if (!agreedToTerms) {
      setErrorMsg("Please agree to the Terms and Privacy Policy")
      return
    }
    // 2. 비밀번호 일치 확인
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match")
      return
    }

    setIsLoading(true)
    const supabase = createSupabaseBrowserClient()
    // plan 정보는 raw_user_meta_data 로 전달 — Stripe 결제 후 webhook 이 public.users 갱신
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          plan: selectedPlan,
          billing: isAnnual ? "annual" : "monthly",
        },
      },
    })
    if (error) {
      setErrorMsg(error.message)
      setIsLoading(false)
      return
    }
    router.push("/verify-email")
  }

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
      style={{ backgroundColor: "#0d0d0f" }}
    >
      {/* Radial Gradient Glow */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(255, 75, 110, 0.05) 0%, transparent 50%)"
        }}
      />

      {/* Signup Card */}
      <div 
        className="w-full max-w-[420px] rounded-2xl p-8 relative z-10"
        style={{ backgroundColor: "#141418" }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <Link href="/" className="text-2xl font-semibold text-foreground mb-2 inline-block hover:opacity-80 transition-opacity">
            UnfoldK
          </Link>
          <p className="text-muted-foreground mt-2">Join the Hallyu community</p>
        </div>

        {/* Social Signup Buttons */}
        <div className="space-y-2.5 mb-5">
          <Button
            variant="outline"
            onClick={handleGoogleSignup}
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
        <div className="flex items-center gap-4 mb-5">
          <div className="flex-1 h-px bg-border/50" />
          <span className="text-muted-foreground text-sm">or</span>
          <div className="flex-1 h-px bg-border/50" />
        </div>

        {/* Signup Form */}
        <form className="space-y-4 mb-5">
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
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 bg-[#1a1a1a] border-0 rounded-lg text-foreground placeholder:text-muted-foreground pr-10 focus-visible:ring-1 focus-visible:ring-primary"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <div className="relative">
            <Input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-11 bg-[#1a1a1a] border-0 rounded-lg text-foreground placeholder:text-muted-foreground pr-10 focus-visible:ring-1 focus-visible:ring-primary"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </form>

        {/* Plan Selector */}
        <div className="mb-5">
          <p className="text-muted-foreground text-sm mb-3">Choose your plan</p>
          <div className="grid grid-cols-2 gap-3">
            {/* Free Plan */}
            <button
              type="button"
              onClick={() => setSelectedPlan("free")}
              className={`p-4 rounded-xl text-left transition-all ${
                selectedPlan === "free"
                  ? "bg-[#1a1a1a] border-2 border-muted-foreground"
                  : "bg-[#1a1a1a] border border-border/30 hover:border-border/60"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-foreground font-medium">Free</span>
                {selectedPlan === "free" && (
                  <div className="w-5 h-5 rounded-full bg-muted-foreground flex items-center justify-center">
                    <Check className="w-3 h-3 text-background" />
                  </div>
                )}
              </div>
              <p className="text-muted-foreground text-sm">$0/month</p>
              <p className="text-muted-foreground text-xs mt-1">Basic access</p>
            </button>

            {/* Pro Plan */}
            <button
              type="button"
              onClick={() => setSelectedPlan("pro")}
              className={`p-4 rounded-xl text-left transition-all ${
                selectedPlan === "pro"
                  ? "bg-[#1a1a1a] border-2"
                  : "bg-[#1a1a1a] border border-border/30 hover:border-border/60"
              }`}
              style={selectedPlan === "pro" ? { borderColor: "#FF4B6E" } : {}}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-foreground font-medium">Hallyu Pass</span>
                {selectedPlan === "pro" && (
                  <div 
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "#FF4B6E" }}
                  >
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <p className="font-medium" style={{ color: "#FF4B6E" }}>
                {isAnnual ? "$10/month" : "$15/month"}
              </p>
              <p className="text-muted-foreground text-xs mt-1">Full access to all 5 services</p>
            </button>
          </div>

          {/* Annual Toggle */}
          <div className="flex items-center justify-between mt-3 p-3 bg-[#1a1a1a] rounded-lg">
            <span className="text-muted-foreground text-sm">
              Pay annually and save 33%
            </span>
            <button
              type="button"
              onClick={() => setIsAnnual(!isAnnual)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                isAnnual ? "" : "bg-border/50"
              }`}
              style={isAnnual ? { backgroundColor: "#FF4B6E" } : {}}
            >
              <span 
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  isAnnual ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Terms Checkbox */}
        <div className="flex items-start gap-3 mb-5">
          <button
            type="button"
            onClick={() => setAgreedToTerms(!agreedToTerms)}
            className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors mt-0.5 ${
              agreedToTerms ? "border-transparent" : "border-border/50 bg-[#1a1a1a]"
            }`}
            style={agreedToTerms ? { backgroundColor: "#FF4B6E" } : {}}
          >
            {agreedToTerms && <Check className="w-3 h-3 text-white" />}
          </button>
          <p className="text-muted-foreground text-sm">
            I agree to the{" "}
            <Link href="/terms" className="hover:underline" style={{ color: "#FF4B6E" }}>
              Terms of Use
            </Link>
            {" "}and{" "}
            <Link href="/privacy" className="hover:underline" style={{ color: "#FF4B6E" }}>
              Privacy Policy
            </Link>
          </p>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <p className="text-sm mb-3" style={{ color: "#FF4B6E" }}>
            {errorMsg}
          </p>
        )}

        {/* Signup Button */}
        <div className="block mb-5">
          <Button
            type="button"
            onClick={handleEmailSignup}
            disabled={isLoading}
            className="w-full h-11 rounded-full font-medium text-white"
            style={{ backgroundColor: "#FF4B6E" }}
          >
            Create my account
          </Button>
        </div>

        {/* Footer Text */}
        <p className="text-center text-muted-foreground text-sm">
          Already have an account?{" "}
          <Link 
            href="/login" 
            className="font-medium hover:underline"
            style={{ color: "#FF4B6E" }}
          >
            Log in
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
