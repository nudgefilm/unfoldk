"use client"

import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StartModal } from "@/components/start-modal"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { usePolar } from "@/components/PolarProvider"

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userEmail, setUserEmail] = useState<string | undefined>()
  const [userId, setUserId] = useState<string | undefined>()
  const { openCheckout } = usePolar()

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user)
      setUserEmail(user?.email ?? undefined)
      setUserId(user?.id ?? undefined)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user)
      setUserEmail(session?.user?.email ?? undefined)
      setUserId(session?.user?.id ?? undefined)
    })
    return () => subscription.unsubscribe()
  }, [])

  function handleCheckout() {
    const plan = isAnnual ? "annual" : "monthly"
    openCheckout(plan, { email: userEmail, userId })
  }

  const freeFeatures = [
    "HallyuCalendar — upcoming events & tracking",
    "K-pop global chart (Top 20)",
    "K-drama recommendations (all years)",
    "Beginner Korean expressions daily",
  ]

  const proFeatures = [
    "Everything you need to live and breathe K-culture",
    "Never miss a comeback, premiere, or K-beauty drop",
    "⭐ Exclusive VIP Badge on your Hallyu Profile",
    "🎬 Unlock Premium K-Drama Recommendations",
    "🍜 Full K-food Recipe Collection",
    "🗺️ Exclusive Hallyu Travel Courses",
    "🎵 Full K-pop Stats & Chart History",
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
          className="flex-1 p-6 overflow-hidden rounded-xl flex flex-col justify-between items-start bg-gradient-to-b from-gray-50/5 to-gray-50/0"
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
              <div className="self-stretch">
                <Button
                  onClick={() => {/* already logged in, no action needed */}}
                  className="w-full px-5 py-2 rounded-[40px] flex justify-center items-center bg-transparent border border-zinc-600 text-zinc-200 hover:bg-zinc-800 hover:border-zinc-500"
                >
                  <span className="text-center text-sm font-medium leading-tight">
                    Current plan
                  </span>
                </Button>
              </div>
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
          className="flex-1 p-6 overflow-hidden rounded-xl flex flex-col justify-between items-start shadow-[0px_4px_8px_-2px_rgba(0,0,0,0.10)]"
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
                    {isAnnual ? "$3.33" : "$4.99"}
                  </div>
                  <div className="text-sm font-medium leading-tight text-white/70">
                    /month
                  </div>
                  {isAnnual && (
                    <span className="text-sm text-white/50 line-through">$4.99</span>
                  )}
                </div>
                {isAnnual ? (
                  <div className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 text-xs font-medium">
                    Billed $39.99/year · Save 33%
                  </div>
                ) : (
                  <div className="text-xs text-white/50">
                    or $39.99/year — save 33%
                  </div>
                )}
                <div className="self-stretch text-sm font-medium leading-tight text-white/70 mt-1">
                  For the real Hallyu fan
                </div>
              </div>
            </div>
            {isLoggedIn ? (
              <div className="self-stretch">
                <Button
                  onClick={handleCheckout}
                  className="w-full px-5 py-2 rounded-[40px] flex justify-center items-center bg-white hover:bg-white/90"
                >
                  <span className="text-center text-sm font-medium leading-tight" style={{ color: "#FF4B6E" }}>
                    Join now
                  </span>
                </Button>
              </div>
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
