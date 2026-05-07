"use client"

import { useState } from "react"
import Link from "next/link"
import { Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type FormState = "default" | "sent" | "error"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [formState, setFormState] = useState<FormState>("default")
  const [submittedEmail, setSubmittedEmail] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Simulate error for specific email
    if (email === "notfound@example.com") {
      setFormState("error")
      return
    }
    
    // Simulate success
    setSubmittedEmail(email)
    setFormState("sent")
  }

  const handleResend = () => {
    // Simulate resend
    setFormState("sent")
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

      {/* Forgot Password Card */}
      <div 
        className="w-full max-w-[400px] rounded-2xl p-8 relative z-10"
        style={{ backgroundColor: "#141418" }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-semibold text-foreground mb-4 inline-block hover:opacity-80 transition-opacity">
            UnfoldK
          </Link>
          <h1 className="text-xl font-semibold text-foreground mt-4 mb-2">
            Forgot your password?
          </h1>
          <p className="text-muted-foreground text-sm">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {/* State A: Default Form */}
        {formState === "default" && (
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 bg-[#1a1a1a] border-0 rounded-lg text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary"
            />

            <Button
              type="submit"
              className="w-full h-11 rounded-full font-medium text-white"
              style={{ backgroundColor: "#FF4B6E" }}
            >
              Send reset link
            </Button>
          </form>
        )}

        {/* State B: Sent Success */}
        {formState === "sent" && (
          <div className="text-center mb-6">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
            >
              <Mail className="w-8 h-8" style={{ color: "#FF4B6E" }} />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Check your inbox
            </h2>
            <p className="text-muted-foreground text-sm mb-4">
              We sent a reset link to {submittedEmail || "mia@example.com"}
            </p>
            <button
              onClick={handleResend}
              className="text-sm font-medium hover:underline"
              style={{ color: "#FF4B6E" }}
            >
              Didn&apos;t get it? Resend
            </button>
          </div>
        )}

        {/* State C: Error */}
        {formState === "error" && (
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (formState === "error") setFormState("default")
                }}
                required
                className="h-11 bg-[#1a1a1a] rounded-lg text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-red-500"
                style={{ borderColor: "#ef4444", borderWidth: "1px" }}
              />
              <p className="text-red-500 text-sm mt-2">
                No account found with this email.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full h-11 rounded-full font-medium text-white"
              style={{ backgroundColor: "#FF4B6E" }}
            >
              Send reset link
            </Button>
          </form>
        )}

        {/* Footer Link */}
        <div className="text-center">
          <Link 
            href="/login" 
            className="text-sm font-medium hover:underline inline-flex items-center gap-1"
            style={{ color: "#FF4B6E" }}
          >
            Back to Log in
          </Link>
        </div>
      </div>

      {/* Copyright */}
      <p className="text-muted-foreground text-xs mt-8 relative z-10">
        © 2026 UNFOLD LAB · unfoldk.com
      </p>
    </div>
  )
}
