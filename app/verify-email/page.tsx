"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function VerifyEmailPage() {
  const userEmail = "mia@example.com"

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4 relative"
      style={{ backgroundColor: "#0d0d0f" }}
    >
      {/* Background Glow */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(circle at 50% 40%, rgba(255, 75, 110, 0.05) 0%, transparent 50%)"
        }}
      />

      {/* Main Card */}
      <div 
        className="w-full max-w-md relative z-10 p-8 text-center"
        style={{ 
          backgroundColor: "#141418",
          borderRadius: "16px"
        }}
      >
        {/* Header */}
        <div className="mb-6">
          <Link href="/" className="text-2xl font-semibold text-foreground inline-block hover:opacity-80 transition-opacity mb-6">
            UnfoldK
          </Link>
          
          {/* Email Icon */}
          <div className="text-5xl mb-4">
            <span role="img" aria-label="email">✉️</span>
          </div>
          
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Verify your email
          </h1>
          <p className="text-muted-foreground text-sm">
            We sent a confirmation link to {userEmail}
          </p>
        </div>

        {/* Status Card */}
        <div 
          className="rounded-xl p-4 mb-6"
          style={{ backgroundColor: "#1a1a1a" }}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            {/* Animated Pulse Dot */}
            <span 
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: "#FF4B6E" }}
            />
            <span className="text-foreground text-sm font-medium">
              Waiting for confirmation...
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            Click the link in your email to activate your account.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3 mb-6">
          <Link href="/verify-email">
            <Button
              variant="outline"
              className="w-full py-3 rounded-xl border-border/50 hover:bg-secondary/50"
            >
              Resend verification email
            </Button>
          </Link>
          
          <button
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Change email address
          </button>
        </div>

        {/* Help Text */}
        <div className="text-xs text-muted-foreground space-y-1 mb-6">
          <p>Check your spam folder if you don&apos;t see it.</p>
          <p>The link expires in 24 hours.</p>
        </div>

        {/* Footer Link */}
        <p className="text-sm">
          <span className="text-muted-foreground">Already verified? </span>
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
