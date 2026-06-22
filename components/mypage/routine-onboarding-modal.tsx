"use client"

// RoutineOnboardingModal — 한류 루틴 초기 설정 모달
// hallyu_routine_preferences 가 없는 Pro 유저 첫 진입 시 표시.
// Step 1: 관심 분야 복수 선택 → Step 2: 하루 투자 시간 선택 → 제출.

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Check, Music, Film, Languages, UtensilsCrossed, ChevronRight } from "lucide-react"

const INTERESTS = [
  { id: "kpop", label: "K-pop", icon: Music },
  { id: "kdrama", label: "K-drama", icon: Film },
  { id: "korean", label: "Korean Language", icon: Languages },
  { id: "kfood", label: "K-food", icon: UtensilsCrossed },
]

const TIME_OPTIONS = [
  { value: 5, label: "5 minutes", desc: "1 quick task per day" },
  { value: 15, label: "15 minutes", desc: "2 tasks per day" },
  { value: 30, label: "30 minutes", desc: "3 tasks per day" },
]

interface Props {
  open: boolean
  onComplete: (routine: unknown, prefs: { interests: string[]; daily_minutes: number }) => void
  onClose?: () => void
  initialInterests?: string[]
  initialDailyMinutes?: number
  isUpdate?: boolean
}

export function RoutineOnboardingModal({
  open,
  onComplete,
  onClose,
  initialInterests,
  initialDailyMinutes,
  isUpdate = false,
}: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    initialInterests ?? ["kpop"]
  )
  const [dailyMinutes, setDailyMinutes] = useState(initialDailyMinutes ?? 15)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleSubmit = async () => {
    if (selectedInterests.length === 0) {
      setError("Please select at least one interest.")
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/hallyu-pass/routine/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interests: selectedInterests,
          daily_minutes: dailyMinutes,
          ...(isUpdate && { force: true }),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to generate routine")
      onComplete(data.routine, { interests: selectedInterests, daily_minutes: dailyMinutes })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && isUpdate) onClose?.() }}>
      <DialogContent
        className="max-w-md"
        style={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)" }}
        onInteractOutside={(e) => { if (!isUpdate) e.preventDefault(); else onClose?.() }}
        onEscapeKeyDown={() => { if (isUpdate) onClose?.() }}
      >
        <DialogHeader>
          <DialogTitle className="text-foreground text-lg font-semibold">
            {isUpdate ? "Update Your Hallyu Routine" : "Set Up Your Hallyu Routine"}
          </DialogTitle>
          <p className="text-muted-foreground text-sm">
            Step {step} of 2 — {step === 1 ? "What are you into?" : "How much time do you have?"}
          </p>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground mb-4">
              Select your interests (multiple OK)
            </p>
            {INTERESTS.map(({ id, label, icon: Icon }) => {
              const selected = selectedInterests.includes(id)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleInterest(id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left"
                  style={{
                    borderColor: selected ? "#FF4B6E" : "rgba(255,255,255,0.1)",
                    backgroundColor: selected ? "rgba(255,75,110,0.08)" : "transparent",
                  }}
                >
                  <Icon
                    className="w-5 h-5 flex-shrink-0"
                    style={{ color: selected ? "#FF4B6E" : "#888" }}
                  />
                  <span
                    className="text-sm font-medium flex-1"
                    style={{ color: selected ? "#fff" : "#aaa" }}
                  >
                    {label}
                  </span>
                  {selected && (
                    <Check className="w-4 h-4 flex-shrink-0" style={{ color: "#FF4B6E" }} />
                  )}
                </button>
              )
            })}
            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
            <Button
              className="w-full mt-4 rounded-full font-medium flex items-center justify-center gap-1"
              style={{ backgroundColor: "#FF4B6E", color: "white" }}
              disabled={selectedInterests.length === 0}
              onClick={() => setStep(2)}
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground mb-4">
              How much time can you invest each day?
            </p>
            {TIME_OPTIONS.map(({ value, label, desc }) => {
              const selected = dailyMinutes === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDailyMinutes(value)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left"
                  style={{
                    borderColor: selected ? "#FF4B6E" : "rgba(255,255,255,0.1)",
                    backgroundColor: selected ? "rgba(255,75,110,0.08)" : "transparent",
                  }}
                >
                  <div className="flex-1">
                    <p
                      className="text-sm font-medium"
                      style={{ color: selected ? "#fff" : "#aaa" }}
                    >
                      {label}
                    </p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  {selected && (
                    <Check className="w-4 h-4 flex-shrink-0" style={{ color: "#FF4B6E" }} />
                  )}
                </button>
              )
            })}
            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
            <div className="flex gap-3 mt-4">
              <Button
                variant="outline"
                className="flex-1 rounded-full"
                onClick={() => setStep(1)}
                disabled={loading}
              >
                Back
              </Button>
              <Button
                className="flex-1 rounded-full font-medium"
                style={{ backgroundColor: "#FF4B6E", color: "white" }}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading
                  ? isUpdate ? "Updating…" : "Creating…"
                  : isUpdate ? "Update My Routine" : "Create My Routine"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
