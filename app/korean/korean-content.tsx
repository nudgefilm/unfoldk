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

import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { FooterSection } from "@/components/footer-section"
import { Button } from "@/components/ui/button"
import { Volume2, Check, RotateCcw, Lock, ChevronDown, ChevronLeft, ChevronRight, X, Film, Bookmark, BookmarkCheck, UtensilsCrossed, MapPin, Calendar } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { hasProAccess } from "@/lib/auth/plan"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/components/ui/use-toast"
import type { KoreanPhraseApi } from "@/lib/korean/mapper"

interface PackApi {
  id: string
  title: string
  titleKo: string | null
  posterUrl: string | null
  phraseCount: number
  difficulty: "beginner" | "intermediate" | "advanced" | null
  progressPercent: number
  masteredCount: number               // 사용자가 mastered 한 phrase 수. 비로그인 시 0.
}

// 레벨 필터 칩. "ALL" 은 항상 노출 (reset 진입점), 나머지는 해당 레벨 팩이 0건이면 미노출.
// "Mixed" (difficulty=null) 팩은 단일 레벨 필터에 매칭 안 됨 — All 에서만 노출 (의도된 동작).
const PACK_LEVEL_FILTERS = [
  { code: "ALL",          label: "All" },
  { code: "beginner",     label: "Beginner" },
  { code: "intermediate", label: "Intermediate" },
  { code: "advanced",     label: "Advanced" },
] as const
type PackLevelCode = (typeof PACK_LEVEL_FILTERS)[number]["code"]

interface QuizApi {
  phraseId: string
  korean: string
  options: Array<{ label: "A" | "B" | "C" | "D"; english: string }>
  correctLabel: "A" | "B" | "C" | "D"
}

// Explore Expressions 섹션 — 페이지네이션 목록 아이템
interface ExplorePhrase {
  id: string
  korean: string
  english: string
  difficulty: "beginner" | "intermediate" | "advanced" | null
}

interface PackDramaApi {
  id: string
  title: string
  titleKo: string | null
  posterUrl: string | null
}

interface PackDetail {
  drama: PackDramaApi | null
  phrases: KoreanPhraseApi[]
}

// 표현 맥락 — /api/korean/phrase-context 응답 단위
interface PhraseContext {
  phrase_id: string
  episode_tag: string | null
  scene_description: string | null
  emotion_tag: string | null
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

export function KoreanContent() {
  const searchParams = useSearchParams()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isPro, setIsPro] = useState(false)

  // 1. 오늘의 표현
  //    초기 로드: featured (오늘의 표현). Got it / Next expression 클릭 시부터 랜덤 전환.
  //    seenPhraseIds: 세션 단위 이력 — 같은 표현 다시 안 나오게. 비-UUID (fallback sentinel) 도
  //    저장하지만 서버에서 UUID 만 필터링.
  const [phrase, setPhrase] = useState<KoreanPhraseApi | null>(null)
  const [phraseLoading, setPhraseLoading] = useState(true)
  const [phraseError, setPhraseError] = useState<string | null>(null)
  const [phraseLimited, setPhraseLimited] = useState(false)
  const [phraseSaved, setPhraseSaved] = useState(false)
  const [showSynAnt, setShowSynAnt] = useState(false)
  const [seenPhraseIds, setSeenPhraseIds] = useState<string[]>([])
  const [phraseAlsoIn, setPhraseAlsoIn] = useState<string[]>([])

  // 2. 스트릭
  const [streakDays, setStreakDays] = useState(0)

  // 3. 드라마 팩
  const [packs, setPacks] = useState<PackApi[]>([])
  const [packsLoading, setPacksLoading] = useState(true)
  const [totalMasteredOverall, setTotalMasteredOverall] = useState(0)
  // 레벨 필터 — Beginner/Intermediate/Advanced. Mixed (null) 은 ALL 에서만 노출.
  const [activePackLevel, setActivePackLevel] = useState<PackLevelCode>("ALL")

  // 4. 퀴즈
  const [quiz, setQuiz] = useState<QuizApi | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<"A" | "B" | "C" | "D" | null>(null)
  const [quizResult, setQuizResult] = useState<"correct" | "wrong" | null>(null)
  const [quizSubmitting, setQuizSubmitting] = useState(false)

  // 5. AI Grammar (Pro)
  const [grammar, setGrammar] = useState<string | null>(null)
  const [grammarLoading, setGrammarLoading] = useState(false)

  // 6. Drama Pack 모달 — 카드 클릭 시 해당 드라마의 표현 목록 노출
  const [packModalDramaId, setPackModalDramaId] = useState<string | null>(null)
  // intermediate/advanced 표현·팩 Pro 게이트 모달 (HangeulGo Free/Pro 확정 스펙 2026-06-01)
  const [proGateOpen, setProGateOpen] = useState(false)

  // Explore Expressions 섹션 — 페이지네이션 + 호버 상태 (CSS group-hover 대신 React state)
  const EXPLORE_LIMIT = 60
  const [explorePhrases, setExplorePhrases] = useState<ExplorePhrase[]>([])
  const [explorePage, setExplorePage] = useState(1)
  const [exploreTotal, setExploreTotal] = useState(0)
  const [exploreLoading, setExploreLoading] = useState(true)
  const [hoveredExprId, setHoveredExprId] = useState<string | null>(null)

