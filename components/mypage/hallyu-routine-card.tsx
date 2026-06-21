"use client"

// HallyuRoutineCard — 이번 주 한류 루틴 표시 카드
// - 마운트 시 GET /api/hallyu-pass/routine 으로 상태 조회
// - preferences 없으면 → RoutineOnboardingModal 표시
// - preferences 있고 이번 주 루틴 없으면 → 자동 생성
// - 체크박스 클릭 → PATCH /api/hallyu-pass/routine

import { useEffect, useState } from "react"
import Link from "next/link"
import { Music, Film, Languages, UtensilsCrossed, CalendarDays, Check, Flame, Settings } from "lucide-react"
import { RoutineOnboardingModal } from "@/components/mypage/routine-onboarding-modal"

interface RoutineItem {
  day: string
  service: string
  action: string
  link: string
}

interface RoutineData {
  id: string
  routine_items: RoutineItem[]
  completed_items: Record<string, boolean>
  streak_count: number
  week_start: string
}

type Status = "loading" | "onboarding" | "generating" | "ready" | "error"

interface Prefs {
  interests: string[]
  daily_minutes: number
}

const SERVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  kpop: Music,
  kdrama: Film,
  korean: Languages,
  kfood: UtensilsCrossed,
}

// YYYY-MM-DD → "Jun 23 – Jun 29"
function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00Z")
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
  return `${fmt(start)} – ${fmt(end)}`
}

// 날짜 이름 한글→영문 정규화 (데이터는 영문)
const DAY_DISPLAY: Record<string, string> = {
  Mon: "Mon", Tue: "Tue", Wed: "Wed", Thu: "Thu", Fri: "Fri", Sat: "Sat", Sun: "Sun",
}

