"use client"

// /mypage/recipes — KfoodKit Coming Soon
// M+4 로드맵. Spoonacular 연동 후 저장 레시피·장보기 리스트 분기 추가.

import Link from "next/link"
import { UtensilsCrossed } from "lucide-react"
import { MypageShell } from "@/components/mypage/mypage-shell"

export default function MyRecipesPage() {
  return (
    <MypageShell activeLabel="Saved Recipes">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-6">Saved Recipes</h1>
        <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-16 text-center">
          <div className="flex justify-center mb-4">
            <UtensilsCrossed className="w-12 h-12" style={{ color: "#FF4B6E" }} />
          </div>
          <p className="text-foreground font-semibold text-lg mb-2">
            KfoodKit is launching soon.
          </p>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6 leading-relaxed">
            Save Korean recipes inspired by your favorite dramas and idols. Build a personalized
            shopping list and step-by-step cooking guides.
          </p>
          <Link
            href="/food"
            className="inline-block text-sm font-medium hover:underline"
            style={{ color: "#FF4B6E" }}
          >
            Preview KfoodKit →
          </Link>
        </div>
      </div>
    </MypageShell>
  )
}