  // Today's Lesson 섹션 ref — Explore 클릭 시 스크롤 타겟
  const todaysLessonRef = useRef<HTMLElement>(null)
  const [packDetail, setPackDetail] = useState<PackDetail | null>(null)
  const [packDetailLoading, setPackDetailLoading] = useState(false)

  // 7. 감정 태그 — 팩 필터용 맵 (dramaId → emotion_tag[]) + 선택 상태
  const [emotionPackMap, setEmotionPackMap] = useState<Record<string, string[]>>({})
  const [activeEmotion, setActiveEmotion] = useState<string | null>(null)

  // 8. 팩 모달 내 표현별 맥락 (episode_tag / scene_description / emotion_tag)
  const [phraseContextMap, setPhraseContextMap] = useState<Map<string, PhraseContext>>(new Map())

  const { toast } = useToast()

  // Drama Learning Packs 가로 스크롤 — calendar Featured 패턴 + 양끝 가드.
  // 한 번에 컨테이너 width 만큼 이동, 양끝 도달 시 해당 방향 화살표 자동 숨김.
  const packsScrollRef = useRef<HTMLDivElement>(null)
  const [packsCanLeft, setPacksCanLeft] = useState(false)
  const [packsCanRight, setPacksCanRight] = useState(false)

  const updatePacksScrollState = useCallback(() => {
    const el = packsScrollRef.current
    if (!el) return
    setPacksCanLeft(el.scrollLeft > 0)
    setPacksCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  const scrollPacks = (dir: "left" | "right") => {
    const el = packsScrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === "left" ? -el.clientWidth : el.clientWidth, behavior: "smooth" })
  }

