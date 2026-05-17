"use client"

// HangeulGo (M+3) — Phase 1 실데이터 연동
// 데이터·로직만 확장, UI 톤은 기존 v0 다크테마 유지 (CLAUDE.md §6 #9).
//
// 섹션:
//   1. Hero — 스트릭 표시 (/api/korean/streak)
//   2. Today's Lesson — /api/korean/phrase-of-day (Claude Haiku 자동 생성)
//   3. Drama Learning Packs — /api/korean/packs (TMDB 포스터 + 진도율)
//   4. Quiz — /api/korean/quiz (4지선다)
//   5. AI Grammar Explanation (Pro) — /api/korean/grammar
//
// 음성: audio_url 우선, 없으면 Web Speech API (lang=ko-KR) 폴백 — ElevenLabs 는 Phase 3.

import { useCallback, useEffect, useState } from "react"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import { Volume2, Check, RotateCcw, Lock, ChevronDown } from "lucide-react"
import Link from "next/link"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { hasProAccess } from "@/lib/auth/plan"
import { ServiceComingSoonBanner } from "@/components/early-access/service-coming-soon-banner"
import type { KoreanPhraseApi } from "@/lib/korean/mapper"

interface PackApi {
  id: string
  title: string
  titleKo: string | null
  posterUrl: string | null
  phraseCount: number
  difficulty: "beginner" | "intermediate" | "advanced" | null
  progressPercent: number
}

interface QuizApi {
  phraseId: string
  korean: string
  options: Array<{ label: "A" | "B" | "C" | "D"; english: string }>
  correctLabel: "A" | "B" | "C" | "D"
}

// 난이도 라벨 + 색상 (UI 톤 유지)
function difficultyLabel(d: PackApi["difficulty"]): string {
  if (d === "beginner") return "Beginner"
  if (d === "intermediate") return "Intermediate"
  if (d === "advanced") return "Advanced"
  return "Mixed"
}
function difficultyColor(d: PackApi["difficulty"]): { bg: string; color: string } {
  if (d === "beginner") return { bg: "rgba(74, 222, 128, 0.15)", color: "#4ade80" }
  if (d === "intermediate") return { bg: "rgba(251, 191, 36, 0.15)", color: "#fbbf24" }
  if (d === "advanced") return { bg: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }
  return { bg: "rgba(136, 136, 136, 0.15)", color: "#aaa" }
}

// 한국어 TTS — audio_url 있으면 재생, 없으면 Web Speech API 폴백
function playKoreanAudio(text: string, audioUrl: string | null) {
  if (audioUrl) {
    new Audio(audioUrl).play().catch((err) => {
      console.warn("[korean] audio 재생 실패, Web Speech 폴백:", err)
      speakKorean(text)
    })
    return
  }
  speakKorean(text)
}
function speakKorean(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    console.warn("[korean] Web Speech API 미지원 브라우저")
    return
  }
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = "ko-KR"
  utt.rate = 0.9
  window.speechSynthesis.cancel() // 이전 발화 중단
  window.speechSynthesis.speak(utt)
}

