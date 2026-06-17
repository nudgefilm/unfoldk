"use client"

// 결제 실패 화면 — Paddle 결제 실패/취소 시 redirect 되는 페이지
// 다시 시도 → /start (플랜 선택 + Paddle 체크아웃 진입)

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

export default function PaymentFailPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ backgroundColor: "#0d0d0f" }}
    >
      {/* Main Card */}
      <div
        className="relative w-full max-w-md bg-[#141418] rounded-2xl p-8 shadow-xl"
        style={{ borderRadius: "16px" }}
      >
        {/* Error Icon */}
        <div className="flex justify-center mb-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(239, 68, 68, 0.15)" }}
          >
            <X className="w-8 h-8" style={{ color: "#EF4444" }} />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white text-center mb-2">
          Payment failed
        </h1>
        <p className="text-muted-foreground text-center mb-8">
          Please try again. No charges were made.
        </p>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link href="/start">
            <Button
              className="w-full py-3 rounded-xl font-medium text-white"
              style={{ backgroundColor: "#FF4B6E" }}
            >
              Try again
            </Button>
          </Link>

          <Link href="/mypage">
            <Button
              variant="outline"
              className="w-full py-3 rounded-xl font-medium border-border/50 hover:bg-secondary/50"
            >
              Continue with Free
            </Button>
          </Link>
        </div>
      </div>

      {/* Copyright */}
      <p className="text-muted-foreground text-xs mt-8">
        © 2026 UNFOLD LAB · unfoldk.com
      </p>
    </div>
  )
}
