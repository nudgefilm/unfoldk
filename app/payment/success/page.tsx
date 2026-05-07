"use client"

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
          Welcome to Hallyu Pass!
        </h1>
        <p className="text-muted-foreground text-center mb-6">
          Your subscription is now active.
        </p>

        {/* Summary Box */}
        <div className="bg-[#0d0d0f] rounded-xl p-5 mb-6 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Plan</span>
            <span className="text-foreground font-medium">Hallyu Pass</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Billing</span>
            <span className="text-foreground font-medium">$15.00/month</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Next billing</span>
            <span className="text-foreground font-medium">June 7, 2026</span>
          </div>
          <div className="border-t border-border/30 my-2" />
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Payment</span>
            <span className="text-foreground font-medium">Visa •••• 4242</span>
          </div>
        </div>

        {/* Action Button */}
        <Link href="/mypage" className="block">
          <Button 
            className="w-full py-3 rounded-xl font-medium text-white"
            style={{ backgroundColor: "#FF4B6E" }}
          >
            Go to My Dashboard
          </Button>
        </Link>

        {/* View Receipt Link */}
        <div className="text-center mt-4">
          <Link 
            href="/mypage/subscription" 
            className="text-muted-foreground text-sm hover:underline"
          >
            View receipt
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
