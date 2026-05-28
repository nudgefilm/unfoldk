"use client"

// 히어로 섹션 CTA 버튼 — Start 모달 단일화
// hero-section.tsx 는 SVG 가 무거워 서버 컴포넌트로 유지하고, 모달 트리거가 필요한
// 버튼만 분리 (StartModal 이 useState 를 쓰므로 클라이언트 경계 필요).

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { StartModal } from "@/components/start-modal"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

export function HeroCTAButtons() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3 mb-10 md:mb-12 lg:mb-14">
      {isLoggedIn ? (
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-press px-8 py-3 rounded-full font-medium text-base shadow-lg"
          onClick={() => router.push("/mypage")}
        >
          Go to my dashboard
        </Button>
      ) : (
        <StartModal
          trigger={
            <Button className="bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-press px-8 py-3 rounded-full font-medium text-base shadow-lg">
              Start Your Routine Free
            </Button>
          }
        />
      )}
      <Link href="/#features">
        <Button variant="outline" className="px-8 py-3 rounded-full font-medium text-base border-border/50 hover:bg-secondary/50">
          See how it works
        </Button>
      </Link>
    </div>
  )
}
