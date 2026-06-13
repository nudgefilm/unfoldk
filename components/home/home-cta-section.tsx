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
    <section className="py-20 px-5 text-center">
      <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
        Start Your Hallyu Journey
      </h2>
      <p className="text-muted-foreground text-lg mb-10 max-w-md mx-auto">
        Join K-culture fans worldwide — it&apos;s free to get started.
      </p>
      {ready && (
        <Link
          href={isLoggedIn ? "/calendar" : "/signup"}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-white text-base font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#FF4B6E" }}
        >
          Get Started Free
        </Link>
      )}
    </section>
  )
}
