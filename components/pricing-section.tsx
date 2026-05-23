"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StartModal } from "@/components/start-modal"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(false)
  // 로그인 상태에 따라 CTA 동작 분기 — 비로그인: StartModal, 로그인: /mypage/subscription
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user)
    })
    return () => subscription.unsubscribe()
  }, [])

  const freeFeatures = [
    "Basic access to all 6 services",
    "Up to 5 K-drama recommendations",
    "1 Korean expression per day",
    "Save up to 5 recipes",
  ]

  const proFeatures = [
    "Full access to all 6 services",
    "Never miss a comeback — real-time alerts",
    "Unlimited artist tracking",
  ]

  return (
    <section id="pricing" className="w-full px-5 overflow-hidden flex flex-col justify-start items-center my-0 py-8 md:py-14">
      <div className="self-stretch relative flex flex-col justify-center items-center gap-2 py-0">
        <div className="flex flex-col justify-start items-center gap-4">
          <h2 className="text-center text-foreground text-4xl md:text-5xl font-semibold leading-tight md:leading-[40px] text-balance">
            Simple pricing for every Hallyu fan
          </h2>
          <p className="self-stretch text-center text-muted-foreground text-sm font-medium leading-tight">
            Start free. Upgrade when you&apos;re ready.
          </p>
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="w-full px-5 flex flex-col md:flex-row justify-center items-stretch gap-4 md:gap-6 mt-8 max-w-[800px] mx-auto">
        
        {/* Free Plan Card */}
        <div
          className="flex-1 p-6 overflow-hidden rounded-xl flex flex-col justify-start items-start gap-6 bg-gradient-to-b from-gray-50/5 to-gray-50/0"
          style={{ outline: "1px solid hsl(var(--border))", outlineOffset: "-1px" }}
        >
          <div className="self-stretch flex flex-col justify-start items-start gap-6">
            <div className="self-stretch flex flex-col justify-start items-start gap-4">
              <div className="w-full text-sm font-medium leading-tight text-zinc-200">
                Free
              </div>
              <div className="self-stretch flex flex-col justify-start items-start gap-1">
                <div className="flex justify-start items-center gap-1.5">
                  <div className="text-3xl font-medium leading-10 text-zinc-50">
                    $0
                  </div>
                  <div className="text-center text-sm font-medium leading-tight text-zinc-400">
                    /month
                  </div>
                </div>
                <div className="self-stretch text-sm font-medium leading-tight text-zinc-400">
                  Perfect for casual fans
                </div>
              </div>
            </div>
            {isLoggedIn ? (
              <Link href="/mypage/subscription" className="self-stretch">
                <Button
                  className="w-full px-5 py-2 rounded-[40px] flex justify-center items-center bg-transparent border border-zinc-600 text-zinc-200 hover:bg-zinc-800 hover:border-zinc-500"
                >
                  <span className="text-center text-sm font-medium leading-tight">
                    Get started
                  </span>
                </Button>
              </Link>
            ) : (
              <div className="self-stretch">
                <StartModal
                  trigger={
                    <Button
                      className="w-full px-5 py-2 rounded-[40px] flex justify-center items-center bg-transparent border border-zinc-600 text-zinc-200 hover:bg-zinc-800 hover:border-zinc-500"
                    >
                      <span className="text-center text-sm font-medium leading-tight">
                        Get started
                      </span>
                    </Button>
                  }
                />
              </div>
            )}
          </div>
          <div className="self-stretch flex flex-col justify-start items-start gap-4">
            <div className="self-stretch text-sm font-medium leading-tight text-muted-foreground">
              What you get:
            </div>
            <div className="self-stretch flex flex-col justify-start items-start gap-3">
              {freeFeatures.map((feature) => (
                <div key={feature} className="self-stretch flex justify-start items-center gap-2">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <Check className="w-full h-full text-muted-foreground" strokeWidth={2} />
                  </div>
                  <div className="leading-tight font-normal text-sm text-left text-muted-foreground">
                    {feature}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Hallyu Pass Card */}
        <div
          className="flex-1 p-6 overflow-hidden rounded-xl flex flex-col justify-start items-start gap-6 shadow-[0px_4px_8px_-2px_rgba(0,0,0,0.10)]"
          style={{ backgroundColor: "#FF4B6E" }}
        >
          <div className="self-stretch flex flex-col justify-start items-start gap-6">
            <div className="self-stretch flex flex-col justify-start items-start gap-4">
              {/* Plan Name + Badge */}
              <div className="w-full flex items-center gap-2">
                <span className="text-sm font-medium leading-tight text-white">
                  Hallyu Pass
                </span>
                <div className="px-2 py-0.5 rounded-full bg-white/20">
                  <span className="text-xs font-medium text-white">Most Popular</span>
                </div>
              </div>

              {/* Billing Toggle Inside Card */}
              <div className="p-0.5 bg-white/10 rounded-lg flex items-center gap-1">
                <button
                  onClick={() => setIsAnnual(false)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    !isAnnual 
                      ? "bg-white text-[#FF4B6E] shadow-sm" 
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setIsAnnual(true)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    isAnnual 
                      ? "bg-white text-[#FF4B6E] shadow-sm" 
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  Annually · Save 33%
                </button>
              </div>

              {/* Price Display */}
              <div className="self-stretch flex flex-col justify-start items-start gap-1">
                <div className="flex justify-start items-center gap-2">
                  <div className="text-3xl font-medium leading-10 text-white">
                    {isAnnual ? "$10" : "$15"}
                  </div>
                  <div className="text-sm font-medium leading-tight text-white/70">
                    /month
                  </div>
                  {isAnnual && (
                    <span className="text-sm text-white/50 line-through">$15</span>
                  )}
                </div>
                {isAnnual && (
                  <div className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 text-xs font-medium">
                    2 months free
                  </div>
                )}
                <div className="self-stretch text-sm font-medium leading-tight text-white/70 mt-1">
                  For the real Hallyu fan
                </div>
              </div>
            </div>
            {isLoggedIn ? (
              <Link href="/mypage/subscription" className="self-stretch">
                <Button
                  className="w-full px-5 py-2 rounded-[40px] flex justify-center items-center bg-white hover:bg-white/90"
                >
                  <span className="text-center text-sm font-medium leading-tight" style={{ color: "#FF4B6E" }}>
                    Join now
                  </span>
                </Button>
              </Link>
            ) : (
              <div className="self-stretch">
                <StartModal
                  trigger={
                    <Button
                      className="w-full px-5 py-2 rounded-[40px] flex justify-center items-center bg-white hover:bg-white/90"
                    >
                      <span className="text-center text-sm font-medium leading-tight" style={{ color: "#FF4B6E" }}>
                        Join now
                      </span>
                    </Button>
                  }
                />
              </div>
            )}
          </div>
          <div className="self-stretch flex flex-col justify-start items-start gap-4">
            <div className="self-stretch text-sm font-medium leading-tight text-white/70">
              Everything in Free, plus:
            </div>
            <div className="self-stretch flex flex-col justify-start items-start gap-3">
              {proFeatures.map((feature) => (
                <div key={feature} className="self-stretch flex justify-start items-center gap-2">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <Check className="w-full h-full text-white" strokeWidth={2} />
                  </div>
                  <div className="leading-tight font-normal text-sm text-left text-white">
                    {feature}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-white/50">+ Google Calendar sync, iCal share, grammar explanations, and more</p>
          </div>
        </div>
      </div>

      {/* Footer Text */}
      <p className="text-center text-muted-foreground text-sm mt-6">
        All plans include a 7-day free trial. Cancel anytime.
      </p>
    </section>
  )
}
