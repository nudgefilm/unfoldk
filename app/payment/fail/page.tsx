"use client"

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
        <p className="text-muted-foreground text-center mb-6">
          We couldn&apos;t process your payment. No charges were made.
        </p>

        {/* Error Detail Box */}
        <div className="bg-[#0d0d0f] rounded-xl p-5 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Reason</span>
            <span className="text-foreground font-medium text-sm">Card declined — insufficient funds</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link href="/signup">
            <Button 
              className="w-full py-3 rounded-xl font-medium text-white"
              style={{ backgroundColor: "#FF4B6E" }}
            >
              Try again
            </Button>
          </Link>
          
          <Link href="/signup">
            <Button 
              variant="outline"
              className="w-full py-3 rounded-xl font-medium border-border/50 hover:bg-secondary/50"
            >
              Use a different card
            </Button>
          </Link>
        </div>

        {/* Contact Support Link */}
        <div className="text-center mt-4">
          <Link 
            href="/contact" 
            className="text-muted-foreground text-sm hover:underline"
          >
            Contact support →
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
