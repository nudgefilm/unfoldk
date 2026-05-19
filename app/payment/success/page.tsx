"use client"

// 결제 완료 화면 — Lemon Squeezy 가 결제 완료 후 redirect 시키는 receipt URL
// ⚠️ 이 페이지 진입 시점엔 webhook(order_created) 이 도달하기 전일 수 있음.
//    실제 plan_type 활성화는 webhook 처리 시점이라 여기선 일반적인 환영 메시지만.

import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function PaymentSuccessPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ backgroundColor: "#0d0d0f" }}
    >
      {/* Glow Effect */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{
          background: "radial-gradient(circle at center, rgba(255, 75, 110, 0.05) 0%, transparent 50%)"
        }}
      />

      {/* Main Card */}
      <div
        className="relative w-full max-w-md bg-[#141418] rounded-2xl p-8 shadow-xl"
        style={{ borderRadius: "16px" }}
      >
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
            style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
          >
            <span style={{ color: "#FF4B6E" }}>✦</span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white text-center mb-2">
          Welcome to Hallyu Pass! 🎉
        </h1>
        <p className="text-muted-foreground text-center mb-8">
          Your subscription is now active. Enjoy full access to all 6 services.
        </p>

        {/* Primary CTA */}
        <Link href="/mypage" className="block">
          <Button
            className="w-full py-3 rounded-xl font-medium text-white"
            style={{ backgroundColor: "#FF4B6E" }}
          >
            Go to My Dashboard
          </Button>
        </Link>

        {/* View Receipt Link — 결제 영수증은 LMS 측 이메일로 전달됨 */}
        <div className="text-center mt-4">
          <Link
            href="/mypage/subscription"
            className="text-muted-foreground text-sm hover:underline"
          >
            View subscription details
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
