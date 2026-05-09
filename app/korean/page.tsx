"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import { Volume2, Check, RotateCcw, Lock } from "lucide-react"
import Link from "next/link"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { hasProAccess } from "@/lib/auth/plan"

const dramaPacks = [
  { title: "Crash Landing on You", phrases: 24, difficulty: "Beginner", progress: 75 },
  { title: "Goblin", phrases: 32, difficulty: "Intermediate", progress: 45 },
  { title: "Itaewon Class", phrases: 28, difficulty: "Beginner", progress: 20 },
  { title: "My Love from the Star", phrases: 36, difficulty: "Intermediate", progress: 0 },
  { title: "Reply 1988", phrases: 40, difficulty: "Intermediate", progress: 10 },
]

const quizOptions = [
  { label: "A", text: "I love you" },
  { label: "B", text: "I missed you" },
  { label: "C", text: "Thank you" },
  { label: "D", text: "Goodbye" },
]

export default function HangeulGoPage() {
  const [selectedAnswer, setSelectedAnswer] = useState<string>("B")
  const [isPro, setIsPro] = useState(false)                         // monthly/annual/admin 통합 판별

  // 마운트 시 plan 권한 확인 — Pro 잠금 가드용
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase
        .from("users")
        .select("plan_type, is_admin")
        .eq("id", user.id)
        .single()
      const row = profile as { plan_type?: string; is_admin?: boolean } | null
      setIsPro(hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin }))
    })
  }, [])

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0d0d0f" }}>
      <Header />
      
      <main className="max-w-[1320px] mx-auto px-5 py-12">
        {/* Page Header */}
        <section className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">HangeulGo</h1>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-[#1a1a1a] border border-border/30">
              <span className="mr-1">🔥</span> 23 day streak
            </span>
          </div>
          <p className="text-muted-foreground text-lg">
            Learn Korean through K-drama lines you already love
          </p>
        </section>

        {/* Today's Lesson Card */}
        <section className="mb-16">
          <div className="max-w-[640px] mx-auto bg-[#1a1a1a] border border-border/30 rounded-2xl p-8">
            {/* Drama Tag */}
            <div className="flex justify-center mb-6">
              <span 
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: "rgba(255, 75, 110, 0.15)", color: "#FF4B6E" }}
              >
                Crash Landing on You
              </span>
            </div>

            {/* Korean Phrase */}
            <div className="text-center mb-6">
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-3">
                보고 싶었어
              </h2>
              <p className="text-muted-foreground text-lg mb-1">Bogo sipeosseo</p>
              <p className="text-foreground text-xl">"I missed you"</p>
            </div>

            {/* Play Button */}
            <div className="flex justify-center mb-8">
              <Button
                className="rounded-full px-6 py-3 font-medium text-white flex items-center gap-2"
                style={{ backgroundColor: "#FF4B6E" }}
              >
                <Volume2 className="w-5 h-5" />
                Play pronunciation
              </Button>
            </div>

            {/* Word Breakdown */}
            <div className="bg-[#141416] rounded-xl p-4 mb-8">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Word Breakdown</p>
              <div className="flex justify-center gap-6 text-sm">
                <div className="text-center">
                  <span className="text-foreground font-medium">보고</span>
                  <span className="text-muted-foreground ml-1">(bogo)</span>
                  <span className="text-muted-foreground"> = to see</span>
                </div>
                <div className="text-muted-foreground">|</div>
                <div className="text-center">
                  <span className="text-foreground font-medium">싶었어</span>
                  <span className="text-muted-foreground ml-1">(sipeosseo)</span>
                  <span className="text-muted-foreground"> = wanted</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Link href="/korean/lesson" className="flex-1">
                <Button
                  className="w-full rounded-xl py-3 font-medium text-white flex items-center justify-center gap-2"
                  style={{ backgroundColor: "#FF4B6E" }}
                >
                  <Check className="w-4 h-4" />
                  Got it
                </Button>
              </Link>
              <Link href="/korean/lesson" className="flex-1">
                <Button
                  variant="outline"
                  className="w-full rounded-xl py-3 font-medium border-border/50 hover:bg-secondary/50 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Review again
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Drama Learning Packs */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-6">Drama Learning Packs</h2>
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-5 px-5 scrollbar-hide">
            {dramaPacks.map((pack) => (
              <Link
                key={pack.title}
                href={`/korean/pack/${pack.title.toLowerCase().replace(/\s+/g, '-')}`}
                className="flex-shrink-0 w-[240px] bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/50 transition-colors cursor-pointer"
              >
                {/* Thumbnail Placeholder */}
                <div 
                  className="w-full h-32 flex items-center justify-center"
                  style={{ backgroundColor: "#252528" }}
                >
                  <span className="text-muted-foreground text-sm">Drama Thumbnail</span>
                </div>
                
                {/* Content */}
                <div className="p-4">
                  <h3 className="text-foreground font-medium mb-1 truncate">{pack.title}</h3>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-muted-foreground text-sm">{pack.phrases} phrases</span>
                    <span 
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ 
                        backgroundColor: pack.difficulty === "Beginner" ? "rgba(74, 222, 128, 0.15)" : "rgba(251, 191, 36, 0.15)",
                        color: pack.difficulty === "Beginner" ? "#4ade80" : "#fbbf24"
                      }}
                    >
                      {pack.difficulty}
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full h-1.5 bg-[#252528] rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pack.progress}%`, backgroundColor: "#FF4B6E" }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{pack.progress}% completed</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Quiz Mode Card */}
        <section className="mb-16">
          <div className="max-w-[640px] mx-auto bg-[#1a1a1a] border border-border/30 rounded-2xl p-8">
            <h2 className="text-xl font-semibold text-foreground mb-6 text-center">Quiz Mode</h2>
            
            {/* Question */}
            <p className="text-foreground text-lg text-center mb-6">
              What does <span className="font-semibold">'보고 싶어'</span> mean?
            </p>

            {/* Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quizOptions.map((option) => (
                <button
                  key={option.label}
                  onClick={() => setSelectedAnswer(option.label)}
                  className={`p-4 rounded-xl text-left transition-all flex items-center gap-3 ${
                    selectedAnswer === option.label
                      ? "border-2"
                      : "bg-[#252528] border-2 border-transparent hover:border-border/50"
                  }`}
                  style={selectedAnswer === option.label ? { 
                    backgroundColor: "rgba(255, 75, 110, 0.15)", 
                    borderColor: "#FF4B6E" 
                  } : {}}
                >
                  <span 
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium ${
                      selectedAnswer === option.label ? "text-white" : "bg-[#1a1a1a] text-muted-foreground"
                    }`}
                    style={selectedAnswer === option.label ? { backgroundColor: "#FF4B6E" } : {}}
                  >
                    {option.label}
                  </span>
                  <span className={selectedAnswer === option.label ? "text-foreground font-medium" : "text-foreground"}>
                    {option.text}
                  </span>
                </button>
              ))}
            </div>

            {/* Submit Button */}
            <Button
              className="w-full mt-6 rounded-xl py-3 font-medium text-white"
              style={{ backgroundColor: "#FF4B6E" }}
            >
              Check Answer
            </Button>
          </div>
        </section>

        {/* AI Grammar Explanation (Pro) - Blurred */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-6 flex items-center gap-2">
            AI Grammar Explanation
            <span 
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: "rgba(255, 75, 110, 0.15)", color: "#FF4B6E" }}
            >
              Pro
            </span>
          </h2>
          
          <div className="relative">
            {/* Blurred Content — isPro 면 블러 해제 */}
            <div className={`bg-[#1a1a1a] border border-border/30 rounded-2xl p-8 ${isPro ? "" : "blur-[6px] pointer-events-none"}`}>
              <div className="space-y-4">
                <div className="h-6 bg-[#252528] rounded w-3/4" />
                <div className="h-4 bg-[#252528] rounded w-full" />
                <div className="h-4 bg-[#252528] rounded w-5/6" />
                <div className="h-4 bg-[#252528] rounded w-full" />
                <div className="mt-6 p-4 bg-[#141416] rounded-xl">
                  <div className="h-4 bg-[#252528] rounded w-1/2 mb-2" />
                  <div className="h-3 bg-[#252528] rounded w-full" />
                  <div className="h-3 bg-[#252528] rounded w-4/5 mt-1" />
                </div>
              </div>
            </div>

            {/* Upgrade Overlay — isPro 면 미노출 */}
            {!isPro && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-[#1a1a1a] border border-border/50 rounded-xl p-6 text-center shadow-xl">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
                  >
                    <Lock className="w-6 h-6" style={{ color: "#FF4B6E" }} />
                  </div>
                  <p className="text-foreground font-medium mb-4">
                    Unlock AI Grammar Explanations
                  </p>
                  <Link href="/signup">
                    <Button
                      className="px-6 py-2 rounded-full font-medium text-white"
                      style={{ backgroundColor: "#FF4B6E" }}
                    >
                      Upgrade to Hallyu Pass
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <FooterSection />
    </div>
  )
}
