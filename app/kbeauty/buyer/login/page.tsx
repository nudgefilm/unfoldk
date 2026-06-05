"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { cn } from "@/lib/utils"

export default function BuyerLoginPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        setError("Invalid email or password. Please try again.")
        return
      }

      router.push("/kbeauty/dashboard/buyer")
    } catch {
      setError("A server error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputBase =
    "w-full px-4 py-3 border border-[#E8E2DA] rounded-lg text-sm text-[#0F0F0F] placeholder:text-[#6B6B6B]/50 hover:border-[#1A3A5C]/40 focus:border-[#1A3A5C] focus:outline-none transition-colors duration-200"

  return (
    <div
      className="min-h-screen bg-[#F8F7F5] flex flex-col items-center justify-center px-4"
      style={{
        fontFamily:
          '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      }}
    >
      {/* Logo */}
      <Link href="/kbeauty" className="flex items-center gap-1 mb-8">
        <span className="font-bold text-[#0F0F0F]">UnfoldK Beauty</span>
        <span className="text-[#C8A882]">&#9670;</span>
      </Link>

      {/* Card */}
      <div
        className="w-full max-w-[420px] bg-white border border-[#E8E2DA] px-8 py-10 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
        style={{ borderRadius: 12 }}
      >
        <h1
          className="text-[#0F0F0F] mb-2 text-center"
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize: 28,
            fontWeight: 600,
          }}
        >
          Buyer Login
        </h1>
        <p className="text-sm text-[#6B6B6B] text-center mb-8">
          Enter your registered email and password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@company.com"
              required
              className={inputBase}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-[#0F0F0F] mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={cn(inputBase, "pr-11")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-[#0F0F0F] transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && <p className="text-[13px] text-red-500">{error}</p>}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "w-full bg-[#1A3A5C] text-white font-semibold py-3.5 rounded-lg text-[15px] transition-colors",
              isSubmitting ? "opacity-60 cursor-not-allowed" : "hover:bg-[#153249]"
            )}
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-[#6B6B6B]">
          Don&apos;t have an account?{" "}
          <Link
            href="/kbeauty/buyer/register"
            className="text-[#1A3A5C] font-medium hover:underline"
          >
            Request Buyer Access
          </Link>
        </div>
      </div>
    </div>
  )
}