  // packs 변경·스크롤·리사이즈 모두에 화살표 노출 상태 동기화
  useEffect(() => {
    if (packs.length === 0) return
    const raf = requestAnimationFrame(updatePacksScrollState)
    const el = packsScrollRef.current
    if (!el) return () => cancelAnimationFrame(raf)
    el.addEventListener("scroll", updatePacksScrollState, { passive: true })
    const ro = new ResizeObserver(updatePacksScrollState)
    ro.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener("scroll", updatePacksScrollState)
      ro.disconnect()
    }
  }, [packs, updatePacksScrollState])

  // ─── 팩 필터 / 진도 대시보드 derived ──────────────────────────
  // 레벨 chip 0건 미노출 — ALL 은 항상 노출, 나머지는 해당 difficulty 팩 1건 이상일 때만.
  const visiblePackLevels = PACK_LEVEL_FILTERS.filter(
    (l) => l.code === "ALL" || packs.some((p) => p.difficulty === l.code)
  )

  // 선택한 레벨이 데이터 변동으로 사라지면 ALL 로 자동 복귀 — 빈 결과 화면 회피.
  useEffect(() => {
    if (activePackLevel === "ALL") return
    const stillVisible = visiblePackLevels.some((l) => l.code === activePackLevel)
    if (!stillVisible) setActivePackLevel("ALL")
  }, [activePackLevel, visiblePackLevels])

  // 레벨 + 감정 태그 동시 필터
  const filteredPacks = packs.filter((p) => {
    const levelMatch = activePackLevel === "ALL" || p.difficulty === activePackLevel
    const emotionMatch = !activeEmotion || (emotionPackMap[p.id] ?? []).includes(activeEmotion)
    return levelMatch && emotionMatch
  })

  // 전체 팩에서 존재하는 감정 태그 목록 (중복 제거, 알파벳순)
  const availableEmotions = [
    ...new Set(Object.values(emotionPackMap).flat()),
  ].sort()

  // 학습 진도 대시보드 메트릭 — 로그인 유저에게만 노출.
  // completedPacks: phraseCount > 0 이고 progressPercent === 100 (모든 phrase mastered).
  // totalMastered: 모든 팩의 mastered phrase 합산.
  const dashboardStats = {
    totalPacks: packs.length,
    completedPacks: packs.filter(
      (p) => p.phraseCount > 0 && p.progressPercent === 100
    ).length,
    totalMastered: totalMasteredOverall,
  }

  // 표현 이미지 — scene image(image_url) 없으면 해당 드라마 TMDB 포스터로 폴백.
  // packs 는 컴포넌트 마운트 시 이미 로드됨 — 추가 fetch 없음.
  const dramaPosterFallback: string | null = phrase?.dramaId
    ? (packs.find((p) => p.id === phrase.dramaId)?.posterUrl ?? null)
    : null
  const phraseDisplayImageUrl = phrase?.imageUrl ?? dramaPosterFallback
  // scene image 는 landscape, drama poster 는 portrait — 스타일 분기에 사용.
  const phraseImageIsScene = !!phrase?.imageUrl

  // ─── 인증 + Pro 권한
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setIsAuthenticated(!!user)
      if (!user) return
      const { data: profile } = await supabase
        .from("users")
        .select("plan_type, is_admin, trial_ends_at")
        .eq("id", user.id)
        .single()
      const row = profile as { plan_type?: string; is_admin?: boolean; trial_ends_at?: string | null } | null
      setIsPro(hasProAccess({ planType: row?.plan_type, isAdmin: row?.is_admin, trialEndsAt: row?.trial_ends_at }))
    })
  }, [])

  // ─── 오늘의 표현 fetch
  // phrase_id 쿼리 파라미터 있으면 해당 표현으로 초기화 (마이페이지 딥링크)
  useEffect(() => {
    setPhraseLoading(true)
    setPhraseError(null)
    const forcedId = searchParams.get("phrase_id")
    const phraseUrl = forcedId
      ? `/api/korean/phrase-of-day?phrase_id=${encodeURIComponent(forcedId)}`
      : "/api/korean/phrase-of-day"
    fetch(phraseUrl)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then(
        (body: {
          phrase: KoreanPhraseApi
          cached?: boolean
          fallback?: boolean
          reason?: string
          detail?: string | null
        }) => {
          // fallback 응답은 reason/detail 을 콘솔에서 바로 확인할 수 있도록 노출.
          // (정상 응답은 cached 만 로그)
          if (body.fallback) {
            console.warn(
              "[korean] phrase fallback 응답:",
              `reason=${body.reason ?? "?"}`,
              `detail=${body.detail ?? "(none)"}`,
              `phraseId=${body.phrase?.id ?? "?"}`
            )
          } else {
            console.log(
              `[korean] phrase loaded id=${body.phrase?.id} cached=${body.cached}`
            )
          }
          setPhrase(body.phrase)
          // 초기 로드 phrase 도 seen 이력에 즉시 등록 — Next expression 시 같은 표현 재노출 방지.
          if (body.phrase?.id) {
            setSeenPhraseIds([body.phrase.id])
          }
        }
      )
      .catch((err) => {
        console.error("[korean] phrase fetch 실패:", err)
        setPhraseError("오늘의 표현을 불러오지 못했어요.")
      })
      .finally(() => setPhraseLoading(false))
  }, [searchParams])

  // ─── 동일 표현 다른 드라마 출처 조회 — phrase 변경 시마다 실행
  useEffect(() => {
    if (!phrase?.korean) {
      setPhraseAlsoIn([])
      return
    }
    const params = new URLSearchParams({ korean: phrase.korean })
    if (phrase.dramaName) params.set("exclude_drama", phrase.dramaName)
    fetch(`/api/korean/phrase-also-in?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { dramas: string[] }) => setPhraseAlsoIn(body.dramas ?? []))
      .catch(() => setPhraseAlsoIn([]))
  }, [phrase?.korean, phrase?.dramaName])

  // ─── Today's Lesson 잠금 표현 자동 스킵
  //    intermediate / advanced + !isPro 인 표현이 로드되면 즉시 다음 beginner 표현으로 전환.
  //    phrase.id 변경 시에만 실행 — advanceToNext 내부 seenPhraseIds 변경은 트리거 안 함.
  useEffect(() => {
    if (!phrase || isPro) return
    const isLocked = phrase.difficulty === "intermediate" || phrase.difficulty === "advanced"
    if (isLocked) {
      advanceToNext()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phrase?.id, isPro])

  // ─── Explore Expressions 페이지 fetch
  useEffect(() => {
    setExploreLoading(true)
    fetch(`/api/korean/phrases?page=${explorePage}&limit=${EXPLORE_LIMIT}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: { phrases: ExplorePhrase[]; total: number }) => {
        setExplorePhrases(body.phrases ?? [])
        setExploreTotal(body.total ?? 0)
      })
      .catch((err) => {
        console.error("[korean] explore fetch 실패:", err)
        setExplorePhrases([])
      })
      .finally(() => setExploreLoading(false))
  }, [explorePage])

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
      .then((body: { packs: PackApi[]; totalMasteredOverall?: number }) => {
        setPacks(body.packs ?? [])
        setTotalMasteredOverall(body.totalMasteredOverall ?? 0)
      })
      .catch((err) => {
        console.error("[korean] packs fetch 실패:", err)
        setPacks([])
      })
      .finally(() => setPacksLoading(false))
  }, [])

  // ─── 감정 태그 맵 fetch — 팩 필터 칩 노출용. 데이터 없으면 빈 맵 유지 (필터 칩 미노출).
  useEffect(() => {
    fetch("/api/korean/emotion-pack-map")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { map: Record<string, string[]> } | null) => {
        if (body?.map) setEmotionPackMap(body.map)
      })
      .catch(() => {})
  }, [])

  // ─── 퀴즈 fetch — 현재 표현 (phrase.id) 기준. Next expression 으로 표현 바뀌면 자동 재호출.
  //    이전 퀴즈 상태 (selectedAnswer, quizResult) 도 함께 리셋해 새 퀴즈에서 다시 풀 수 있게.
  useEffect(() => {
    if (!phrase) return
    setQuiz(null)
    setSelectedAnswer(null)
    setQuizResult(null)
    const url = `/api/korean/quiz?phrase_id=${encodeURIComponent(phrase.id)}`
    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body: QuizApi) => setQuiz(body))
      .catch((err) => {
        console.error("[korean] quiz fetch 실패:", err)
        setQuiz(null)
      })
  }, [phrase])

  // ─── 드라마 팩 상세 fetch — 모달 열릴 때 한 번
  useEffect(() => {
    if (!packModalDramaId) {
      setPackDetail(null)
      setPhraseContextMap(new Map())
      return
    }
    let cancelled = false
    setPackDetailLoading(true)
    setPackDetail(null)
    setPhraseContextMap(new Map())

    // 표현 목록 + 맥락 정보 병렬 fetch
    Promise.all([
      fetch(`/api/korean/pack/${packModalDramaId}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(res))),
      fetch(`/api/korean/phrase-context?pack_id=${encodeURIComponent(packModalDramaId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ])
      .then(([detail, ctxBody]) => {
        if (cancelled) return
        setPackDetail(detail as PackDetail)
        if (ctxBody && Array.isArray((ctxBody as { contexts: PhraseContext[] }).contexts)) {
          const m = new Map<string, PhraseContext>()
          for (const c of (ctxBody as { contexts: PhraseContext[] }).contexts) {
            m.set(c.phrase_id, c)
          }
          setPhraseContextMap(m)
        }
      })
      .catch((err) => {
        console.error("[korean] pack detail fetch 실패:", err)
        if (!cancelled) setPackDetail({ drama: null, phrases: [] })
      })
      .finally(() => {
        if (!cancelled) setPackDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [packModalDramaId])

  // ─── AI Grammar fetch (Pro 유저 + phrase 준비 시)
  useEffect(() => {
    if (!isPro || !phrase) return
    // sentinel id 는 grammar API 가 422 (fallback_phrase) 반환 — 호출 자체 skip 으로 로그 절약.
    if (phrase.id.startsWith("fallback-")) {
      console.warn(
        `[korean] grammar skip — phrase 가 fallback (id=${phrase.id}). 실제 phrase 생성 후 재시도.`
      )
      setGrammar(null)
      return
    }
    setGrammar(null)
    setGrammarLoading(true)
    console.log(`[korean] grammar fetch 시작 phraseId=${phrase.id}`)
    fetch("/api/korean/grammar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phraseId: phrase.id }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          // 실패 응답을 그대로 reject 에 실어 보냄 — catch 에서 reason/detail 확인 가능
          return Promise.reject({ status: res.status, body })
        }
        return body
      })
      .then((body: { explanation: string; cached?: boolean }) => {
        console.log(`[korean] grammar loaded cached=${body.cached}`)
        setGrammar(body.explanation)
      })
      .catch((err) => {
        console.error(
          "[korean] grammar fetch 실패:",
          `status=${err?.status ?? "?"}`,
          `error=${err?.body?.error ?? "?"}`,
          `reason=${err?.body?.reason ?? "?"}`,
          `detail=${err?.body?.detail ?? "?"}`
        )
        setGrammar(null)
      })
      .finally(() => setGrammarLoading(false))
  }, [isPro, phrase])

  // ─── 액션: 특정 표현 로드 — Explore 클릭 시 Today's Lesson에 해당 표현 표시
  const loadPhraseById = useCallback(async (phraseId: string) => {
    setPhraseLoading(true)
    setPhraseError(null)
    try {
      const res = await fetch(`/api/korean/phrase-of-day?phrase_id=${encodeURIComponent(phraseId)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as { phrase: KoreanPhraseApi | null }
      if (body.phrase) {
        setPhrase(body.phrase)
        setSeenPhraseIds((prev) => [...prev, body.phrase!.id])
      }
    } catch (err) {
      console.error("[korean] loadPhraseById 실패:", err)
    } finally {
      setPhraseLoading(false)
    }
  }, [])

  // ─── 액션: 다음 표현으로 전환 — seen 이력 제외 랜덤 1건 fetch
  //    Got it / Next expression 양쪽에서 호출.
  //    이력 소진 (exhausted) 시 자동 리셋 후 재시도.
  const advanceToNext = useCallback(async () => {
    setPhraseLoading(true)
    setPhraseError(null)
    try {
      const excludeParam = seenPhraseIds.join(",")
      const res = await fetch(
        `/api/korean/phrase-of-day?exclude_ids=${encodeURIComponent(excludeParam)}`
      )
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const body = (await res.json()) as {
        phrase: KoreanPhraseApi | null
        exhausted?: boolean
        random?: boolean
        limited?: boolean
      }

      if (body.limited) {
        setPhraseLimited(true)
        return
      }

      if (body.exhausted) {
        // 전체 표현 소진 — 이력 리셋 후 빈 exclude_ids 로 재요청
        const retryRes = await fetch("/api/korean/phrase-of-day?exclude_ids=")
        const retryBody = (await retryRes.json()) as { phrase: KoreanPhraseApi | null }
        if (retryBody.phrase) {
          setPhrase(retryBody.phrase)
          setSeenPhraseIds([retryBody.phrase.id])
          toast({
            title: "All caught up",
            description: "You've seen every expression. Cycling through again.",
          })
        } else {
          setPhraseError("표현을 더 가져오지 못했어요.")
        }
        return
      }

      if (body.phrase) {
        const nextPhrase = body.phrase
        setPhrase(nextPhrase)
        setSeenPhraseIds((prev) => [...prev, nextPhrase.id])
      }
    } catch (err) {
      console.error("[korean] advanceToNext 실패:", err)
      setPhraseError("다음 표현을 불러오지 못했어요.")
    } finally {
      setPhraseLoading(false)
    }
  }, [seenPhraseIds, toast])

  // 표현이 바뀌면 북마크 상태 리셋
  useEffect(() => { setPhraseSaved(false) }, [phrase?.id])

  // ─── 액션: Got it 클릭 시 학습완료 기록 + 스트릭 POST + 격려 토스트 + 다음 표현 자동 전환
  //    learning-progress POST 로 현재 phrase 를 mastered 마킹 → 페이지 재진입 시
  //    phrase-of-day GET 이 자동으로 미학습 랜덤으로 우회 (in-memory 가 아니라 영구).
  const handleMarkLearned = useCallback(async () => {
    if (!isAuthenticated) {
      window.location.href = "/login?redirect=/korean"
      return
    }
    // Optimistic +1 — fallback sentinel(비-UUID) 은 서버가 skip 하므로 제외
    if (phrase?.id && !phrase.id.startsWith("fallback-")) {
      setTotalMasteredOverall((prev) => prev + 1)
    }
    setPhraseSaved(true)

    // 현재 phrase 를 mastered 기록 — 비-UUID (fallback sentinel) 은 서버가 skip
    if (phrase?.id) {
      try {
        await fetch("/api/korean/learning-progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phraseId: phrase.id, status: "mastered" }),
        })
      } catch (err) {
        console.error("[korean] learning-progress 업데이트 실패:", err)
      }
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
    // 스트릭 응답과 무관하게 학습 완료 격려 메시지 + 즉시 다음 표현
    toast({
      title: "Great job!",
      description: "Streak updated · Here's the next one.",
    })
    await advanceToNext()
  }, [isAuthenticated, phrase, toast, advanceToNext])

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
      <main className="max-w-[1320px] mx-auto px-5 py-12">
        {/* Page Header — Soon 배너 제거 (2026-05-18). 정식 노출 후 카피 교체. */}
        <section className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">HangeulGo</h1>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-[#1a1a1a] border border-border/30">
              <span className="mr-1">🔥</span> {streakDays} day streak
            </span>
          </div>
          <p className="text-muted-foreground text-lg">
            Learn Korean naturally through K-drama lines you already love.
          </p>
        </section>

        {/* Learning Progress Dashboard — 로그인 유저 전용.
            packs.length === 0 일 땐 의미 없는 0/0 카드 노출 회피.
            totalMastered 는 모든 팩의 user_learning_progress.status='mastered' 합산. */}
        {isAuthenticated === true && packs.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-foreground mb-4">Your Progress</h2>
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-4 sm:p-5">
                <p className="text-muted-foreground text-xs sm:text-sm mb-1">Total Packs</p>
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  {dashboardStats.totalPacks}
                </p>
              </div>
              <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-4 sm:p-5">
                <p className="text-muted-foreground text-xs sm:text-sm mb-1">Completed</p>
                <p
                  className="text-2xl sm:text-3xl font-bold"
                  style={{ color: "#FF4B6E" }}
                >
                  {dashboardStats.completedPacks}
                </p>
              </div>
              <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-4 sm:p-5">
                <p className="text-muted-foreground text-xs sm:text-sm mb-1">
                  Phrases Mastered
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  {dashboardStats.totalMastered}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Today's Lesson Card — ref: Explore 클릭 시 스크롤 타겟 */}
        <section ref={todaysLessonRef} className="mb-16 scroll-mt-20">
          <div className="max-w-[640px] mx-auto bg-[#1a1a1a] border border-border/30 rounded-2xl p-8">
            {phraseLoading || (phrase && !isPro && (phrase.difficulty === "intermediate" || phrase.difficulty === "advanced")) ? (
              // 로딩 중이거나, 잠금 표현이 로드돼 auto-skip 대기 중인 경우
              <p className="text-center text-muted-foreground py-12">Loading today&apos;s phrase...</p>
            ) : phraseLimited ? (
              <div className="py-12 flex flex-col items-center text-center">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
                >
                  <Lock className="w-7 h-7" style={{ color: "#FF4B6E" }} />
                </div>
                <p className="text-foreground font-medium mb-2">Coming with Hallyu Pass</p>
                <p className="text-muted-foreground text-sm">
                  Upgrade to explore unlimited expressions
                </p>
              </div>
            ) : phraseError || !phrase ? (
              <p className="text-center text-muted-foreground py-12">
                {phraseError ?? "No phrase available."}
              </p>
            ) : (
              <>
                {/* Drama Tag + 동일 표현 다른 드라마 출처 */}
                <div className="flex flex-col items-center mb-6 gap-2">
                  <span
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold"
                    style={{
                      backgroundColor: "rgba(255, 75, 110, 0.15)",
                      color: "#FF4B6E",
                      border: "1px solid rgba(255, 75, 110, 0.35)",
                    }}
                  >
                    <Film className="w-4 h-4" />
                    <span className="text-foreground/70 font-normal uppercase tracking-wider text-[10px]">
                      Today&apos;s drama
                    </span>
                    <span>·</span>
                    <span>{phrase.dramaName ?? "K-drama"}</span>
                  </span>
                  {phraseAlsoIn.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      📺 이 표현은 {phraseAlsoIn.join(", ")}에서도 등장해요
                    </p>
                  )}
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
                    disabled={phraseLoading}
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

                {/* Next expression — streak 영향 없이 다음 랜덤 표현으로 이동. 세션 이력 제외. */}
                <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={advanceToNext}
                    disabled={phraseLoading}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    Next expression →
                  </button>
                </div>
                {/* 북마크 — learning_progress 에 'learning' 상태로 저장 */}
                <div className="mt-2 text-center">
                  <button
                    type="button"
                    title={phraseSaved ? "Saved" : "Save"}
                    disabled={phraseSaved || !isAuthenticated}
                    onClick={async () => {
                      if (!phrase?.id || phraseSaved || !isAuthenticated) return
                      setPhraseSaved(true) // optimistic
                      try {
                        const res = await fetch("/api/korean/learning-progress", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ phraseId: phrase.id, status: "mastered" }),
                        })
                        if (!res.ok) {
                          console.warn("[korean] phrase save 실패 status:", res.status)
                          setPhraseSaved(false)
                          return
                        }
                        const body = await res.json().catch(() => ({})) as { skipped?: boolean }
                        if (body.skipped) {
                          // fallback sentinel phrase — DB 미보유 → 저장 불가
                          setPhraseSaved(false)
                        }
                      } catch (err) {
                        console.warn("[korean] phrase save 실패:", err)
                        setPhraseSaved(false)
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                  >
                    {phraseSaved
                      ? <><BookmarkCheck className="w-3.5 h-3.5" style={{ color: "#FF4B6E" }} /> Saved</>
                      : <><Bookmark className="w-3.5 h-3.5" /> Save phrase</>
                    }
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Drama Learning Packs — calendar Featured 패턴 (scrollBy clientWidth + 호버 화살표 + 양끝 가드) */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-6">Drama Learning Packs</h2>
          {packsLoading ? (
            <p className="text-muted-foreground text-sm">Loading packs...</p>
          ) : packs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No learning packs yet.</p>
          ) : (
            <>
            {/* 레벨 + 감정 태그 필터 칩 행 */}
            <div className="flex flex-wrap gap-2 mb-4">
              {/* 레벨 필터 — visiblePackLevels 만 렌더. Mixed(null difficulty) 팩은 ALL 에서만 노출. */}
              {visiblePackLevels.map((l) => {
                const isActive = activePackLevel === l.code
                return (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setActivePackLevel(l.code)}
                    className={`flex-shrink-0 inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      isActive
                        ? "text-white"
                        : "border-border/40 bg-[#1a1a1a] text-muted-foreground hover:border-border/70 hover:text-foreground"
                    }`}
                    style={
                      isActive
                        ? { backgroundColor: "#FF4B6E", borderColor: "#FF4B6E" }
                        : undefined
                    }
                    aria-pressed={isActive}
                  >
                    {l.label}
                  </button>
                )
              })}
              {/* 감정 태그 필터 — 데이터 있을 때만 노출. 선택 시 해당 emotion 포함 팩만 표시. */}
              {availableEmotions.length > 0 && (
                <>
                  <span className="flex-shrink-0 self-center text-border/40 select-none">|</span>
                  {availableEmotions.map((emotion) => {
                    const isActive = activeEmotion === emotion
                    return (
                      <button
                        key={emotion}
                        type="button"
                        onClick={() => setActiveEmotion(isActive ? null : emotion)}
                        className={`flex-shrink-0 inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          isActive
                            ? "text-white"
                            : "border-border/40 bg-[#1a1a1a] text-muted-foreground hover:border-border/70 hover:text-foreground"
                        }`}
                        style={
                          isActive
                            ? { backgroundColor: "#FF4B6E", borderColor: "#FF4B6E" }
                            : undefined
                        }
                        aria-pressed={isActive}
                      >
                        {emotion}
                      </button>
                    )
                  })}
                </>
              )}
            </div>
            <div className="relative group">
            <div
              ref={packsScrollRef}
              className="flex gap-4 overflow-x-auto pb-4 -mx-5 px-5 [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {filteredPacks.map((pack) => {
                const dColor = difficultyColor(pack.difficulty)
                // 오늘의 표현 드라마와 일치 시 카드 하이라이트
                const isTodaysDrama = !!phrase?.dramaId && phrase.dramaId === pack.id
                // intermediate / advanced + 비-Pro → 개별 카드 잠금.
                // beginner(null 포함) 는 항상 Free 접근 — difficulty 명시적 화이트리스트로 확인.
                const isPackLocked = !isPro && (pack.difficulty === "intermediate" || pack.difficulty === "advanced")
                return (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => {
                      if (isPackLocked) { setProGateOpen(true); return }
                      setPackModalDramaId(pack.id)
                    }}
                    className={`flex-shrink-0 w-[240px] bg-[#1a1a1a] rounded-xl overflow-hidden transition-colors cursor-pointer text-left group ${
                      isTodaysDrama && !isPackLocked
                        ? "ring-2 ring-primary border border-primary"
                        : "border border-border/30 hover:border-primary/50"
                    }`}
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
                      {/* Today 배지 */}
                      {isTodaysDrama && !isPackLocked && (
                        <span
                          className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider text-white shadow-md"
                          style={{ backgroundColor: "#FF4B6E" }}
                        >
                          Today
                        </span>
                      )}
                      {/* Pro 뱃지 — 잠금 카드 우상단 */}
                      {isPackLocked && (
                        <div className="absolute top-2 right-2 z-10">
                          <span
                            className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: "rgba(255,75,110,0.92)", color: "white" }}
                          >
                            <Lock className="w-2.5 h-2.5" /> Pro
                          </span>
                        </div>
                      )}
                      {/* hover 오버레이 — 잠금 카드만 */}
                      {isPackLocked && (
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="text-center px-3">
                            <Lock className="w-7 h-7 text-white mx-auto mb-1.5" />
                            <p className="text-white text-xs font-medium leading-snug">Unlock with<br />Hallyu Pass</p>
                          </div>
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
                        {isPackLocked ? (
                          <span style={{ color: "#aaa" }}>Pro only</span>
                        ) : (
                          `${pack.progressPercent}% completed`
                        )}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
            {/* PC 전용 화살표 — group hover + 양끝 도달 시 해당 방향 숨김. 모바일은 터치 스와이프 유지. */}
            {packsCanLeft && (
              <button
                type="button"
                onClick={() => scrollPacks("left")}
                aria-label="Scroll learning packs left"
                className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-[#1a1a1a]/90 backdrop-blur-sm border border-border/30 items-center justify-center text-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#1a1a1a]"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {packsCanRight && (
              <button
                type="button"
                onClick={() => scrollPacks("right")}
                aria-label="Scroll learning packs right"
                className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-[#1a1a1a]/90 backdrop-blur-sm border border-border/30 items-center justify-center text-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#1a1a1a]"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
            {/* 전체 오버레이 제거 — 개별 카드 단위 잠금으로 전환 (HangeulGo Free/Pro 확정 스펙 2026-06-01) */}
            </div>
            </>
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
            UnfoldK Grammar Explanation
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
              className={`bg-[#1a1a1a] border border-border/30 rounded-2xl overflow-hidden ${
                isPro ? "" : "blur-[6px] pointer-events-none"
              }`}
            >
              {/* 이미지 — scene image 우선, 없으면 드라마 TMDB 포스터 폴백 */}
              {isPro && phraseDisplayImageUrl && (
                <div className="px-8 pt-8">
                  <div className={`relative w-full overflow-hidden rounded-xl ${
                    phraseImageIsScene
                      ? "max-h-[520px]"
                      : "flex justify-center max-h-[300px]"
                  }`}>
                    <Image
                      src={phraseDisplayImageUrl}
                      alt={phrase?.korean ?? ""}
                      width={phraseImageIsScene ? 800 : 200}
                      height={phraseImageIsScene ? 520 : 300}
                      className={
                        phraseImageIsScene
                          ? "w-full h-auto max-h-[520px] object-cover"
                          : "h-auto max-h-[300px] object-contain"
                      }
                      unoptimized
                    />
                  </div>
                </div>
              )}
              <div className="p-8">
              {isPro ? (
                grammarLoading ? (
                  <p className="text-muted-foreground text-sm">Generating grammar breakdown...</p>
                ) : grammar ? (
                  <>
                    <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                      {grammar}
                    </p>
                    {/* 장면 설명 — 문법 텍스트 아래, 구분선 위 */}
                    {phrase?.sceneDescription && (
                      <>
                        <hr className="my-4 border-border/20" />
                        <p className="text-xs text-muted-foreground italic leading-relaxed">
                          {phrase.sceneDescription}
                        </p>
                      </>
                    )}
                  </>
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
                    UnfoldK Grammar Explanations arrive at launch.
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

        {/* ── Explore Expressions ──────────────────────────────────────
            페이지당 60개 표현, 6줄 높이 제한, 넘치면 다음 페이지.
            intermediate / advanced + !isPro → hover 시 🔒 표시.        */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-foreground">Explore Expressions</h2>
            {!exploreLoading && exploreTotal > 0 && (
              <span className="text-xs text-muted-foreground">
                {exploreTotal.toLocaleString()} expressions
              </span>
            )}
          </div>

          {exploreLoading ? (
            <p className="text-muted-foreground text-sm">Loading expressions...</p>
          ) : explorePhrases.length === 0 ? (
            <p className="text-muted-foreground text-sm">No expressions yet.</p>
          ) : (
            <>
              {/* 표현 박스 — flex-wrap, 6줄 높이 제한.
                  overflow는 wrapper div에서만 처리해 내부 box 잘림 방지. */}
              <div style={{ maxHeight: "290px", overflow: "hidden" }}>
                <div className="flex flex-wrap gap-2 pb-2">
                  {explorePhrases.map((ep) => {
                    const isLocked = !isPro && (ep.difficulty === "intermediate" || ep.difficulty === "advanced")
                    const isHovered = hoveredExprId === ep.id
                    return (
                      <button
                        key={ep.id}
                        type="button"
                        onMouseEnter={() => setHoveredExprId(ep.id)}
                        onMouseLeave={() => setHoveredExprId(null)}
                        onClick={() => {
                          if (isLocked) { setProGateOpen(true); return }
                          // 비잠금: Today's Lesson에 해당 표현 로드 + 스크롤
                          loadPhraseById(ep.id)
                          todaysLessonRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                        }}
                        className={`relative inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
                          isLocked
                            ? "bg-[#1a1a1a] border-border/20 cursor-pointer hover:border-border/40"
                            : "bg-[#1a1a1a] border-border/30 cursor-pointer hover:border-primary/40"
                        }`}
                      >
                        <span className="text-foreground font-medium whitespace-nowrap">{ep.korean}</span>
                        <span className="text-muted-foreground text-xs whitespace-nowrap max-w-[140px] truncate">
                          {ep.english}
                        </span>
                        {/* 잠금 hover 오버레이 — CSS group-hover 대신 React state로 처리 (로그인 상태 무관하게 동작) */}
                        {isLocked && isHovered && (
                          <span className="absolute inset-0 flex items-center justify-center bg-[#0d0d0f]/75 rounded-lg">
                            <Lock className="w-3.5 h-3.5" style={{ color: "#FF4B6E" }} />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 페이지네이션 */}
              {(() => {
                const totalPages = Math.max(1, Math.ceil(exploreTotal / EXPLORE_LIMIT))
                if (totalPages <= 1) return null
                return (
                  <div className="flex items-center justify-between mt-5">
                    <button
                      type="button"
                      onClick={() => setExplorePage((p) => Math.max(1, p - 1))}
                      disabled={explorePage <= 1}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" /> Previous
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {explorePage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setExplorePage((p) => Math.min(totalPages, p + 1))}
                      disabled={explorePage >= totalPages}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )
              })()}
            </>
          )}
        </section>
      </main>

      {/* Drama Pack 모달 — 카드 클릭 시 해당 드라마의 학습 표현 목록 표시.
          표현 없으면 "Expressions coming soon" (cron 이 채울 때까지 안내). */}
      {packModalDramaId && (
        <PackDetailModal
          onClose={() => setPackModalDramaId(null)}
          detail={packDetail}
          loading={packDetailLoading}
          phraseContextMap={phraseContextMap}
        />
      )}

      {/* Intermediate / Advanced Pro 게이트 모달 */}
      {proGateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={() => setProGateOpen(false)}
        >
          <div
            className="relative bg-[#1a1a1a] border border-border/50 rounded-2xl p-6 text-center max-w-sm w-full shadow-xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setProGateOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: "rgba(255, 75, 110, 0.15)" }}
            >
              <Lock className="w-7 h-7" style={{ color: "#FF4B6E" }} />
            </div>
            <h3 className="text-foreground font-semibold text-lg mb-2">
              Intermediate &amp; Advanced — Coming with Hallyu Pass
            </h3>
            <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
              Beginner expressions are free for everyone. Intermediate and advanced K-drama phrases unlock with Hallyu Pass.
            </p>
            <Link
              href="/signup"
              className="inline-block text-sm font-medium px-6 py-2.5 rounded-full text-white"
              style={{ backgroundColor: "#FF4B6E" }}
              onClick={() => setProGateOpen(false)}
            >
              Notify me at launch
            </Link>
          </div>
        </div>
      )}

      <FooterSection />

      {/* Toaster — root layout 미마운트 (CLAUDE.md §7). Got it 토스트 살리려 페이지 마운트. */}
      <Toaster />
    </div>
  )
}

// Drama Pack 상세 모달 — 표현 카드에 감정 태그·에피소드·장면 설명 추가.
function PackDetailModal({
  onClose,
  detail,
  loading,
  phraseContextMap,
}: {
  onClose: () => void
  detail: PackDetail | null
  loading: boolean
  phraseContextMap: Map<string, PhraseContext>
}) {
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
      onClick={handleOverlayClick}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] bg-[#1a1a1a] rounded-2xl p-6 relative animate-in zoom-in-95 duration-150 overflow-hidden flex flex-col"
        style={{ borderRadius: "16px" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-10"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header — 드라마 메타 */}
        <div className="flex items-center gap-4 mb-6 pr-8">
          {detail?.drama?.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={detail.drama.posterUrl}
              alt={detail.drama.title}
              className="w-16 h-24 object-cover rounded-lg flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-24 bg-[#252528] rounded-lg flex-shrink-0" />
          )}
          <div className="min-w-0">
            <h2 className="text-xl md:text-2xl font-bold text-white truncate">
              {detail?.drama?.title ?? "Drama"}
            </h2>
            {detail?.drama?.titleKo && (
              <p className="text-muted-foreground text-sm mt-1 truncate">
                {detail.drama.titleKo}
              </p>
            )}
          </div>
        </div>

        {/* Body — 표현 리스트 */}
        <div className="overflow-y-auto -mx-2 px-2 flex-1">
          {loading ? (
            <p className="text-center text-muted-foreground py-12">Loading expressions...</p>
          ) : !detail || detail.phrases.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-foreground font-medium mb-1">Expressions coming soon</p>
              <p className="text-muted-foreground text-sm">
                New learning phrases are generated daily.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {detail.phrases.map((p) => {
                const dColor = difficultyColor(p.difficulty)
                const ctx = phraseContextMap.get(p.id)
                return (
                  <div
                    key={p.id}
                    className="bg-[#141416] border border-border/20 rounded-xl p-4"
                  >
                    {/* 상단: 한국어 표현 + 난이도·감정 태그 */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="text-foreground text-lg font-semibold">{p.korean}</h3>
                      <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                        {ctx?.emotion_tag && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#252528] text-muted-foreground">
                            {ctx.emotion_tag}
                          </span>
                        )}
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: dColor.bg, color: dColor.color }}
                        >
                          {difficultyLabel(p.difficulty)}
                        </span>
                      </div>
                    </div>
                    {p.romanization && (
                      <p className="text-muted-foreground text-sm">{p.romanization}</p>
                    )}
                    <p className="text-foreground text-sm mt-1">&ldquo;{p.english}&rdquo;</p>
                    {/* 하단: 화수 + 장면 설명 */}
                    {(ctx?.episode_tag || ctx?.scene_description) && (
                      <div className="mt-2 pt-2 border-t border-border/20">
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          {ctx.episode_tag && (
                            <span className="mr-1">{ctx.episode_tag} ·</span>
                          )}
                          {ctx.scene_description}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Explore More — 드라마 있을 때 크로스링크 */}
        {detail?.drama?.title && (
          <div className="flex-shrink-0 border-t border-border/20 pt-4 mt-3">
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">Explore more</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  href: `/food?drama=${encodeURIComponent(detail.drama.title)}`,
                  icon: <UtensilsCrossed className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#FF4B6E" }} />,
                  title: "Cook the food",
                  sub: "from this drama →",
                },
                {
                  href: `/curation-k?drama=${encodeURIComponent(detail.drama.title)}`,
                  icon: <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#FF4B6E" }} />,
                  title: "Filming spots",
                  sub: "visit Korea →",
                },
                {
                  href: "/calendar",
                  icon: <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#FF4B6E" }} />,
                  title: "Related events",
                  sub: "check calendar →",
                },
              ].map(({ href, icon, title, sub }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2 bg-[#141416] hover:bg-[#1e1e20] rounded-xl px-2.5 py-2.5 transition-colors group"
                >
                  {icon}
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-foreground truncate">{title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{sub}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
