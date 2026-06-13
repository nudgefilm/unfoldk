"use client"

import Link from "next/link"
import { Volume2 } from "lucide-react"

export interface PhraseData {
  id: string
  korean: string
  romanization: string | null
  english: string
  drama_name: string
}

function speakKorean(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = "ko-KR"
  utt.rate = 0.85
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utt)
}

export function HomePhraseCard({ phrase }: { phrase: PhraseData }) {
  return (
    <section className="px-5">
      <div className="max-w-2xl mx-auto rounded-2xl bg-[#141418] border border-border/30 p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest mb-6" style={{ color: "#FF4B6E" }}>
          Today&apos;s K-drama Expression
        </p>
        <div className="flex items-center justify-center gap-3 mb-2">
          <p className="text-3xl md:text-4xl font-bold text-foreground">{phrase.korean}</p>
          <button
            type="button"
            onClick={() => speakKorean(phrase.korean)}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full border border-border/40 text-muted-foreground hover:text-foreground hover:border-border/70 transition-colors"
            aria-label="Play pronunciation"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>
        {phrase.romanization && (
          <p className="text-muted-foreground text-base mb-3">{phrase.romanization}</p>
        )}
        <p className="text-foreground text-lg font-medium mb-4">{phrase.english}</p>
        <p className="text-xs text-muted-foreground/60 mb-6">From: {phrase.drama_name}</p>
        <Link
          href="/korean"
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ color: "#FF4B6E" }}
        >
          Learn more expressions →
        </Link>
      </div>
    </section>
  )
}