export function HallyuRoutineCard() {
  const [status, setStatus] = useState<Status>("loading")
  const [routine, setRoutine] = useState<RoutineData | null>(null)
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({})
  const [togglingIdx, setTogglingIdx] = useState<number | null>(null)
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        const res = await fetch("/api/hallyu-pass/routine")
        const data = await res.json() as {
          prefs: Prefs | null
          routine: RoutineData | null
        }

        if (cancelled) return

        if (!data.prefs) {
          setStatus("onboarding")
          return
        }

        setPrefs(data.prefs)

        if (!data.routine) {
          // preferences 있지만 이번 주 루틴 없음 → 자동 생성
          setStatus("generating")
          const genRes = await fetch("/api/hallyu-pass/routine/generate", { method: "POST" })
          const genData = await genRes.json() as { routine?: RoutineData }
          if (cancelled) return
          if (genData.routine) {
            setRoutine(genData.routine)
            setCompletedItems((genData.routine.completed_items as Record<string, boolean>) ?? {})
            setStatus("ready")
          } else {
            setStatus("error")
          }
          return
        }

        setRoutine(data.routine)
        setCompletedItems((data.routine.completed_items as Record<string, boolean>) ?? {})
        setStatus("ready")
      } catch {
        if (!cancelled) setStatus("error")
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  // 온보딩/설정 변경 완료 후 루틴 데이터 수신
  const handleOnboardingComplete = (
    routineData: unknown,
    updatedPrefs: { interests: string[]; daily_minutes: number }
  ) => {
    const r = routineData as RoutineData
    setRoutine(r)
    setCompletedItems((r.completed_items as Record<string, boolean>) ?? {})
    setPrefs(updatedPrefs)
    setStatus("ready")
    setShowSettings(false)
  }

  // 체크박스 토글
  const toggleItem = async (idx: number) => {
    if (!routine || togglingIdx !== null) return
    const current = !!completedItems[String(idx)]
    const newCompleted = !current

    // 낙관적 업데이트
    setCompletedItems((prev) => {
      const next = { ...prev }
      if (newCompleted) next[String(idx)] = true
      else delete next[String(idx)]
      return next
    })
    setTogglingIdx(idx)

    try {
      const res = await fetch("/api/hallyu-pass/routine", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routine_id: routine.id, item_index: idx, completed: newCompleted }),
      })
      const data = await res.json() as { completed_items?: Record<string, boolean> }
      if (data.completed_items) setCompletedItems(data.completed_items)
    } catch {
      // 롤백
      setCompletedItems((prev) => {
        const next = { ...prev }
        if (current) next[String(idx)] = true
        else delete next[String(idx)]
        return next
      })
    } finally {
      setTogglingIdx(null)
    }
  }

  const completedCount = Object.values(completedItems).filter(Boolean).length
  const totalCount = routine?.routine_items?.length ?? 0

  // 날짜별 그룹핑 (같은 day의 항목을 묶어서 표시)
  const grouped = routine?.routine_items?.reduce<Record<string, number[]>>((acc, item, idx) => {
    if (!acc[item.day]) acc[item.day] = []
    acc[item.day].push(idx)
    return acc
  }, {}) ?? {}

  const orderedDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].filter(
    (d) => grouped[d]
  )

  return (
    <>
      {/* key 변경으로 재마운트 → initialInterests/initialDailyMinutes useState 기본값 재적용 */}
      <RoutineOnboardingModal
        key={showSettings ? `settings-${prefs?.interests?.join(",")}-${prefs?.daily_minutes}` : "onboarding"}
        open={status === "onboarding" || showSettings}
        onComplete={handleOnboardingComplete}
        onClose={showSettings ? () => setShowSettings(false) : undefined}
        initialInterests={showSettings ? (prefs?.interests ?? ["kpop"]) : ["kpop"]}
        initialDailyMinutes={showSettings ? (prefs?.daily_minutes ?? 15) : 15}
        isUpdate={showSettings}
      />

      <div
        className="rounded-2xl border border-white/10 p-6 flex flex-col"
        style={{ background: "rgba(231,236,235,0.05)" }}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground flex-1">My Hallyu Routine</h2>
          {status === "ready" && (
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Edit routine settings"
            >
              <Settings className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Loading */}
        {(status === "loading" || status === "generating") && (
          <div className="flex-1 flex flex-col items-center justify-center py-8 gap-3">
            <div
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "rgba(255,75,110,0.5)", borderTopColor: "transparent" }}
            />
            <p className="text-muted-foreground text-sm">
              {status === "generating" ? "Creating your routine…" : "Loading…"}
            </p>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <p className="text-muted-foreground text-sm flex-1 flex items-center">
            Something went wrong. Please refresh the page.
          </p>
        )}

        {/* Ready — 루틴 표시 */}
        {status === "ready" && routine && (
          <>
            {routine.week_start && (
              <p className="text-xs text-muted-foreground mb-4">
                Week of {formatWeekRange(routine.week_start)}
              </p>
            )}

            <div className="space-y-1">
              {orderedDays.map((day) => (
                <div key={day}>
                  {grouped[day].map((itemIdx, slotIdx) => {
                    const item = routine.routine_items[itemIdx]
                    const done = !!completedItems[String(itemIdx)]
                    const Icon = SERVICE_ICONS[item.service] ?? Music

                    return (
                      <div
                        key={itemIdx}
                        className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-white/5 transition-colors group"
                      >
                        {/* 날짜 레이블 (첫 번째 항목만) */}
                        <span
                          className="text-xs font-medium w-8 flex-shrink-0"
                          style={{ color: slotIdx === 0 ? "#888" : "transparent" }}
                        >
                          {slotIdx === 0 ? DAY_DISPLAY[day] ?? day : ""}
                        </span>

                        {/* 서비스 아이콘 */}
                        <Icon
                          className="w-4 h-4 flex-shrink-0"
                          style={{ color: done ? "#555" : "#888" }}
                        />

                        {/* 액션 텍스트 (링크) */}
                        <Link
                          href={item.link}
                          className={`flex-1 text-sm transition-colors hover:underline min-w-0 truncate ${
                            done ? "line-through text-muted-foreground/50" : "text-foreground/80 hover:text-foreground"
                          }`}
                        >
                          {item.action}
                        </Link>

                        {/* 체크박스 */}
                        <button
                          type="button"
                          onClick={() => toggleItem(itemIdx)}
                          disabled={togglingIdx !== null}
                          className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors"
                          style={{
                            borderColor: done ? "#FF4B6E" : "rgba(255,255,255,0.2)",
                            backgroundColor: done ? "#FF4B6E" : "transparent",
                          }}
                          aria-label={done ? "Mark incomplete" : "Mark complete"}
                        >
                          {done && <Check className="w-3 h-3 text-white" />}
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* 푸터 — 세그먼트 진행 바 + 스트릭 */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {/* 세그먼트 바 */}
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: totalCount }).map((_, i) => (
                    <div
                      key={i}
                      className="h-2 rounded-sm flex-shrink-0"
                      style={{
                        width: totalCount > 10 ? 10 : 12,
                        backgroundColor: completedItems[String(i)]
                          ? "#FF4B6E"
                          : "rgba(255,255,255,0.1)",
                      }}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {completedCount}/{totalCount}
                </span>
              </div>
              {routine.streak_count > 0 && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Flame className="w-3.5 h-3.5" style={{ color: "#FF4B6E" }} />
                  <span className="text-xs font-medium" style={{ color: "#FF4B6E" }}>
                    {routine.streak_count}w
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
