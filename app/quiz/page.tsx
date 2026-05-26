"use client"

import { useState } from "react"
import { FooterSection } from "@/components/footer-section"

const QUESTIONS = [
  {
    q: "It's Friday night. What are you doing?",
    options: [
      "Binge-watching dramas alone with ramen",
      "Out with friends for chicken and beer",
      "Prepping for tomorrow ahead of time",
      "Spontaneously heading somewhere new",
    ],
  },
  {
    q: "You like someone. How do you act around them?",
    options: [
      "Keep it inside and suffer quietly",
      "Go straight for it — confess immediately",
      "Stay close by pretending to be just a friend",
      "Act cold, but actually care a lot",
    ],
  },
  {
    q: "A conflict breaks out in your group. Your move?",
    options: [
      "Try to smooth things over diplomatically",
      "Step in and confront it head-on",
      "Watch quietly and figure out who's right",
      "Disappear — conflict stresses you out",
    ],
  },
  {
    q: "What's your go-to K-drama genre?",
    options: [
      "Romance — slow burn is the best burn",
      "Thriller — plot twists keep me alive",
      "Coming-of-age — feelings hit different",
      "Fantasy / time travel — reality is overrated",
    ],
  },
  {
    q: "Your fashion vibe?",
    options: [
      "Clean, minimal, effortlessly cool",
      "Bright and expressive — I stand out",
      "Cozy and comfortable every day",
      "Different every time — mood-based dressing",
    ],
  },
  {
    q: "When things get hard, you tend to...",
    options: [
      "Push through alone without telling anyone",
      "Vent to a close friend right away",
      "Research and come up with a plan",
      "Take a solo trip to reset",
    ],
  },
  {
    q: "Which line sounds most like something you'd say?",
    options: [
      '"I\'m fine." (I\'m not fine.)',
      '"Just tell me straight — what\'s going on?"',
      '"I\'ll handle it. Don\'t worry about me."',
      '"Let\'s just go. Right now. Wherever."',
    ],
  },
]

const RESULTS = [
  {
    emoji: "🥋",
    type: "The Cold CEO",
    title: "Charismatic and untouchable",
    desc: "You seem cold on the outside, but you're fiercely loyal to the people you trust. You handle everything alone and rarely ask for help — but when you show up for someone, you really show up.",
    dramas: ["Crash Landing on You", "My Love from the Star", "Business Proposal"],
  },
  {
    emoji: "🌻",
    type: "The Bright Lead",
    title: "Energetic and irresistibly lovable",
    desc: "You're the person who lights up every room. Honest, direct, and a little clumsy — people are drawn to your energy without even knowing why. You feel everything deeply.",
    dramas: ["Strong Girl Bong-soon", "She Was Pretty", "Weightlifting Fairy"],
  },
  {
    emoji: "🎯",
    type: "The Quiet Strategist",
    title: "Calm, sharp, and always two steps ahead",
    desc: "You observe more than you speak. You see things others miss and act at exactly the right moment. People underestimate you — and that's exactly how you like it.",
    dramas: ["Signal", "Misaeng", "Itaewon Class"],
  },
  {
    emoji: "🌙",
    type: "The Emotional Wanderer",
    title: "Free-spirited and deeply feeling",
    desc: "You live for the moments that feel cinematic — spontaneous trips, late-night conversations, songs that hit a little too hard. You're romantic about life itself.",
    dramas: ["Our Beloved Summer", "Reply 1988", "Hometown Cha-Cha-Cha"],
  },
]

const OPTION_LABELS = ["A", "B", "C", "D"]

