"use client"

// /mypage/learning-progress — "Got it" 클릭한 한국어 표현 목록
// 데이터: /api/mypage/learning-progress (user_learning_progress status=mastered)
// 카드 클릭 → /korean (HangeulGo 페이지)

import { useEffect, useState } from "react"
import Link from "next/link"
import { Languages, ChevronRight, Trash2 } from "lucide-react"
import { MypageShell } from "@/components/mypage/mypage-shell"

interface LearnedPhrase {
  phrase_id: string
  korean: string
  romanization: string | null
  english: string
  difficulty: string | null
  drama_name: string | null
  last_studied_at: string
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-green-500/20 text-green-400",
  intermediate: "bg-yellow-500/20 text-yellow-400",
  advanced: "bg-red-500/20 text-red-400",
}

export default function LearningProgressPage() {
  return (
    <MypageShell activeLabel="Learning Progress">
      <LearningProgressBody />
    </MypageShell>
  )
}

function LearningProgressBody() {
  const [items, setItems] = useState<LearnedPhrase[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/mypage/learning-progress", { cache: "no-store" })
      .then(async (res) => {
        const json = res.ok ? (await res.json().catch(() => ({}))) as { phrases?: LearnedPhrase[] } : {}
        if (!cancelled) setItems(json.phrases ?? [])
      })
      .catch(() => { if (!cancelled) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function handleDelete(phraseId: string) {
    setItems((prev) => prev.filter((p) => p.phrase_id !== phraseId))
    const res = await fetch("/api/korean/learning-progress", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phraseId }),
    })
    if (!res.ok) {
      fetch("/api/mypage/learning-progress", { cache: "no-store" })
        .then(async (r) => {
          const j = r.ok ? (await r.json().catch(() => ({}))) as { phrases?: LearnedPhrase[] } : {}
          setItems(j.phrases ?? [])
        })
        .catch(() => {})
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Learning Progress</h1>
          <p className="text-muted-foreground text-sm">
            Korean expressions you&apos;ve mastered in HangeulGo.
          </p>
        </div>
        <Link
          href="/korean"
          className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium px-4 h-10 rounded-full text-white whitespace-nowrap flex-shrink-0"
          style={{ backgroundColor: "#FF4B6E" }}
        >
          Open HangeulGo
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {loading ? (
        <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-10 text-center text-muted-foreground text-sm">
          Loading...
        </div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">{items.length} expression{items.length !== 1 ? "s" : ""} mastered</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((phrase) => {
              const diffColor = DIFFICULTY_COLORS[phrase.difficulty ?? ""] ?? "bg-[#252525] text-muted-foreground"
              return (
                <div key={phrase.phrase_id} className="relative group">
                  <Link
                    href={`/korean?phrase_id=${phrase.phrase_id}`}
                    className="bg-[#1a1a1a] border border-border/30 rounded-xl p-4 pr-10 hover:border-primary/50 transition-colors block"
                  >
                    <p className="text-xl font-bold text-foreground mb-1">{phrase.korean}</p>
                    {phrase.romanization && (
                      <p className="text-sm text-muted-foreground mb-1 italic">{phrase.romanization}</p>
                    )}
                    <p className="text-sm text-foreground mb-3">{phrase.english}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {phrase.difficulty && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${diffColor}`}>
                          {phrase.difficulty.charAt(0).toUpperCase() + phrase.difficulty.slice(1)}
                        </span>
                      )}
                      {phrase.drama_name && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#252525] text-muted-foreground truncate max-w-[160px]">
                          {phrase.drama_name}
                        </span>
                      )}
                    </div>
                  </Link>
                  <button
                    onClick={() => handleDelete(phrase.phrase_id)}
                    className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground opacity-40 group-hover:opacity-100 hover:text-red-400 hover:bg-red-400/10 transition-all"
                    aria-label="Remove expression"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="sm:hidden mt-8">
        <Link
          href="/korean"
          className="inline-flex items-center gap-1.5 text-sm font-medium px-4 h-10 rounded-full text-white"
          style={{ backgroundColor: "#FF4B6E" }}
        >
          Open HangeulGo
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl px-6 py-12 text-center">
      <Languages className="w-10 h-10 mx-auto mb-3" style={{ color: "#FF4B6E" }} />
      <p className="text-foreground font-medium mb-1">No expressions mastered yet</p>
      <p className="text-muted-foreground text-sm mb-5 max-w-md mx-auto">
        Click &quot;Got it&quot; in HangeulGo after learning a phrase to track your progress here.
      </p>
      <Link
        href="/korean"
        className="inline-flex items-center gap-1.5 text-sm font-medium px-5 h-10 rounded-full text-white"
        style={{ backgroundColor: "#FF4B6E" }}
      >
        Open HangeulGo
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
