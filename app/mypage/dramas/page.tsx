"use client"

// /mypage/dramas — KdramaMatch Coming Soon
// M+2 로드맵. 출시 후 본인 시청 목록·watchlist 분기 추가.

import Link from "next/link"
import { Film } from "lucide-react"
import { MypageShell } from "@/components/mypage/mypage-shell"

export default function MyDramasPage() {
  return (
    <MypageShell activeLabel="My Dramas">
      <ComingSoonPanel
        icon={<Film className="w-12 h-12" style={{ color: "#FF4B6E" }} />}
        title="My Dramas"
        subtitle="KdramaMatch is launching soon."
        description="Save your watchlist, track episodes, and get AI-powered recommendations based on your taste."
        previewHref="/drama"
        previewLabel="Preview KdramaMatch"
      />
    </MypageShell>
  )
}

function ComingSoonPanel({
  icon,
  title,
  subtitle,
  description,
  previewHref,
  previewLabel,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  description: string
  previewHref: string
  previewLabel: string
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">{title}</h1>
      <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-16 text-center">
        <div className="flex justify-center mb-4">{icon}</div>
        <p className="text-foreground font-semibold text-lg mb-2">{subtitle}</p>
        <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6 leading-relaxed">
          {description}
        </p>
        <Link
          href={previewHref}
          className="inline-block text-sm font-medium hover:underline"
          style={{ color: "#FF4B6E" }}
        >
          {previewLabel} →
        </Link>
      </div>
    </div>
  )
}
