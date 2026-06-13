"use client"

import Link from "next/link"
import { Play } from "lucide-react"

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
      <div
        className="relative mx-auto rounded-2xl p-10 md:p-14 text-center overflow-hidden border border-[#FF4B6E]/20"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,75,110,0.10) 0%, rgba(255,75,110,0.03) 50%, rgba(255,75,110,0.08) 100%)",
        }}
      >
        {/* 장식 따옴표 */}
        <span
          className="absolute left-6 top-5 text-7xl leading-none select-none font-serif pointer-events-none"
          style={{ color: "rgba(255,75,110,0.12)" }}
          aria-hidden
        >
          &ldquo;
        </span>
        <span
          className="absolute right-6 bottom-5 text-7xl leading-none select-none font-serif pointer-events-none rotate-180"
          style={{ color: "rgba(255,75,110,0.12)" }}
          aria-hidden
        >
          &ldquo;
        </span>

        {/* 라벨 */}
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-7 relative z-10"
          style={{ color: "#FF4B6E" }}
        >
          Today&apos;s K-drama Expression
        </p>

        {/* 한국어 + TTS */}
        <div className="flex items-center justify-center gap-3 mb-2 relative z-10">
          <p className="text-3xl md:text-4xl font-bold text-foreground">{phrase.korean}</p>
          <button
            type="button"
            onClick={() => speakKorean(phrase.korean)}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full border border-[#FF4B6E]/30 hover:bg-[#FF4B6E]/10 transition-colors"
            style={{ color: "#FF4B6E" }}
            aria-label="Play pronunciation"
          >
            <Play className="w-4 h-4 fill-current" />
          </button>
        </div>

        {/* 로마자 발음 */}
        {phrase.romanization && (
          <p className="text-muted-foreground text-base mb-4 relative z-10">{phrase.romanization}</p>
        )}

        {/* 영문 뜻 */}
        <p className="text-foreground text-lg font-medium mb-5 relative z-10">{phrase.english}</p>

        {/* 드라마 배지 */}
        <div className="flex items-center justify-center mb-7 relative z-10">
          <span
            className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium"
            style={{
              backgroundColor: "rgba(255,75,110,0.10)",
              color: "#FF4B6E",
            }}
          >
            From: {phrase.drama_name}
          </span>
        </div>

        {/* 링크 */}
        <Link
          href="/korean"
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80 relative z-10"
          style={{ color: "#FF4B6E" }}
        >
          Learn more expressions →
        </Link>
      </div>
    </section>
  )
}
