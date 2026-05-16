"use client"

import { useEffect, useState } from "react"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Trophy, ChevronRight, Lock, Bot } from "lucide-react"
import Link from "next/link"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { hasProAccess } from "@/lib/auth/plan"

const foodCards = [
  { drama: "Squid Game", dish: "Dalgona", difficulty: "Easy", image: "/placeholder-food.jpg" },
  { drama: "Crash Landing on You", dish: "Army Stew", difficulty: "Medium", image: "/placeholder-food.jpg" },
  { drama: "Parasite", dish: "Ram-don", difficulty: "Easy", image: "/placeholder-food.jpg" },
  { drama: "Itaewon Class", dish: "Kimchi Jjigae", difficulty: "Medium", image: "/placeholder-food.jpg" },
  { drama: "My Love from the Star", dish: "Chimaek", difficulty: "Easy", image: "/placeholder-food.jpg" },
  { drama: "Goblin", dish: "Tteokbokki", difficulty: "Hard", image: "/placeholder-food.jpg" },
]

const difficultyColors: Record<string, string> = {
  Easy: "bg-green-500/20 text-green-400",
  Medium: "bg-yellow-500/20 text-yellow-400",
  Hard: "bg-red-500/20 text-red-400",
}

export default function KfoodKitPage() {
  const [searchQuery, setSearchQuery] = useState("")
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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0d0d0f" }}>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {/* Page Header */}
        <section className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">KfoodKit</h1>
          <p className="text-muted-foreground text-lg mb-8">
            Cook your favorite K-drama dishes, anywhere in the world
          </p>
          
          {/* Search Bar */}
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by drama or dish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 py-6 bg-[#1a1a1a] border-border/30 rounded-xl text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </section>

        {/* Weekly Challenge Banner */}
        <section className="mb-12">
          <div 
            className="bg-[#1a1a1a] rounded-xl p-6 border-l-4"
            style={{ borderLeftColor: "#FF4B6E" }}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
                >
                  <Trophy className="w-6 h-6" style={{ color: "#FF4B6E" }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">
                    This Week&apos;s Challenge: Make Japchae
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    From Itaewon Class · Difficulty: Intermediate
                  </p>
                  <p className="text-muted-foreground text-xs mt-2">
                    1,240 fans joined
                  </p>
                </div>
              </div>
              <Link href="/food/challenge">
                <Button 
                  className="rounded-full font-medium text-white whitespace-nowrap"
                  style={{ backgroundColor: "#FF4B6E" }}
                >
                  Start Challenge
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Drama Food Cards Grid */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-6">Popular K-Drama Recipes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {foodCards.map((card, index) => (
              <div 
                key={index}
                className="bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/50 transition-colors"
              >
                {/* Image Placeholder */}
                <div className="h-40 bg-[#252525] flex items-center justify-center">
                  <span className="text-muted-foreground text-4xl">🍜</span>
                </div>
                
                {/* Content */}
                <div className="p-4">
                  {/* Drama Tag */}
                  <span className="inline-block px-2 py-1 rounded-full text-xs bg-[#252525] text-muted-foreground mb-2">
                    {card.drama}
                  </span>
                  
                  {/* Dish Name */}
                  <h3 className="text-lg font-bold text-white mb-3">{card.dish}</h3>
                  
                  {/* Difficulty Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${difficultyColors[card.difficulty]}`}>
                      {card.difficulty}
                    </span>
                    <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                      <Bot className="w-3 h-3" />
                      Get local substitutes
                    </Link>
                  </div>
                  
                  {/* View Recipe Link */}
                  <Link 
                    href={`/food/recipe/${card.dish.toLowerCase().replace(/\s+/g, '-')}`}
                    className="text-sm font-medium flex items-center gap-1 hover:underline"
                    style={{ color: "#FF4B6E" }}
                  >
                    View Recipe
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* AI Ingredient Substitution (Pro Feature) — isPro 면 블러·오버레이 해제 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-6">AI Ingredient Finder</h2>
          <div className="relative">
            <div className={`bg-[#1a1a1a] border border-border/30 rounded-xl p-6 ${isPro ? "" : "blur-[4px]"}`}>
              <div className="flex items-center gap-3 mb-6">
                <Bot className="w-6 h-6" style={{ color: "#FF4B6E" }} />
                <h3 className="text-lg font-semibold text-white">Local Ingredient Finder</h3>
              </div>

              {/* Country Selector */}
              <div className="mb-6">
                <label className="text-sm text-muted-foreground mb-2 block">Select your country</label>
                <select className="w-full md:w-64 bg-[#252525] border border-border/30 rounded-lg px-4 py-2 text-foreground">
                  <option>United States</option>
                  <option>United Kingdom</option>
                  <option>Germany</option>
                </select>
              </div>

              {/* Sample Output */}
              <div className="bg-[#252525] rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">You searched: Gochugaru</p>
                <p className="text-foreground">
                  Try: Korean chili flakes or Aleppo pepper (found at Whole Foods, Amazon)
                </p>
              </div>
            </div>

            {/* Upgrade Overlay */}
            {!isPro && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-[#1a1a1a] border border-border/50 rounded-xl p-6 text-center shadow-xl">
                  <Lock className="w-8 h-8 mx-auto mb-3" style={{ color: "#FF4B6E" }} />
                  <p className="text-white font-medium mb-2">Coming with Hallyu Pass</p>
                  <p className="text-muted-foreground text-xs mb-4">Available at launch.</p>
                  <Link href="/signup">
                    <Button
                      className="rounded-full font-medium text-white"
                      style={{ backgroundColor: "#FF4B6E" }}
                    >
                      Notify me at launch
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Shopping List (Pro Feature) — isPro 면 블러·오버레이 해제 */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-white mb-6">My Shopping List</h2>
          <div className="relative">
            <div className={`bg-[#1a1a1a] border border-border/30 rounded-xl p-6 ${isPro ? "" : "blur-[4px]"}`}>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-foreground">
                  <div className="w-5 h-5 rounded border border-border/50" />
                  <span>Gochugaru (Korean chili flakes) - 200g</span>
                </li>
                <li className="flex items-center gap-3 text-foreground">
                  <div className="w-5 h-5 rounded border border-border/50" />
                  <span>Gochujang (Korean chili paste) - 1 jar</span>
                </li>
                <li className="flex items-center gap-3 text-foreground">
                  <div className="w-5 h-5 rounded border border-border/50" />
                  <span>Doenjang (Korean soybean paste) - 1 jar</span>
                </li>
                <li className="flex items-center gap-3 text-foreground">
                  <div className="w-5 h-5 rounded border border-border/50" />
                  <span>Tteok (rice cakes) - 500g</span>
                </li>
                <li className="flex items-center gap-3 text-foreground">
                  <div className="w-5 h-5 rounded border border-border/50" />
                  <span>Kimchi - 1 pack</span>
                </li>
              </ul>
            </div>

            {/* Upgrade Overlay */}
            {!isPro && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-[#1a1a1a] border border-border/50 rounded-xl p-6 text-center shadow-xl">
                  <Lock className="w-8 h-8 mx-auto mb-3" style={{ color: "#FF4B6E" }} />
                  <p className="text-white font-medium mb-2">Coming with Hallyu Pass</p>
                  <p className="text-muted-foreground text-xs mb-4">Available at launch.</p>
                  <Link href="/signup">
                    <Button
                      className="rounded-full font-medium text-white"
                      style={{ backgroundColor: "#FF4B6E" }}
                    >
                      Notify me at launch
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