export default function HangeulGoPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isPro, setIsPro] = useState(false)

  // 1. 오늘의 표현
  const [phrase, setPhrase] = useState<KoreanPhraseApi | null>(null)
  const [phraseLoading, setPhraseLoading] = useState(true)
  const [phraseError, setPhraseError] = useState<string | null>(null)
  const [showSynAnt, setShowSynAnt] = useState(false)

  // 2. 스트릭
  const [streakDays, setStreakDays] = useState(0)

  // 3. 드라마 팩
  const [packs, setPacks] = useState<PackApi[]>([])
  const [packsLoading, setPacksLoading] = useState(true)

  // 4. 퀴즈
  const [quiz, setQuiz] = useState<QuizApi | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<"A" | "B" | "C" | "D" | null>(null)
  const [quizResult, setQuizResult] = useState<"correct" | "wrong" | null>(null)
  const [quizSubmitting, setQuizSubmitting] = useState(false)

  // 5. AI Grammar (Pro)
  const [grammar, setGrammar] = useState<string | null>(null)
  const [grammarLoading, setGrammarLoading] = useState(false)

  // ─── 인증 + Pro 권한
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setIsAuthenticated(!!user)
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

  // ─── 오늘의 표현 fetch
  useEffect(() => {
    setPhraseLoading(true)
    setPhraseError(null)
    fetch("/api/korean/phrase-of-day")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { phrase: KoreanPhraseApi }) => setPhrase(body.phrase))
      .catch((err) => {
        console.error("[korean] phrase fetch 실패:", err)
        setPhraseError("오늘의 표현을 불러오지 못했어요.")
      })
      .finally(() => setPhraseLoading(false))
  }, [])

  // ─── 스트릭 fetch (로그인 시만 유효)
  useEffect(() => {
    if (isAuthenticated === null) return
    fetch("/api/korean/streak")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { streakDays: number }) => setStreakDays(body.streakDays ?? 0))
      .catch((err) => {
        console.error("[korean] streak fetch 실패:", err)
        setStreakDays(0)
      })
  }, [isAuthenticated])

  // ─── 드라마 팩 fetch
  useEffect(() => {
    setPacksLoading(true)
    fetch("/api/korean/packs")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { packs: PackApi[] }) => setPacks(body.packs ?? []))
      .catch((err) => {
        console.error("[korean] packs fetch 실패:", err)
        setPacks([])
      })
      .finally(() => setPacksLoading(false))
  }, [])

  // ─── 퀴즈 fetch (오늘의 표현 로드 후)
  useEffect(() => {
    if (!phrase) return
    fetch("/api/korean/quiz")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: QuizApi) => setQuiz(body))
      .catch((err) => {
        console.error("[korean] quiz fetch 실패:", err)
        setQuiz(null)
      })
  }, [phrase])

  // ─── AI Grammar fetch (Pro 유저 + phrase 준비 시)
  useEffect(() => {
    if (!isPro || !phrase) return
    setGrammar(null)
    setGrammarLoading(true)
    fetch("/api/korean/grammar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phraseId: phrase.id }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { explanation: string }) => setGrammar(body.explanation))
      .catch((err) => {
        console.error("[korean] grammar fetch 실패:", err)
        setGrammar(null)
      })
      .finally(() => setGrammarLoading(false))
  }, [isPro, phrase])

  // ─── 액션: Got it 클릭 시 스트릭 POST
  const handleMarkLearned = useCallback(async () => {
    if (!isAuthenticated) {
      window.location.href = "/login?redirect=/korean"
      return
    }
    try {
      const res = await fetch("/api/korean/streak", { method: "POST" })
      if (res.ok) {
        const body = (await res.json()) as { streakDays: number }
        setStreakDays(body.streakDays)
      }
    } catch (err) {
      console.error("[korean] streak 업데이트 실패:", err)
    }
  }, [isAuthenticated])

  // ─── 액션: 퀴즈 정답 체크
  const handleCheckAnswer = useCallback(async () => {
    if (!quiz || !selectedAnswer || quizSubmitting) return
    setQuizSubmitting(true)
    const isCorrect = selectedAnswer === quiz.correctLabel
    setQuizResult(isCorrect ? "correct" : "wrong")
    // 로그인 시만 결과 저장
    if (isAuthenticated) {
      try {
        await fetch("/api/korean/quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phraseId: quiz.phraseId, isCorrect }),
        })
      } catch (err) {
        console.error("[korean] quiz POST 실패:", err)
      }
    }
    setQuizSubmitting(false)
  }, [quiz, selectedAnswer, isAuthenticated, quizSubmitting])

  const handleResetQuiz = () => {
    setSelectedAnswer(null)
    setQuizResult(null)
  }

  const hasSynAnt =
    !!phrase && (phrase.synonyms.length > 0 || phrase.antonyms.length > 0)

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0d0d0f" }}>
      <ServiceComingSoonBanner
        serviceName="HangeulGo"
        serviceLabel="HangeulGo"
        source="korean-page"
      />
      <main className="max-w-[1320px] mx-auto px-5 py-12">
        {/* Page Header */}
        <section className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">HangeulGo</h1>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-[#1a1a1a] border border-border/30">
              <span className="mr-1">🔥</span> {streakDays} day streak
            </span>
          </div>
          <p className="text-muted-foreground text-lg">
            Learn Korean through K-drama lines you already love
          </p>
        </section>

        {/* Today's Lesson Card */}
        <section className="mb-16">
          <div className="max-w-[640px] mx-auto bg-[#1a1a1a] border border-border/30 rounded-2xl p-8">
            {phraseLoading ? (
              <p className="text-center text-muted-foreground py-12">Loading today&apos;s phrase...</p>
            ) : phraseError || !phrase ? (
              <p className="text-center text-muted-foreground py-12">
                {phraseError ?? "No phrase available."}
              </p>
            ) : (
              <>
                {/* Drama Tag */}
                <div className="flex justify-center mb-6">
                  <span
                    className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: "rgba(255, 75, 110, 0.15)", color: "#FF4B6E" }}
                  >
                    {phrase.dramaName ?? "K-drama"}
                  </span>
                </div>

                {/* Korean Phrase */}
                <div className="text-center mb-6">
                  <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-3">
                    {phrase.korean}
                  </h2>
                  {phrase.romanization && (
                    <p className="text-muted-foreground text-lg mb-1">{phrase.romanization}</p>
                  )}
                  <p className="text-foreground text-xl">&ldquo;{phrase.english}&rdquo;</p>
                </div>

                {/* Play Button */}
                <div className="flex justify-center mb-8">
                  <Button
                    onClick={() => playKoreanAudio(phrase.korean, phrase.audioUrl)}
                    className="rounded-full px-6 py-3 font-medium text-white flex items-center gap-2"
                    style={{ backgroundColor: "#FF4B6E" }}
                  >
                    <Volume2 className="w-5 h-5" />
                    Play pronunciation
                  </Button>
                </div>

                {/* Word Breakdown — 동적 렌더링 */}
                {phrase.wordBreakdown.length > 0 && (
                  <div className="bg-[#141416] rounded-xl p-4 mb-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                      Word Breakdown
                    </p>
                    <div className="flex justify-center gap-6 text-sm flex-wrap">
                      {phrase.wordBreakdown.map((w, idx) => (
                        <div key={`${w.word}-${idx}`} className="flex items-center">
                          {idx > 0 && (
                            <span className="text-muted-foreground mr-6">|</span>
                          )}
                          <div className="text-center">
                            <span className="text-foreground font-medium">{w.word}</span>
                            {w.romanization && (
                              <span className="text-muted-foreground ml-1">({w.romanization})</span>
                            )}
                            {w.meaning && (
                              <span className="text-muted-foreground"> = {w.meaning}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Synonyms / Antonyms — 접이식 (있을 때만) */}
                {hasSynAnt && (
                  <div className="mb-8">
                    <button
                      type="button"
                      onClick={() => setShowSynAnt((v) => !v)}
                      className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronDown
                        className={`w-3 h-3 transition-transform ${
                          showSynAnt ? "rotate-180" : ""
                        }`}
                      />
                      {showSynAnt ? "Hide" : "Show"} synonyms &amp; antonyms
                    </button>
                    {showSynAnt && (
                      <div className="mt-3 bg-[#141416] rounded-xl p-4 space-y-2 text-sm">
                        {phrase.synonyms.length > 0 && (
                          <div>
                            <span className="text-muted-foreground text-xs uppercase tracking-wide mr-2">
                              Synonyms
                            </span>
                            <span className="text-foreground">
                              {phrase.synonyms.join(" · ")}
                            </span>
                          </div>
                        )}
                        {phrase.antonyms.length > 0 && (
                          <div>
                            <span className="text-muted-foreground text-xs uppercase tracking-wide mr-2">
                              Antonyms
                            </span>
                            <span className="text-foreground">
                              {phrase.antonyms.join(" · ")}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={handleMarkLearned}
                    className="flex-1 rounded-xl py-3 font-medium text-white flex items-center justify-center gap-2"
                    style={{ backgroundColor: "#FF4B6E" }}
                  >
                    <Check className="w-4 h-4" />
                    Got it
                  </Button>
                  <Button
                    onClick={() => playKoreanAudio(phrase.korean, phrase.audioUrl)}
                    variant="outline"
                    className="flex-1 rounded-xl py-3 font-medium border-border/50 hover:bg-secondary/50 flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Review again
                  </Button>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Drama Learning Packs */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-6">Drama Learning Packs</h2>
          {packsLoading ? (
            <p className="text-muted-foreground text-sm">Loading packs...</p>
          ) : packs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No learning packs yet.</p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-5 px-5 scrollbar-hide">
              {packs.map((pack) => {
                const dColor = difficultyColor(pack.difficulty)
                return (
                  <Link
                    key={pack.id}
                    href={`/korean/pack/${pack.id}`}
                    className="flex-shrink-0 w-[240px] bg-[#1a1a1a] border border-border/30 rounded-xl overflow-hidden hover:border-primary/50 transition-colors cursor-pointer"
                  >
                    {/* Thumbnail — TMDB 포스터 */}
                    <div
                      className="w-full h-32 relative"
                      style={{ backgroundColor: "#252528" }}
                    >
                      {pack.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={pack.posterUrl}
                          alt={pack.title}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                          Drama Thumbnail
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="text-foreground font-medium mb-1 truncate">{pack.title}</h3>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-muted-foreground text-sm">
                          {pack.phraseCount} phrases
                        </span>
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: dColor.bg, color: dColor.color }}
                        >
                          {difficultyLabel(pack.difficulty)}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-1.5 bg-[#252528] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pack.progressPercent}%`,
                            backgroundColor: "#FF4B6E",
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {pack.progressPercent}% completed
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* Quiz Mode Card */}
        <section className="mb-16">
          <div className="max-w-[640px] mx-auto bg-[#1a1a1a] border border-border/30 rounded-2xl p-8">
            <h2 className="text-xl font-semibold text-foreground mb-6 text-center">Quiz Mode</h2>

            {!quiz ? (
              <p className="text-center text-muted-foreground py-6">Loading quiz...</p>
            ) : (
              <>
                {/* Question */}
                <p className="text-foreground text-lg text-center mb-6">
                  What does <span className="font-semibold">&lsquo;{quiz.korean}&rsquo;</span> mean?
                </p>

                {/* Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {quiz.options.map((option) => {
                    const isSelected = selectedAnswer === option.label
                    const isCorrectAnswer =
                      quizResult !== null && option.label === quiz.correctLabel
                    const isWrongPick =
                      quizResult === "wrong" && isSelected && !isCorrectAnswer

                    return (
                      <button
                        key={option.label}
                        onClick={() => quizResult === null && setSelectedAnswer(option.label)}
                        disabled={quizResult !== null}
                        className={`p-4 rounded-xl text-left transition-all flex items-center gap-3 ${
                          isSelected
                            ? "border-2"
                            : "bg-[#252528] border-2 border-transparent hover:border-border/50"
                        } ${quizResult !== null ? "cursor-default" : ""}`}
                        style={
                          isCorrectAnswer
                            ? {
                                backgroundColor: "rgba(74, 222, 128, 0.15)",
                                borderColor: "#4ade80",
                              }
                            : isWrongPick
                            ? {
                                backgroundColor: "rgba(239, 68, 68, 0.15)",
                                borderColor: "#ef4444",
                              }
                            : isSelected
                            ? {
                                backgroundColor: "rgba(255, 75, 110, 0.15)",
                                borderColor: "#FF4B6E",
                              }
                            : {}
                        }
                      >
                        <span
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium ${
                            isSelected ? "text-white" : "bg-[#1a1a1a] text-muted-foreground"
                          }`}
                          style={
                            isCorrectAnswer
                              ? { backgroundColor: "#4ade80", color: "white" }
                              : isWrongPick
                              ? { backgroundColor: "#ef4444", color: "white" }
                              : isSelected
                              ? { backgroundColor: "#FF4B6E" }
                              : {}
                          }
                        >
                          {option.label}
                        </span>
                        <span
                          className={
                            isSelected || isCorrectAnswer
                              ? "text-foreground font-medium"
                              : "text-foreground"
                          }
                        >
                          {option.english}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Result message + Submit Button */}
                {quizResult && (
                  <p
                    className="text-center mt-4 text-sm font-medium"
                    style={{
                      color: quizResult === "correct" ? "#4ade80" : "#ef4444",
                    }}
                  >
                    {quizResult === "correct"
                      ? "✓ Correct! 잘했어요"
                      : `✗ The correct answer was ${quiz.correctLabel}`}
                  </p>
                )}
                {quizResult === null ? (
                  <Button
                    onClick={handleCheckAnswer}
                    disabled={!selectedAnswer || quizSubmitting}
                    className="w-full mt-6 rounded-xl py-3 font-medium text-white"
                    style={{ backgroundColor: "#FF4B6E" }}
                  >
                    Check Answer
                  </Button>
                ) : (
                  <Button
                    onClick={handleResetQuiz}
                    variant="outline"
                    className="w-full mt-6 rounded-xl py-3 font-medium border-border/50 hover:bg-secondary/50"
                  >
                    Try Again
                  </Button>
                )}
              </>
            )}
          </div>
        </section>

        {/* AI Grammar Explanation (Pro) */}
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
            {/* Pro 유저: 실제 컨텐츠 / 비-Pro: blur placeholder */}
            <div
              className={`bg-[#1a1a1a] border border-border/30 rounded-2xl p-8 ${
                isPro ? "" : "blur-[6px] pointer-events-none"
              }`}
            >
              {isPro ? (
                grammarLoading ? (
                  <p className="text-muted-foreground text-sm">Generating grammar breakdown...</p>
                ) : grammar ? (
                  <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                    {grammar}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Grammar explanation unavailable for this phrase.
                  </p>
                )
              ) : (
                // 비-Pro placeholder (실제 보이지 않지만 레이아웃 공간 확보)
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
              )}
            </div>

            {/* Upgrade Overlay */}
            {!isPro && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-[#1a1a1a] border border-border/50 rounded-xl p-6 text-center shadow-xl">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
                  >
                    <Lock className="w-6 h-6" style={{ color: "#FF4B6E" }} />
                  </div>
                  <p className="text-foreground font-medium mb-2">Coming with Hallyu Pass</p>
                  <p className="text-muted-foreground text-xs mb-4">
                    AI Grammar Explanations arrive at launch.
                  </p>
                  <Link href="/signup">
                    <Button
                      className="px-6 py-2 rounded-full font-medium text-white"
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
