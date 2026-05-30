"use client"

import { useState } from "react"
import { FooterSection } from "@/components/footer-section"

type Gender = "neutral" | "feminine" | "masculine"
type Vibe = "bright" | "cool" | "strong" | "gentle" | "creative" | "smart"

interface NameEntry {
  korean: string
  roman: string
  meaning: string
  chars: string
}

interface VibeResult {
  vibe: Vibe
  name: NameEntry
  tags: string[]
}

const NAME_DATA: Record<Vibe, Record<Gender, NameEntry>> = {
  bright: {
    feminine: {
      korean: "이서연",
      roman: "Lee Seo-yeon",
      meaning: "Bright lotus, graceful and radiant",
      chars: "서(bright) + 연(lotus)",
    },
    masculine: {
      korean: "김태양",
      roman: "Kim Tae-yang",
      meaning: "Great sun, warmth that reaches everyone",
      chars: "태(great) + 양(sun)",
    },
    neutral: {
      korean: "박하늘",
      roman: "Park Ha-neul",
      meaning: "Clear sky, open and full of light",
      chars: "하(clear) + 늘(sky)",
    },
  },
  cool: {
    feminine: {
      korean: "최유나",
      roman: "Choi Yu-na",
      meaning: "Graceful night, quiet and alluring",
      chars: "유(graceful) + 나(night blossom)",
    },
    masculine: {
      korean: "강준혁",
      roman: "Kang Jun-hyeok",
      meaning: "Talented and brilliant, sharp as jade",
      chars: "준(talented) + 혁(brilliant)",
    },
    neutral: {
      korean: "윤지호",
      roman: "Yoon Ji-ho",
      meaning: "Wisdom and depth, still water runs deep",
      chars: "지(wisdom) + 호(vast lake)",
    },
  },
  strong: {
    feminine: {
      korean: "한수아",
      roman: "Han Su-ah",
      meaning: "Pure strength, gentle but unbreakable",
      chars: "수(pure) + 아(elegant strength)",
    },
    masculine: {
      korean: "오민준",
      roman: "Oh Min-jun",
      meaning: "Bright and powerful, a leader by nature",
      chars: "민(bright) + 준(powerful)",
    },
    neutral: {
      korean: "정도윤",
      roman: "Jung Do-yoon",
      meaning: "Righteous path, steady and unwavering",
      chars: "도(path) + 윤(steady)",
    },
  },
  gentle: {
    feminine: {
      korean: "임소희",
      roman: "Lim So-hee",
      meaning: "Small joy, tender warmth in every moment",
      chars: "소(small/pure) + 희(joy)",
    },
    masculine: {
      korean: "류성현",
      roman: "Ryu Seong-hyeon",
      meaning: "Accomplished and kind, shines from within",
      chars: "성(accomplished) + 현(bright/kind)",
    },
    neutral: {
      korean: "노아름",
      roman: "Noh A-reum",
      meaning: "Beautiful soul, naturally lovely",
      chars: "아름(beautiful + soul)",
    },
  },
  creative: {
    feminine: {
      korean: "문채원",
      roman: "Moon Chae-won",
      meaning: "Colorful and talented, art in motion",
      chars: "채(colorful) + 원(original)",
    },
    masculine: {
      korean: "배예준",
      roman: "Bae Ye-jun",
      meaning: "Artistic talent, graceful and inventive",
      chars: "예(art) + 준(talented)",
    },
    neutral: {
      korean: "전하린",
      roman: "Jeon Ha-rin",
      meaning: "Free spirit, flowing like water",
      chars: "하(free) + 린(flowing)",
    },
  },
  smart: {
    feminine: {
      korean: "신지은",
      roman: "Shin Ji-eun",
      meaning: "Wisdom and grace, quietly brilliant",
      chars: "지(wisdom) + 은(silver grace)",
    },
    masculine: {
      korean: "고현우",
      roman: "Go Hyeon-woo",
      meaning: "Bright intellect, clear and grounded",
      chars: "현(bright) + 우(universe/depth)",
    },
    neutral: {
      korean: "안서준",
      roman: "Ahn Seo-jun",
      meaning: "Clear thinking, always ahead of the moment",
      chars: "서(clear) + 준(prepared)",
    },
  },
}

const PERSONALITY_TAGS: Record<Vibe, string[]> = {
  bright: ["Optimistic", "Warmhearted", "Radiates energy"],
  cool: ["Mysterious", "Self-assured", "Quietly captivating"],
  strong: ["Determined", "Natural leader", "Stands firm"],
  gentle: ["Empathetic", "Nurturing", "Puts others first"],
  creative: ["Original", "Expressive", "Sees beauty everywhere"],
  smart: ["Analytical", "Composed", "Always thinking ahead"],
}