export default function QuizPage() {
  const [phase, setPhase] = useState<"quiz" | "result">("quiz")
  const [currentQ, setCurrentQ] = useState(0)
  const [pendingAnswer, setPendingAnswer] = useState<number | null>(null)
  const [scores, setScores] = useState([0, 0, 0, 0])
  const [resultIndex, setResultIndex] = useState(0)
  const [shared, setShared] = useState(false)

  const progress = phase === "result" ? 100 : (currentQ / QUESTIONS.length) * 100

  function handleNext() {
    if (pendingAnswer === null) return
    const newScores = [...scores]
    newScores[pendingAnswer]++

    if (currentQ === QUESTIONS.length - 1) {
      const max = Math.max(...newScores)
      setScores(newScores)
      setResultIndex(newScores.indexOf(max))
      setPhase("result")
    } else {
      setScores(newScores)
      setCurrentQ(currentQ + 1)
      setPendingAnswer(null)
    }
  }

  function handleRetry() {
    setPhase("quiz")
    setCurrentQ(0)
    setPendingAnswer(null)
    setScores([0, 0, 0, 0])
    setResultIndex(0)
    setShared(false)
  }

  function handleShare() {
    const result = RESULTS[resultIndex]
    const text = `I got "${result.type}" on the K-drama character quiz! Take it at unfoldk.com/quiz`
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ text, url: "https://unfoldk.com/quiz" }).catch(() => {})
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setShared(true)
        setTimeout(() => setShared(false), 2000)
      })
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0d0d0f" }}>
      <main className="max-w-[680px] mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            K-drama Character Type Quiz
          </h1>
          <p className="text-muted-foreground">7 questions · Find your K-drama personality</p>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-[#1a1a1a] rounded-full h-1.5 mb-8">
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, backgroundColor: "#FF4B6E" }}
          />
        </div>

        {phase === "quiz" && (
          <div>
            <p className="text-muted-foreground text-sm mb-3">
              Question {currentQ + 1} of {QUESTIONS.length}
            </p>
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-6 leading-snug">
              {QUESTIONS[currentQ].q}
            </h2>
            <div className="flex flex-col gap-3 mb-8">
              {QUESTIONS[currentQ].options.map((option, i) => (
                <button
                  key={i}
                  onClick={() => setPendingAnswer(i)}
                  className={`w-full text-left px-5 py-4 rounded-xl border transition-all ${
                    pendingAnswer === i
                      ? "border-primary bg-primary/10 text-white"
                      : "border-border/30 bg-[#1a1a1a] text-muted-foreground hover:border-primary/40 hover:text-white"
                  }`}
                >
                  <span className="font-semibold text-primary mr-3">{OPTION_LABELS[i]}.</span>
                  {option}
                </button>
              ))}
            </div>
            <button
              onClick={handleNext}
              disabled={pendingAnswer === null}
              className={`w-full py-4 rounded-xl font-semibold text-white transition-all ${
                pendingAnswer !== null ? "hover:opacity-90 cursor-pointer" : "opacity-30 cursor-not-allowed"
              }`}
              style={{ backgroundColor: "#FF4B6E" }}
            >
              {currentQ === QUESTIONS.length - 1 ? "See my result →" : "Next →"}
            </button>
          </div>
        )}

        {phase === "result" && (
          <div>
            <div className="bg-[#1a1a1a] border border-primary/30 rounded-2xl p-8 text-center mb-6">
              <div className="text-6xl mb-4">{RESULTS[resultIndex].emoji}</div>
              <p className="text-muted-foreground text-xs uppercase tracking-widest mb-2">You are</p>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">
                {RESULTS[resultIndex].type}
              </h2>
              <p className="text-primary font-medium mb-5">{RESULTS[resultIndex].title}</p>
              <p className="text-muted-foreground leading-relaxed mb-6">{RESULTS[resultIndex].desc}</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {RESULTS[resultIndex].dramas.map((drama) => (
                  <span
                    key={drama}
                    className="px-3 py-1 bg-[#2a2a2a] rounded-full text-sm text-muted-foreground border border-border/30"
                  >
                    {drama}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleShare}
                className="flex-1 py-4 rounded-xl font-semibold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: "#FF4B6E" }}
              >
                {shared ? "✓ Copied!" : "Share my result"}
              </button>
              <button
                onClick={handleRetry}
                className="flex-1 py-4 rounded-xl font-semibold text-muted-foreground bg-[#1a1a1a] border border-border/30 hover:border-primary/40 hover:text-white transition-all"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </main>
      <FooterSection />
    </div>
  )
}
