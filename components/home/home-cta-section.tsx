"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

export function HomeCTASection() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user)
      setReady(true)
    })
  }, [])

  return (
    <section
      className="mx-5 rounded-2xl py-16 px-6 text-center border border-[#FF4B6E]/20 overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,75,110,0.12) 0%, rgba(255,75,110,0.04) 50%, rgba(255,75,110,0.10) 100%)",
      }}
    >
      <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
        Start Your Hallyu Journey
      </h2>
      <p className="text-muted-foreground text-lg mb-10 max-w-md mx-auto">
        Join K-culture fans worldwide — it&apos;s free to get started.
      </p>
      {ready && (
        <Link
          href={isLoggedIn ? "/calendar" : "/signup"}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-base font-semibold transition-all hover:opacity-90 hover:shadow-lg"
          style={{ backgroundColor: "white", color: "#FF4B6E" }}
        >
          Get Started Free
        </Link>
      )}
    </section>
  )
}