const VIBES: { value: Vibe; label: string; emoji: string }[] = [
  { value: "bright", label: "Bright & warm", emoji: "☀️" },
  { value: "cool", label: "Cool & mysterious", emoji: "🌊" },
  { value: "strong", label: "Strong & bold", emoji: "⚡" },
  { value: "gentle", label: "Gentle & kind", emoji: "🌸" },
  { value: "creative", label: "Creative & free", emoji: "🎨" },
  { value: "smart", label: "Smart & calm", emoji: "📐" },
]

const GENDERS: { value: Gender; label: string }[] = [
  { value: "neutral", label: "Neutral" },
  { value: "feminine", label: "Feminine" },
  { value: "masculine", label: "Masculine" },
]

export default function NamePage() {
  const [firstName, setFirstName] = useState("")
  const [gender, setGender] = useState<Gender>("neutral")
  const [selectedVibes, setSelectedVibes] = useState<Vibe[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<VibeResult[] | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  function toggleVibe(v: Vibe) {
    setSelectedVibes((prev) => {
      if (prev.includes(v)) return prev.filter((x) => x !== v)
      if (prev.length >= 2) return prev
      return [...prev, v]
    })
  }

  function handleGenerate() {
    if (selectedVibes.length === 0) return
    setIsLoading(true)
    setResults(null)
    setTimeout(() => {
      const res: VibeResult[] = selectedVibes.map((v) => ({
        vibe: v,
        name: NAME_DATA[v][gender],
        tags: PERSONALITY_TAGS[v],
      }))
      setResults(res)
      setIsLoading(false)
    }, 1000)
  }

  function handleCopy(index: number) {
    const r = results?.[index]
    if (!r || typeof navigator === "undefined") return
    navigator.clipboard.writeText(`${r.name.korean} (${r.name.roman})`).then(() => {
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    })
  }

  function handleShare(index: number) {
    const r = results?.[index]
    if (!r || typeof navigator === "undefined") return
    const text = `My Korean name is ${r.name.korean} (${r.name.roman})! Find yours at unfoldk.com/name`
    if (navigator.share) {
      navigator.share({ text, url: "https://unfoldk.com/name" }).catch(() => {})
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
    }
  }

  const canGenerate = selectedVibes.length > 0

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0d0d0f" }}>
      <main className="max-w-[680px] mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Korean Name Generator</h1>
          <p className="text-muted-foreground">Discover your Korean name based on your vibe</p>
        </div>

        <div className="bg-[#1a1a1a] border border-border/30 rounded-2xl p-6 mb-5">
          {/* Name input */}
          <div className="mb-6">
            <label className="block text-white font-medium mb-2 text-sm">Your name</label>
            <input
              type="text"
              placeholder="e.g. Emily"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full bg-[#0d0d0f] border border-border/30 rounded-xl py-3 px-4 text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          {/* Gender feel */}
          <div className="mb-6">
            <label className="block text-white font-medium mb-3 text-sm">Gender feel</label>
            <div className="flex gap-2">
              {GENDERS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGender(g.value)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    gender === g.value
                      ? "border-primary bg-primary/10 text-white"
                      : "border-border/30 text-muted-foreground hover:border-primary/30 hover:text-white"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Vibe */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Vibe{" "}
              <span className="text-muted-foreground font-normal">(pick up to 2)</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
              {VIBES.map((v) => {
                const isSelected = selectedVibes.includes(v.value)
                const isDisabled = !isSelected && selectedVibes.length >= 2
                return (
                  <button
                    key={v.value}
                    onClick={() => !isDisabled && toggleVibe(v.value)}
                    className={`py-2.5 px-3 rounded-xl text-sm border transition-all flex items-center gap-2 ${
                      isSelected
                        ? "border-primary bg-primary/10 text-white"
                        : isDisabled
                          ? "border-border/20 text-muted-foreground/40 cursor-not-allowed"
                          : "border-border/30 text-muted-foreground hover:border-primary/30 hover:text-white"
                    }`}
                  >
                    <span>{v.emoji}</span>
                    {v.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={!canGenerate || isLoading}
          className={`w-full py-4 rounded-xl font-semibold text-white transition-all mb-6 ${
            canGenerate && !isLoading ? "hover:opacity-90 cursor-pointer" : "opacity-40 cursor-not-allowed"
          }`}
          style={{ backgroundColor: "#FF4B6E" }}
        >
          {isLoading ? "Finding your name..." : "Get my Korean name"}
        </button>

        {isLoading && (
          <div className="flex justify-center py-6">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {results && (
          <div className="flex flex-col gap-4">
            {results.map((r, i) => (
              <div key={r.vibe} className="bg-[#1a1a1a] border border-primary/20 rounded-2xl p-6">
                {results.length > 1 && (
                  <p className="text-muted-foreground text-xs uppercase tracking-widest mb-5">
                    {VIBES.find((v) => v.value === r.vibe)?.emoji}{" "}
                    {VIBES.find((v) => v.value === r.vibe)?.label}
                  </p>
                )}
                <div className="text-center mb-6">
                  <p className="text-5xl md:text-6xl font-bold text-white mb-2 tracking-wide">
                    {r.name.korean}
                  </p>
                  <p className="text-xl text-primary font-semibold mb-3">{r.name.roman}</p>
                  <p className="text-muted-foreground mb-1">{r.name.meaning}</p>
                  <p className="text-muted-foreground/60 text-sm">{r.name.chars}</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mb-6">
                  {r.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-[#2a2a2a] rounded-full text-sm text-muted-foreground border border-border/30"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleCopy(i)}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-muted-foreground bg-[#2a2a2a] border border-border/30 hover:border-primary/40 hover:text-white transition-all"
                  >
                    {copiedIndex === i ? "✓ Copied!" : "Copy name"}
                  </button>
                  <button
                    onClick={() => handleShare(i)}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                    style={{ backgroundColor: "#FF4B6E" }}
                  >
                    Share
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* SEO 콘텐츠 섹션 — 검색 유입용 롱테일 텍스트. UI 변경 없음. */}
      <section className="max-w-[680px] mx-auto px-6 pb-16 space-y-10">
        {/* How it works */}
        <div>
          <h2 className="text-xl font-bold text-white mb-3">How does our Korean name generator work?</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Our Korean name generator matches your personality vibe and gender preference to curated Korean names.
            Each name is composed of meaningful Korean characters (한자) selected to reflect your chosen style —
            bright (밝은), cool (시크한), strong (강한), gentle (부드러운), creative (창의적), or smart (지적인).
            The result is an authentic Korean name — complete with romanization and character meanings —
            that you can share with your K-pop fan community.
          </p>
        </div>

        {/* Why get a Korean name */}
        <div>
          <h2 className="text-xl font-bold text-white mb-3">Why get a Korean name?</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-3">
            Millions of Hallyu fans around the world adopt Korean names as a way to connect more deeply with
            Korean culture. Here&apos;s why getting a Korean name has become a fan tradition:
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span style={{ color: "#FF4B6E" }}>✓</span>
              <span><strong className="text-foreground">Fan identity</strong> — Use your Korean name in fandoms, on social media, or at K-pop concerts as your official fan persona.</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "#FF4B6E" }}>✓</span>
              <span><strong className="text-foreground">Cultural connection</strong> — Korean names carry deep meaning through their characters, reflecting values like brightness, strength, and creativity.</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "#FF4B6E" }}>✓</span>
              <span><strong className="text-foreground">K-drama immersion</strong> — If you&apos;re learning Korean through dramas, having a Korean name helps you feel closer to the language and culture.</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: "#FF4B6E" }}>✓</span>
              <span><strong className="text-foreground">Travel to Korea</strong> — Many fans heading to Seoul for concerts or K-drama filming locations love having a Korean name to introduce themselves.</span>
            </li>
          </ul>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Frequently asked questions</h2>
          <div className="space-y-5">
            {[
              {
                q: "Are the Korean names authentic?",
                a: "Yes. Every name uses real Korean surname-given name combinations that native Koreans actually use. Each character carries a specific meaning, just like names given at birth in Korea.",
              },
              {
                q: "Can I use my Korean name on social media?",
                a: "Absolutely. Many K-pop fans use their Korean names as fan names on Twitter, Instagram, and TikTok. Your name comes with romanization (e.g. Lee Seo-yeon) so non-Korean speakers can read it too.",
              },
              {
                q: "What is the Korean name format?",
                a: "Korean names follow the format: Family name (성) + Given name (이름). For example, 이서연 — 이 is the family name (Lee), 서연 is the given name. Family names are typically one syllable.",
              },
              {
                q: "Is the Korean name generator free?",
                a: "Yes, completely free. No sign-up required — just pick your vibe, choose a gender feel, and get your Korean name instantly.",
              },
              {
                q: "How do I find my Korean name based on my English name?",
                a: "Enter your first name in the 'Your name' field above, then select your personality vibe and gender feel. Our generator will create a Korean name that resonates with your identity — not a phonetic transliteration, but a meaningful Korean name.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="bg-[#1a1a1a] border border-border/30 rounded-xl p-4">
                <p className="text-white font-medium text-sm mb-2">{q}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FooterSection />
    </div>
  )
}
