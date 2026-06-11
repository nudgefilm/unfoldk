"use client"

import Link from "next/link"
import { Crown, Sparkles } from "lucide-react"

interface HallyuPassBannerProps {
  isPro: boolean
}

export function HallyuPassBanner({ isPro }: HallyuPassBannerProps) {
  if (isPro) return null

  return (
    <div
      className="w-full mx-auto max-w-5xl px-4 md:px-6 pb-8"
    >
      <div
        className="relative overflow-hidden rounded-2xl px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ background: "linear-gradient(135deg, #FF4B6E 0%, #c62a47 100%)" }}
      >
        {/* Background glow */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #fff 0%, transparent 70%)" }} />

        <div className="flex items-start gap-4">
          <div className="mt-0.5 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <Crown className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-base leading-tight">
              Unlock the full K-culture experience
            </p>
            <p className="text-white/70 text-sm mt-0.5">
              Concerts, premieres, travel courses, full K-pop stats & more — all in one pass.
            </p>
          </div>
        </div>

        <Link
          href="/pricing"
          className="flex-shrink-0 flex items-center gap-1.5 bg-white text-[#FF4B6E] font-semibold text-sm px-5 py-2.5 rounded-full hover:bg-white/90 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Get Hallyu Pass
        </Link>
      </div>
    </div>
  )
}
